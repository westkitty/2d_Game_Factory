import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Table {
  readonly active: boolean;
  readonly mode: string | null;
  readonly paddleX: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly bricksRemaining: number;
  readonly lives: number;
  readonly score: number;
  readonly paddleReturns: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly ballPaddle?: Table;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = (await read()).ballPaddle!;
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.ball-paddle') && initial.mode === 'breakout' && initial.bricksRemaining === 12 && initial.outcome === 'playing';

  // The paddle really moves under the player.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowRight');
  const moved = (await read()).ballPaddle!;
  const paddleOk = moved.paddleX > initial.paddleX + 8;

  // Pause mid-rally: the ball is frozen; resume continues.
  const paused = await pauseResume(harness);
  const resumed = (await read()).ballPaddle!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.outcome === 'playing';

  // Track the ball with the paddle until every brick is cleared.
  let state = resumed;
  let midway: Table | null = null;
  for (let step = 0; step < 4000 && state.outcome === 'playing'; step++) {
    const delta = state.ballX - state.paddleX;
    if (Math.abs(delta) > 14) {
      const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
      await harness.keyDown(key);
      await harness.stepFrames(3);
      await harness.keyUp(key);
    } else {
      await harness.stepFrames(3);
    }
    state = (await read()).ballPaddle!;
    if (!midway && state.bricksRemaining <= 6) midway = state;
  }
  evidence.midway = midway;
  evidence.final = state;
  const clearOk = state.bricksRemaining === 0 && state.score >= 120 && state.lives > 0 && state.outcome === 'complete';
  const returnsOk = state.paddleReturns >= 1 && (midway?.paddleReturns ?? 0) >= 1;

  const run = await restartRun(harness);
  const fresh = (await read()).ballPaddle!;
  evidence.restart = { ...run, bricks: fresh.bricksRemaining, score: fresh.score, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.bricksRemaining === 12 && fresh.score === 0 && fresh.outcome === 'playing';

  const passed = startedOk && paddleOk && pauseOk && clearOk && returnsOk && restartOk;
  return { passed, details: { ...evidence, startedOk, paddleOk, pauseOk, clearOk, returnsOk, restartOk } };
}
