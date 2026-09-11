import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Nav {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerCol: number;
  readonly playerRow: number;
  readonly exitCol: number;
  readonly exitRow: number;
  readonly pathLength: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly navigation?: Nav;
}

async function walk(harness: Harness, codes: readonly string[]): Promise<void> {
  for (const code of codes) {
    await harness.keyTap(code);
    await harness.stepFrames(2);
  }
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const n = async () => (await read()).navigation!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await n();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.navigation') && initial.mode === 'maze' && initial.playerCol === 4 && initial.playerRow === 8 && initial.exitCol === 12 && initial.exitRow === 8 && initial.pathLength === 13 && initial.outcome === 'playing';

  // A wall blocks: the occupancy grid refuses the step and the player stays put.
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(2);
  const wall = await n();
  evidence.wall = wall;
  const wallOk = wall.lastResult === 'wall' && wall.playerCol === 4 && wall.playerRow === 8;
  // The shortest-path hint shrinks as the player follows the corridor.
  await walk(harness, ['ArrowRight', 'ArrowRight']);
  const corner = await n();
  evidence.corner = corner;
  const cornerOk = corner.playerCol === 6 && corner.playerRow === 8 && corner.lastResult === 'moved' && corner.pathLength < initial.pathLength;
  await walk(harness, ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight']);
  const done = await n();
  evidence.done = done;
  const doneOk = done.lastResult === 'escaped' && done.playerCol === 12 && done.playerRow === 8 && done.outcome === 'complete';
  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  const after = await n();
  const inertOk = after.playerCol === 12 && after.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await n();
  evidence.restart = { ...run, col: fresh.playerCol, row: fresh.playerRow, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.playerCol === 4 && fresh.playerRow === 8 && fresh.outcome === 'playing';

  const passed = startedOk && wallOk && cornerOk && doneOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, wallOk, cornerOk, doneOk, inertOk, restartOk } };
}
