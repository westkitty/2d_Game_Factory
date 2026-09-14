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
  readonly revealedCount: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly navigation?: Nav;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const n = async () => (await read()).navigation!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await n();
  evidence.initial = initial;
  const startedOk =
    booted.installedPacks.includes('sw2d.navigation') &&
    booted.installedPacks.includes('sw2d.generation') &&
    initial.mode === 'maze' &&
    initial.outcome === 'playing' &&
    initial.pathLength > 1 &&
    (initial.playerCol !== initial.exitCol || initial.playerRow !== initial.exitRow) &&
    initial.revealedCount >= 1 &&
    initial.revealedCount < 40;

  const DIRS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
  const beforeWall = await n();
  let wallOk = false;
  for (const code of DIRS) {
    await harness.keyTap(code);
    await harness.stepFrames(2);
    const after = await n();
    if (after.lastResult === 'wall' && after.playerCol === beforeWall.playerCol && after.playerRow === beforeWall.playerRow) {
      wallOk = true;
      break;
    }
  }
  evidence.wall = await n();

  for (let step = 0; step < 80; step++) {
    const here = await n();
    if (here.outcome === 'complete') break;
    let moved = false;
    for (const code of DIRS) {
      const before = await n();
      await harness.keyTap(code);
      await harness.stepFrames(2);
      const after = await n();
      if (after.pathLength < before.pathLength || after.outcome === 'complete') {
        moved = true;
        break;
      }
      if (after.playerCol !== before.playerCol || after.playerRow !== before.playerRow) {
        await harness.keyTap(code === 'ArrowUp' ? 'ArrowDown' : code === 'ArrowDown' ? 'ArrowUp' : code === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft');
        await harness.stepFrames(2);
      }
    }
    if (!moved) break;
  }
  const done = await n();
  evidence.done = done;
  const doneOk = done.outcome === 'complete' && done.lastResult === 'escaped' && done.playerCol === done.exitCol && done.playerRow === done.exitRow && done.revealedCount > initial.revealedCount;
  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  const after = await n();
  const inertOk = after.playerCol === done.playerCol && after.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await n();
  evidence.restart = { ...run, col: fresh.playerCol, row: fresh.playerRow, outcome: fresh.outcome, revealed: fresh.revealedCount };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.pathLength > 1 && fresh.revealedCount < 40;

  const passed = startedOk && wallOk && doneOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, wallOk, doneOk, inertOk, restartOk } };
}
