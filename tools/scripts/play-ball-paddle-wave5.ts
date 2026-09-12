import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 5 play journeys against factory-generated games
 * (not starter-kit overlays). Proves breakout brick-clear vs pong first-to-N.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface TableSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly paddleX: number;
  readonly paddleY: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly bricksRemaining: number;
  readonly lives: number;
  readonly score: number;
  readonly playerScore: number;
  readonly opponentScore: number;
  readonly paddleReturns: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly ballPaddle?: TableSnap;
}

async function snap(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function breakoutRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  let state = initial;
  for (let step = 0; step < 1400 && state.ballPaddle?.outcome === 'playing'; step++) {
    const table = state.ballPaddle;
    const delta = table.ballX - table.paddleX;
    if (Math.abs(delta) > 14) {
      const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
      await harness.keyDown(key);
      await harness.stepFrames(3);
      await harness.keyUp(key);
    } else {
      await harness.stepFrames(3);
    }
    state = await snap(harness);
  }
  const passed =
    initial.ballPaddle?.mode === 'breakout' &&
    initial.ballPaddle.bricksRemaining === 12 &&
    state.ballPaddle?.bricksRemaining === 0 &&
    (state.ballPaddle?.score ?? 0) >= 120 &&
    (state.ballPaddle?.lives ?? 0) > 0 &&
    state.ballPaddle?.outcome === 'complete';
  return { passed, details: { initial: initial.ballPaddle, final: state.ballPaddle } };
}

async function pongRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  let state = initial;
  for (let step = 0; step < 360 && state.ballPaddle?.lastResult !== 'player-return'; step++) {
    const table = state.ballPaddle;
    if (table && table.ballX < 360) {
      if (table.ballY < table.paddleY - 8) {
        await harness.keyDown('ArrowUp');
        await harness.keyUp('ArrowDown');
      } else if (table.ballY > table.paddleY + 8) {
        await harness.keyDown('ArrowDown');
        await harness.keyUp('ArrowUp');
      } else {
        await harness.keyUp('ArrowUp');
        await harness.keyUp('ArrowDown');
      }
    }
    await harness.stepFrames(2);
    state = await snap(harness);
  }
  const returned = state;
  await harness.keyUp('ArrowUp');
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(8);
  const afterReturn = await snap(harness);

  let previousBallX = afterReturn.ballPaddle?.ballX ?? 480;
  state = afterReturn;
  for (let step = 0; step < 1400 && (state.ballPaddle?.opponentScore ?? 0) < 3 && state.ballPaddle?.outcome === 'playing'; step++) {
    const table = state.ballPaddle;
    const headingLeft = table !== undefined && table.ballX < previousBallX;
    if (table && headingLeft && table.ballX < 360) {
      if (table.ballY < 270) {
        await harness.keyDown('ArrowDown');
        await harness.keyUp('ArrowUp');
      } else {
        await harness.keyDown('ArrowUp');
        await harness.keyUp('ArrowDown');
      }
    } else {
      await harness.keyUp('ArrowUp');
      await harness.keyUp('ArrowDown');
    }
    previousBallX = table?.ballX ?? previousBallX;
    await harness.stepFrames(3);
    state = await snap(harness);
  }
  await harness.keyUp('ArrowUp');
  await harness.keyUp('ArrowDown');
  const lost = await snap(harness);

  const passed =
    initial.ballPaddle?.mode === 'pong' &&
    initial.ballPaddle.playerScore === 0 &&
    initial.ballPaddle.opponentScore === 0 &&
    initial.ballPaddle.outcome === 'playing' &&
    returned.ballPaddle?.lastResult === 'player-return' &&
    (afterReturn.ballPaddle?.ballX ?? 0) > (returned.ballPaddle?.ballX ?? 0) &&
    lost.ballPaddle?.opponentScore === 3 &&
    (lost.ballPaddle?.playerScore ?? 0) < 3 &&
    lost.ballPaddle?.outcome === 'failed';
  return { passed, details: { initial: initial.ballPaddle, returned: returned.ballPaddle, afterReturn: afterReturn.ballPaddle, lost: lost.ballPaddle } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-5 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave5-breakout', run: breakoutRun },
    { id: 'wave5-pong', run: pongRun },
  ] as const;
  let failed = 0;
  for (const game of games) {
    process.stdout.write(`Playing ${game.id}...\n`);
    const result = await runSmoke({
      id: game.id,
      buildDir: path.join(REPO_ROOT, 'games', game.id, 'dist'),
      run: game.run,
    });
    const ok = result.passed;
    if (!ok) failed += 1;
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] ${game.id} console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`,
    );
  }
  console.log(`\n${games.length - failed}/${games.length} Wave-5 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
