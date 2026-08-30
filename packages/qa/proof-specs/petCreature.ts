import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { PetShellState } from '../../proofs/pet-creature/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.pet-shell';

const state = (h: Harness): Promise<PetShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

async function stepUntil(
  harness: Harness,
  predicate: (s: PetShellState) => boolean,
  budgetFrames = 600,
): Promise<PetShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(4);
    stepped += 4;
    current = await state(harness);
  }
  return current;
}

const scoreOf = (s: PetShellState, id: string) => s.scores.find((entry) => entry.behaviorId === id)!;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);

  // 1. Boot: the pack is installed, both agents exist, and the pet's authored
  //    needs start at their authored values with zero urgency.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { pet: s1.pet?.needs, tags: s1.pet?.tags, owner: s1.owner?.agentId };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.simulation-agents') &&
    s1.pet?.definitionId === 'pet' &&
    s1.owner?.definitionId === 'owner' &&
    s1.pet.needs['hunger']!.value <= 100 &&
    s1.pet.needs['hunger']!.level === 'ok' &&
    s1.pet.needs['affection'] !== undefined &&
    // The vocabulary is entirely authored: no need the document did not declare.
    Object.keys(s1.pet.needs).sort().join(',') === 'affection,hunger';

  // 2. Needs drift on their own, without any input.
  const before = await state(harness);
  await harness.stepFrames(40);
  const s2 = await state(harness);
  evidence.drift = { before: before.pet?.needs['hunger'], after: s2.pet?.needs['hunger'] };
  const step2_needsDrift =
    s2.pet!.needs['hunger']!.value < before.pet!.needs['hunger']!.value &&
    s2.pet!.needs['hunger']!.urgency > before.pet!.needs['hunger']!.urgency;

  // 3. A need crossing its authored threshold changes its reported level and is
  //    announced once, not once per tick.
  await evalShell(harness, `(s) => s.drain('hunger', 60)`);
  await harness.stepFrames(6);
  const s3 = await state(harness);
  evidence.threshold = { hunger: s3.pet?.needs['hunger'], changes: s3.needLevelChanges };
  const step3_threshold =
    s3.pet!.needs['hunger']!.level !== 'ok' &&
    s3.needLevelChanges.some((entry) => entry.startsWith('hunger:')) &&
    s3.needLevelChanges.filter((entry) => entry === 'hunger:warning').length <= 1;

  // 4. A precondition really gates a behaviour: with no food, `eat` is
  //    ineligible and the reason names the precondition rather than a bare false.
  const noFood = await state(harness);
  evidence.gated = { eat: scoreOf(noFood, 'eat') };
  const step4_precondition =
    scoreOf(noFood, 'eat').eligible === false &&
    scoreOf(noFood, 'eat').blockedBy === 'precondition:has-tag' &&
    // It still *scores* highly - it is wanted, just not possible.
    scoreOf(noFood, 'eat').score > scoreOf(noFood, 'wander').score;

  // 5. Supplying the world fact unblocks it, and the pet chooses to eat by
  //    utility - the shell never told it to.
  await evalShell(harness, `(s) => s.offerFood()`);
  const fed = await stepUntil(harness, (s) => s.startedBehaviors.includes('eat'));
  evidence.eat = { started: fed.startedBehaviors, hunger: fed.pet?.needs['hunger'] };
  const step5_utilityChoice =
    fed.startedBehaviors.includes('eat') &&
    scoreOf(fed, 'eat').eligible !== false;

  // 6. Completion applies the authored effects exactly once: hunger rises and
  //    the food tag is consumed.
  const done = await stepUntil(harness, (s) => s.completedBehaviors.includes('eat'));
  evidence.effects = {
    completed: done.completedBehaviors,
    hunger: done.pet?.needs['hunger'],
    tags: done.pet?.tags,
  };
  const step6_effects =
    done.completedBehaviors.filter((id) => id === 'eat').length === 1 &&
    done.pet!.needs['hunger']!.value > fed.pet!.needs['hunger']!.value &&
    done.pet!.tags.includes('has-food') === false; // the remove-tag effect fired

  // 7. The cooldown is real and named: immediately after eating, `eat` is
  //    blocked for the authored window.
  const cooling = await state(harness);
  evidence.cooldown = { eat: scoreOf(cooling, 'eat') };
  const step7_cooldown =
    scoreOf(cooling, 'eat').eligible === false &&
    // Either the cooldown or the consumed food tag blocks it - both are real
    // gates and both are named rather than silent.
    (scoreOf(cooling, 'eat').blockedBy === 'cooldown' ||
      scoreOf(cooling, 'eat').blockedBy === 'precondition:has-tag');

  // 8. A target-dependent behaviour: with the owner present, `seek-owner` is
  //    eligible; once the owner leaves, its precondition fails.
  const withOwner = await state(harness);
  await evalShell(harness, `(s) => s.ownerLeaves()`);
  await harness.stepFrames(6);
  const withoutOwner = await state(harness);
  evidence.target = {
    with: scoreOf(withOwner, 'seek-owner'),
    without: scoreOf(withoutOwner, 'seek-owner'),
    owner: withoutOwner.owner,
  };
  const step8_targetAvailability =
    scoreOf(withOwner, 'seek-owner').eligible === true &&
    withoutOwner.owner === null &&
    scoreOf(withoutOwner, 'seek-owner').eligible === false &&
    scoreOf(withoutOwner, 'seek-owner').blockedBy === 'precondition:target-available';

  // 9. Relationships: replay from a clean state, drain affection so the pet
  //    seeks its owner, and confirm the authored metric moved on the pair.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.drain('affection', 70)`);
  const bonded = await stepUntil(harness, (s) => s.bond > 0, 900);
  evidence.bond = { bond: bonded.bond, started: bonded.startedBehaviors.slice(0, 8) };
  const step9_relationship =
    bonded.bond >= 4 &&
    bonded.startedBehaviors.includes('seek-owner') &&
    bonded.pet!.needs['affection']!.value > 0;

  // 10. The schedule runs on game time and gates a behaviour by activity.
  const scheduled = await stepUntil(harness, (s) => s.pet?.scheduleActivity !== null, 200);
  evidence.schedule = {
    activity: scheduled.pet?.scheduleActivity,
    clock: scheduled.clock,
    nap: scoreOf(scheduled, 'nap'),
  };
  const step10_schedule =
    scheduled.pet!.scheduleActivity !== null &&
    scheduled.clock.minuteOfDay >= 0 &&
    scheduled.clock.minuteOfDay < 1440 &&
    // `nap` is gated on the 'night' activity, so its eligibility must agree with
    // whatever the schedule currently says.
    scoreOf(scheduled, 'nap').eligible === (scheduled.pet!.scheduleActivity === 'night');

  // 11. Utility, not scripting: with affection topped up and hunger urgent, the
  //     hunger-weighted behaviour outscores the affection-weighted one.
  await evalShell(harness, `(s) => { s.reset(); s.offerFood(); s.drain('hunger', 85); }`);
  await harness.stepFrames(4);
  const ranked = await state(harness);
  evidence.ranking = {
    eat: scoreOf(ranked, 'eat'),
    seek: scoreOf(ranked, 'seek-owner'),
    wander: scoreOf(ranked, 'wander'),
  };
  const step11_utilityRanking =
    scoreOf(ranked, 'eat').score > scoreOf(ranked, 'seek-owner').score &&
    scoreOf(ranked, 'eat').score > scoreOf(ranked, 'wander').score &&
    scoreOf(ranked, 'eat').eligible === true;

  // 12. Reset returns the pet to its authored starting state and clears history.
  // Read immediately, without stepping: a reset that is only clean until the
  // next frame is not a reset.
  await evalShell(harness, `(s) => s.reset()`);
  const after = await state(harness);
  evidence.reset = {
    needs: after.pet?.needs,
    bond: after.bond,
    clock: after.clock,
    started: after.startedBehaviors.length,
    completed: after.completedBehaviors.length,
  };
  const step12_reset =
    after.pet!.needs['hunger']!.value === 100 && // back to the authored initial
    after.pet!.needs['affection']!.value === 80 &&
    after.bond === 0 &&
    after.owner !== null && // the despawned owner is back
    after.startedBehaviors.length === 0 &&
    after.completedBehaviors.length === 0 &&
    after.clock.elapsedMs === 0;

  const passed =
    step1_boot &&
    step2_needsDrift &&
    step3_threshold &&
    step4_precondition &&
    step5_utilityChoice &&
    step6_effects &&
    step7_cooldown &&
    step8_targetAvailability &&
    step9_relationship &&
    step10_schedule &&
    step11_utilityRanking &&
    step12_reset;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_needsDrift,
      step3_threshold,
      step4_precondition,
      step5_utilityChoice,
      step6_effects,
      step7_cooldown,
      step8_targetAvailability,
      step9_relationship,
      step10_schedule,
      step11_utilityRanking,
      step12_reset,
    },
  };
}
