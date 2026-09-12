import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * arena-combat defining journey. Category-C Wave 6 arena plus the Final
 * Product Completion program's melee grammar (matrix L04): three fodder foes
 * converge on the player; each is felled by a three-hit chain aimed along
 * the facing arc (the targeting reticle names the foe being hit); the arena
 * clears; a restart brings every foe back.
 */

interface Melee {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly targetId: string | null;
  readonly comboStep: number;
  readonly bestCombo: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly melee?: Melee;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.melee;
  const startedOk = booted.installedPacks.includes('sw2d.melee') && initial.melee?.mode === 'arena' && initial.melee.foesAlive === 3 && initial.melee.outcome === 'playing';

  // Hold ground facing right: the foes come to the player. Chain three hits on whichever
  // foe the reticle names; repeat until the arena is clear.
  const chains: { target: string | null; steps: (string | null)[]; alive: number }[] = [];
  let state = initial;
  for (let round = 0; round < 6 && state.melee?.outcome === 'playing'; round++) {
    state = await waitUntil(harness, read, (s) => s.melee?.targetId !== null || s.melee?.outcome !== 'playing', 200, 3);
    if (state.melee?.targetId === null) break;
    const target = state.melee!.targetId;
    const steps: (string | null)[] = [];
    await harness.stepFrames(30);
    for (let hit = 0; hit < 3; hit++) {
      await harness.keyTap('KeyX');
      steps.push((await read()).melee!.lastResult);
      await harness.stepFrames(6);
    }
    state = await read();
    chains.push({ target, steps, alive: state.melee!.foesAlive });
  }
  evidence.chains = chains;
  const victory = state.melee!;
  const chainsOk = chains.length >= 3 && chains.every((c) => c.target !== null && c.steps[0]?.startsWith('hit')) && chains.some((c) => c.steps.includes('hit-3'));
  const victoryOk = victory.foesAlive === 0 && victory.playerHealth > 0 && victory.outcome === 'complete' && victory.bestCombo === 3;

  // Striking after the arena is cleared is inert.
  await harness.keyTap('KeyX');
  await harness.stepFrames(3);
  const after = (await read()).melee!;
  const inertOk = after.foesAlive === 0 && after.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = (await read()).melee!;
  evidence.restart = { ...run, foes: fresh.foesAlive, outcome: fresh.outcome, best: fresh.bestCombo };
  const restartOk = run.after === run.before + 1 && fresh.foesAlive === 3 && fresh.outcome === 'playing' && fresh.bestCombo === 0 && fresh.playerHealth === 5;

  const passed = startedOk && chainsOk && victoryOk && inertOk && restartOk;
  return { passed, details: { ...evidence, victory, startedOk, chainsOk, victoryOk, inertOk, restartOk } };
}
