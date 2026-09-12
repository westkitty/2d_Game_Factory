import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Table {
  readonly mode: string | null;
  readonly paddleY: number;
  readonly opponentY: number | null;
  readonly ballX: number;
  readonly ballY: number;
  readonly playerScore: number;
  readonly opponentScore: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface LocalPlay {
  readonly mode: string | null;
  readonly active: boolean;
  readonly axis0: number;
  readonly axis1: number;
}
interface Shell {
  readonly ballPaddle?: Table;
  readonly localPlay?: LocalPlay;
}

async function releaseAll(harness: Harness): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']) await harness.keyUp(key);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { table: initial.ballPaddle, seats: initial.localPlay };
  const startedOk =
    booted.installedPacks.includes('sw2d.ball-paddle') && booted.installedPacks.includes('sw2d.local-play') &&
    initial.ballPaddle?.mode === 'pong' && initial.localPlay?.mode === 'versus' && initial.ballPaddle.playerScore === 0 && initial.ballPaddle.opponentScore === 0;

  // Two seats, two axes: ArrowDown drives seat 0 (left paddle), W drives seat 1 (right paddle), independently.
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(20);
  const p1 = await read();
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(2);
  await harness.keyDown('KeyW');
  await harness.stepFrames(20);
  const p2 = await read();
  await harness.keyUp('KeyW');
  await harness.stepFrames(2);
  evidence.seats = { p1: p1.localPlay, p1PaddleY: p1.ballPaddle?.paddleY, p2: p2.localPlay, p2OpponentY: p2.ballPaddle?.opponentY };
  const seatsOk =
    p1.localPlay?.axis0 === 1 && p1.localPlay.axis1 === 0 && (p1.ballPaddle?.paddleY ?? 0) > (initial.ballPaddle?.paddleY ?? 0) + 8 &&
    p2.localPlay?.axis0 === 0 && p2.localPlay.axis1 === -1 &&
    (p2.ballPaddle?.opponentY === null || (p2.ballPaddle?.opponentY ?? 0) < (p1.ballPaddle?.opponentY ?? 0));

  // Seat 0 returns the ball at least once (a real rebound). Then play on with a deliberately bad
  // policy until one side reaches 3: first-to-N decides the match either way (`complete` when the
  // player wins, `failed` when the opponent does), and no further points are scored after.
  let state = p2;
  for (let step = 0; step < 400 && state.ballPaddle?.lastResult !== 'player-return'; step++) {
    const t = state.ballPaddle!;
    if (t.ballX < 360) {
      if (t.ballY < t.paddleY - 8) { await harness.keyDown('ArrowUp'); await harness.keyUp('ArrowDown'); }
      else if (t.ballY > t.paddleY + 8) { await harness.keyDown('ArrowDown'); await harness.keyUp('ArrowUp'); }
      else await releaseAll(harness);
    }
    await harness.stepFrames(2);
    state = await read();
  }
  await releaseAll(harness);
  const returned = state.ballPaddle!;
  await harness.stepFrames(8);
  const afterReturn = (await read()).ballPaddle!;
  evidence.returned = { last: returned.lastResult, ballX: returned.ballX, afterX: afterReturn.ballX };
  const returnOk = returned.lastResult === 'player-return' && afterReturn.ballX > returned.ballX;

  let previousBallX = afterReturn.ballX;
  state = await read();
  for (let step = 0; step < 1400 && state.ballPaddle?.outcome === 'playing'; step++) {
    const t = state.ballPaddle!;
    const headingLeft = t.ballX < previousBallX;
    if (headingLeft && t.ballX < 360) {
      if (t.ballY < 270) { await harness.keyDown('ArrowDown'); await harness.keyUp('ArrowUp'); }
      else { await harness.keyDown('ArrowUp'); await harness.keyUp('ArrowDown'); }
    } else await releaseAll(harness);
    previousBallX = t.ballX;
    await harness.stepFrames(3);
    state = await read();
  }
  await releaseAll(harness);
  const decided = state.ballPaddle!;
  await harness.stepFrames(30);
  const after = (await read()).ballPaddle!;
  evidence.decided = decided;
  const winner = Math.max(decided.playerScore, decided.opponentScore);
  const loser = Math.min(decided.playerScore, decided.opponentScore);
  const lostOk =
    winner === 3 && loser < 3 &&
    decided.outcome === (decided.playerScore === 3 ? 'complete' : 'failed') &&
    after.playerScore === decided.playerScore && after.opponentScore === decided.opponentScore;

  const run = await restartRun(harness);
  const fresh = (await read()).ballPaddle!;
  evidence.restart = { ...run, player: fresh.playerScore, opponent: fresh.opponentScore, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.playerScore === 0 && fresh.opponentScore === 0 && fresh.outcome === 'playing';

  const passed = startedOk && seatsOk && returnOk && lostOk && restartOk;
  return { passed, details: { ...evidence, startedOk, seatsOk, returnOk, lostOk, restartOk } };
}
