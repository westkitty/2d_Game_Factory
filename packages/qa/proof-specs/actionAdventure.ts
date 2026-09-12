import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * action-adventure defining journey. Category-C Wave 6 skirmish plus the
 * Final Product Completion program's melee grammar (matrix L04): the elite
 * foe pursues the player; a three-hit chain inside the combo window kills it
 * (opener, follow-up, finisher); strikes are directional (facing away
 * whiffs); a contact hit stuns the player and resets the chain; the combo
 * window closing resets the chain.
 */

interface Melee {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly facingX: number;
  readonly targetId: string | null;
  readonly comboStep: number;
  readonly comboWindowLeftMs: number;
  readonly bestCombo: number;
  readonly stunned: boolean;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly melee?: Melee;
}

/** One strike, then settle past the strike cooldown (120 ms) so the next one is not refused. */
async function strike(harness: Harness): Promise<Melee> {
  await harness.keyTap('KeyX');
  const state = (await readShell(harness)).melee!;
  await harness.stepFrames(6);
  return state;
}
async function readShell(harness: Harness): Promise<Shell> {
  return shellReader<Shell>(harness, 'game.top-down-shell')();
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, melee: initial.melee };
  const startedOk =
    booted.installedPacks.includes('sw2d.melee') && initial.melee?.mode === 'skirmish' && initial.melee.foesAlive === 1 && initial.melee.playerHealth === 5 && initial.melee.targetId === null;

  // Swinging at nothing is a whiff, not a hit.
  const whiff = await strike(harness);
  evidence.whiff = whiff;
  const whiffOk = whiff.foesAlive === 1 && whiff.lastResult === 'miss' && whiff.comboStep === 0;

  // The foe pursues: it walks into strike range on its own and becomes the target.
  const inRange = await waitUntil(harness, read, (s) => s.melee?.targetId !== null, 200, 3);
  const pursuitOk = inRange.melee?.targetId === 'foe-0' && inRange.melee.outcome === 'playing';
  // Let it come a little closer so the opener's knockback cannot push it back out of reach.
  await harness.stepFrames(40);

  // Three strikes inside the window: opener, follow-up, finisher - the foe dies on the finisher.
  const first = await strike(harness);
  const second = await strike(harness);
  const third = await strike(harness);
  evidence.chain = { first, second, third };
  const chainOk =
    first.lastResult === 'hit-1' && first.comboStep === 1 && second.lastResult === 'hit-2' && second.comboStep === 2 && third.lastResult === 'hit-3' && third.bestCombo === 3 && third.foesAlive === 0 && third.outcome === 'complete';

  // Restart; face away from the pursuing foe: the strike is directional and whiffs; face it: hit.
  const run1 = await restartRun(harness);
  const fresh = await read();
  const restartOk = run1.after === run1.before + 1 && fresh.melee?.foesAlive === 1 && fresh.melee.outcome === 'playing' && fresh.melee.bestCombo === 0;
  await waitUntil(harness, read, (s) => s.melee?.targetId !== null, 200, 3);
  await harness.stepFrames(40);
  await harness.keyDown('Numpad4');
  await harness.stepFrames(2);
  const away = await strike(harness);
  await harness.keyUp('Numpad4');
  await harness.keyDown('Numpad6');
  await harness.stepFrames(2);
  const toward = await strike(harness);
  await harness.keyUp('Numpad6');
  evidence.directional = { away, toward };
  const directionalOk = away.facingX < 0 && away.lastResult === 'miss' && away.targetId === null && toward.facingX > 0 && toward.lastResult === 'hit-1';

  // Let the window close: the chain resets, and the next hit is an opener again.
  await harness.stepFrames(50);
  const lapsed = (await read()).melee!;
  const reopened = await strike(harness);
  evidence.window = { lapsed, reopened };
  const windowOk = lapsed.comboStep === 0 && reopened.lastResult === 'hit-1' && reopened.comboStep === 1;

  // Contact: the foe reaches the player, deals damage, stuns (strike refused) and the chain resets.
  const hit = await waitUntil(harness, read, (s) => (s.melee?.playerHealth ?? 5) < 5, 200, 2);
  const stunnedStrike = await strike(harness);
  evidence.contact = { hit: hit.melee, stunnedStrike };
  const contactOk = (hit.melee?.playerHealth ?? 5) < 5 && hit.melee?.stunned === true && stunnedStrike.lastResult === 'stunned' && stunnedStrike.comboStep === 0;

  const passed = startedOk && whiffOk && pursuitOk && chainOk && restartOk && directionalOk && windowOk && contactOk;
  return { passed, details: { ...evidence, startedOk, whiffOk, pursuitOk, chainOk, restartOk, directionalOk, windowOk, contactOk } };
}
