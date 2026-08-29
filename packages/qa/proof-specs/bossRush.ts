import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 4 proof - boss-rush (see proofs/boss-rush/PROOF_CONTRACT.md).
 *
 * One boss, three mechanically distinct phases (aimed -> aimed fan -> ring),
 * transitions driven by `entity-health-below` conditions in
 * `content/encounters.json`, each new phase opening an `onEnterInvulnMs`
 * window and phase 3 raising a world flag - all reusable `sw2d.encounters`.
 */

interface ShellSnap {
  readonly playerHealth: { readonly current: number; readonly max: number };
  readonly bossHealth: number;
  readonly bossHealthFraction: number;
  readonly bossInvulnerable: boolean;
  readonly phaseId: string | null;
  readonly phaseIndex: number;
  readonly finalPhaseFlag: boolean;
  readonly bulletsFired: number;
  readonly encounterComplete: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

async function fireUntil(harness: Harness, predicate: (s: ShellSnap) => boolean, maxFrames: number): Promise<ShellSnap> {
  for (let i = 0; i < maxFrames; i += 4) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(4);
  }
  return state(harness);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(6);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.encounters') &&
    initial.phaseId === 'phase-1' &&
    initial.phaseIndex === 0 &&
    initial.finalPhaseFlag === false &&
    Math.abs(initial.bossHealthFraction - 1) < 0.01;

  await harness.keyDown('KeyJ'); // hold PRIMARY_ACTION - auto sidearm, straight up into the boss

  const inPhase2 = await fireUntil(harness, (s) => s.phaseId === 'phase-2', 600);
  evidence.inPhase2 = inPhase2;
  const phase2Ok = inPhase2.phaseId === 'phase-2' && inPhase2.phaseIndex === 1 && inPhase2.bossInvulnerable === true;

  // While the onEnter invulnerability window is open, boss health does not drop.
  const invA = await state(harness);
  await harness.stepFrames(8);
  const invB = await state(harness);
  const invulnHeldOk = invB.bossInvulnerable ? invB.bossHealth === invA.bossHealth : true;

  const inPhase3 = await fireUntil(harness, (s) => s.phaseId === 'phase-3', 800);
  evidence.inPhase3 = inPhase3;
  const phase3Ok = inPhase3.phaseId === 'phase-3' && inPhase3.phaseIndex === 2 && inPhase3.finalPhaseFlag === true;

  const finished = await fireUntil(harness, (s) => s.encounterComplete, 1200);
  await harness.keyUp('KeyJ');
  evidence.finished = finished;
  const completeOk = finished.encounterComplete === true && finished.bulletsFired > 0;
  const playerTookFireOk = finished.playerHealth.current < finished.playerHealth.max;

  // Restart genuinely reinstalls.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.phaseId === 'phase-1' &&
    afterRestart.phaseIndex === 0 &&
    afterRestart.finalPhaseFlag === false &&
    afterRestart.encounterComplete === false &&
    Math.abs(afterRestart.bossHealthFraction - 1) < 0.01;

  const passed = startedOk && phase2Ok && invulnHeldOk && phase3Ok && completeOk && playerTookFireOk && restartOk;
  return {
    passed,
    details: { ...evidence, startedOk, phase2Ok, invulnHeldOk, phase3Ok, completeOk, playerTookFireOk, restartOk },
  };
}
