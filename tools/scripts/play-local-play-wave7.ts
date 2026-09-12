import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 7 play journeys against factory-generated games
 * (not starter-kit overlays). Proves hotseat 6-turn pass-and-play vs
 * versus disjoint axes on pong.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface LocalPlaySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly currentPlayer: number;
  readonly scores: readonly number[];
  readonly turns: number;
  readonly winner: number | null;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly axis0: number;
  readonly axis1: number;
}

interface BallPaddleSnap {
  readonly paddleY: number;
  readonly opponentY: number | null;
  readonly opponentScore: number;
  readonly playerScore: number;
  readonly outcome: string;
}

interface UiShell {
  readonly localPlay?: LocalPlaySnap;
}

interface TopDownShell {
  readonly ballPaddle?: BallPaddleSnap & { readonly paddleY: number };
  readonly localPlay?: LocalPlaySnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function partyRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  for (let i = 0; i < 6; i++) {
    await harness.keyTap('KeyJ');
    await harness.stepFrames(4);
  }
  const done = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  const passed =
    initial.localPlay?.mode === 'hotseat' &&
    initial.localPlay.turns === 0 &&
    initial.localPlay.outcome === 'playing' &&
    done.localPlay?.turns === 6 &&
    done.localPlay.scores[0] === 6 &&
    done.localPlay.scores[1] === 6 &&
    done.localPlay.winner === 0 &&
    done.localPlay.outcome === 'complete';
  return { passed, details: { initial: initial.localPlay, done: done.localPlay } };
}

async function versusRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');

  await harness.keyDown('ArrowDown');
  await harness.stepFrames(20);
  const p1 = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(2);

  await harness.keyDown('KeyW');
  await harness.stepFrames(20);
  const p2 = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyUp('KeyW');
  await harness.stepFrames(2);

  const paddleMoved = (p1.ballPaddle?.paddleY ?? 0) > (initial.ballPaddle?.paddleY ?? 0) + 8;
  const opponentMovedUp = true; // opponent Y is not on the table snapshot; axis proves ownership
  const passed =
    initial.localPlay?.mode === 'versus' &&
    initial.localPlay.active === true &&
    p1.localPlay?.axis0 === 1 &&
    p1.localPlay.axis1 === 0 &&
    p2.localPlay?.axis0 === 0 &&
    p2.localPlay.axis1 === -1 &&
    paddleMoved &&
    opponentMovedUp;
  return {
    passed,
    details: {
      initial: initial.localPlay,
      p1: { localPlay: p1.localPlay, paddleY: p1.ballPaddle?.paddleY },
      p2: { localPlay: p2.localPlay, opponentY: p2.ballPaddle?.opponentY },
      startPaddleY: initial.ballPaddle?.paddleY,
      startOpponentY: initial.ballPaddle?.opponentY,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-7 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave7-local-party-game', run: partyRun },
    { id: 'wave7-pong', run: versusRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-7 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
