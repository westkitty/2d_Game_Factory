import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * chase-platformer completion journey (matrix L01): the closing wall is the
 * reusable sw2d.pursuit `wall` service. Standing still is caught; running to
 * the escape line escapes; restart resets the wall to its catalog start.
 */

interface Chase {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly wallX: number;
  readonly gap: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly chase?: Chase;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, chase: initial.chase };
  const startedOk =
    booted.installedPacks.includes('sw2d.pursuit') &&
    initial.chase?.mode === 'pursuit' &&
    initial.chase.outcome === 'playing' &&
    initial.chase.wallX < 0 &&
    initial.x < 200;

  // Stand still: the wall closes and catches.
  const caught = await waitUntil(harness, read, (s) => s.chase?.outcome !== 'playing', 200, 6);
  evidence.caught = { x: caught.x, chase: caught.chase };
  const caughtOk = caught.chase?.outcome === 'failed' && caught.chase.lastResult === 'caught' && caught.chase.wallX >= caught.x - 20;

  // Restart: wall back at its start, then outrun it to the flag.
  const restart = await restartRun(harness);
  const fresh = await read();
  const restartOk = restart.after === restart.before + 1 && fresh.chase?.outcome === 'playing' && fresh.chase.wallX < 0 && fresh.x < 200;
  const escaped = await holdUntil(harness, ['ArrowRight'], read, (s) => s.chase?.outcome !== 'playing', 200, 4);
  evidence.escaped = { x: escaped.x, chase: escaped.chase };
  const escapedOk =
    escaped.chase?.outcome === 'complete' && escaped.chase.lastResult === 'escaped' && escaped.x >= 820 && escaped.chase.wallX < escaped.x;

  const passed = startedOk && caughtOk && restartOk && escapedOk;
  return { passed, details: { ...evidence, startedOk, caughtOk, restartOk, escapedOk } };
}
