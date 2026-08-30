import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { BreakoutShellState } from '../../proofs/breakout/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.breakout-shell';

const state = (h: Harness): Promise<BreakoutShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

type Held = 'left' | 'right' | 'none';

/**
 * Play Breakout the way a player does: hold a real arrow key until the paddle is
 * under the ball, release when it is.
 *
 * The proof never writes a paddle position while the ball is live - the shell's
 * `parkPaddle` setup control refuses that outright. Keeping the rally honest is
 * what makes the frame budgets and the "the ball survived" assertions mean
 * something.
 */
async function rally(
  harness: Harness,
  stopWhen: (s: BreakoutShellState) => boolean,
  options: { budgetFrames?: number; reserveOnLoss?: boolean } = {},
): Promise<BreakoutShellState> {
  const budget = options.budgetFrames ?? 3000;
  let held: Held = 'none';
  let current = await state(harness);
  let stepped = 0;

  const hold = async (next: Held): Promise<void> => {
    if (next === held) return;
    if (held === 'left') await harness.keyUp('ArrowLeft');
    if (held === 'right') await harness.keyUp('ArrowRight');
    if (next === 'left') await harness.keyDown('ArrowLeft');
    if (next === 'right') await harness.keyDown('ArrowRight');
    held = next;
  };

  while (!stopWhen(current) && stepped < budget) {
    if (current.status === 'round-over' && options.reserveOnLoss && current.livesRemaining > 0) {
      await hold('none');
      await evalShell(harness, `(s) => { s.resetRound(); s.serve(); }`);
      current = await state(harness);
      continue;
    }
    if (current.status !== 'playing') break;

    const paddle = current.paddles[0]!;
    const delta = current.ball.x - paddle.x;
    await hold(Math.abs(delta) < 10 ? 'none' : delta > 0 ? 'right' : 'left');
    await harness.stepFrames(3);
    stepped += 3;
    current = await state(harness);
  }

  await hold('none');
  return current;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Boot: the reusable pack is installed and the authored board is standing.
  //    Nothing has been served, so the ball is parked and inert.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { status: s1.status, ball: s1.ball, bricks: s1.bricksRemaining, lives: s1.livesRemaining };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.ball-paddle') &&
    s1.status === 'idle' &&
    s1.ball.live === false &&
    s1.ball.vx === 0 &&
    s1.ball.vy === 0 &&
    s1.bricksRemaining === 15 &&
    s1.livesRemaining === 3 &&
    s1.scores['player'] === 0;

  // 2. The paddle answers the controller and clamps at its authored travel bound.
  //    Done before the serve, so nothing about the ball can confuse it.
  const beforeMove = await state(harness);
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(12);
  const movedRight = await state(harness);
  await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowLeft');
  await harness.stepFrames(200);
  const clamped = await state(harness);
  await harness.keyUp('ArrowLeft');
  await harness.stepFrames(2);
  evidence.paddle = { before: beforeMove.paddles[0], right: movedRight.paddles[0], clamped: clamped.paddles[0] };
  const step2_paddle =
    movedRight.paddles[0]!.x > beforeMove.paddles[0]!.x &&
    clamped.paddles[0]!.x < movedRight.paddles[0]!.x &&
    clamped.paddles[0]!.atMin === true &&
    clamped.paddles[0]!.x === 90 && // the authored minTravel
    clamped.ball.live === false; // the ball never moved: no serve yet

  // 3. Serve: the ball leaves the serve point at the authored initial speed.
  await evalShell(harness, `(s) => { s.parkPaddle(480); s.serve(); }`);
  await harness.stepFrames(2);
  const s3 = await state(harness);
  evidence.served = { ball: s3.ball, events: s3.lastEvents };
  const step3_serve =
    s3.status === 'playing' &&
    s3.ball.live === true &&
    s3.counts['served'] === 1 &&
    Math.abs(Math.hypot(s3.ball.vx, s3.ball.vy) - 320) < 2 &&
    s3.ball.vy < 0; // served upward, per the authored policy

  // 4. Playing the rally: the ball bounces off a wall without changing speed.
  const walled = await rally(harness, (s) => (s.counts['wall-bounce'] ?? 0) > 0, { budgetFrames: 900 });
  // A wall is a mirror, not a trampoline. The strongest available statement of
  // that: the ball's speed is *entirely* explained by the serve speed plus one
  // authored increment per paddle hit, so however many walls it has struck,
  // none of them contributed anything.
  const explainedSpeed = 320 + 18 * (walled.counts['paddle-bounce'] ?? 0);
  evidence.wallBounce = {
    count: walled.counts['wall-bounce'],
    paddleBounces: walled.counts['paddle-bounce'],
    speed: walled.ball.speed,
    explainedSpeed,
    live: walled.ball.live,
  };
  const step4_wallBounce =
    (walled.counts['wall-bounce'] ?? 0) > 0 &&
    walled.ball.live === true &&
    Math.abs(walled.ball.speed - Math.min(explainedSpeed, 560)) < 2;

  // 5. A brick is destroyed and the score rises by the authored value.
  const brickState = await rally(harness, (s) => (s.counts['brick-destroyed'] ?? 0) > 0, { reserveOnLoss: true });
  evidence.brick = {
    destroyed: brickState.counts['brick-destroyed'],
    remaining: brickState.bricksRemaining,
    score: brickState.scores['player'],
  };
  const step5_brick =
    (brickState.counts['brick-destroyed'] ?? 0) >= 1 &&
    brickState.bricksRemaining < 15 &&
    (brickState.scores['player'] ?? 0) >= 10;

  // 6. A 2-hp brick survives its first strike (a 'brick-hit' with hp remaining)
  //    and, when it dies, reports its CANONICAL Phase-2 item id. The simulation
  //    never invents an item; it names one from the game's own catalog.
  const dropped = await rally(harness, (s) => s.lastDropItemId !== null, { reserveOnLoss: true, budgetFrames: 6000 });
  evidence.drop = { itemId: dropped.lastDropItemId, hits: dropped.counts['brick-hit'] };
  const step6_toughBrick = dropped.lastDropItemId === 'coin-1' && (dropped.counts['brick-hit'] ?? 0) >= 1;

  // 7. Hit location steers the outgoing ball. Sampling one bounce is not enough:
  //    a centre hit legitimately returns straight, so a flat mirror would pass a
  //    single-sample check. Collect several bounces, require that at least one
  //    was genuinely off-centre, and require every off-centre bounce to send the
  //    ball the way it was struck.
  const bounceSamples: { relative: number; vx: number; vy: number }[] = [];
  let sampler = await state(harness);
  for (let i = 0; i < 8; i++) {
    const before = sampler.counts['paddle-bounce'] ?? 0;
    sampler = await rally(harness, (s) => (s.counts['paddle-bounce'] ?? 0) > before, { reserveOnLoss: true });
    if (sampler.status !== 'playing' || sampler.lastBounceRelative === null) break;
    bounceSamples.push({ relative: sampler.lastBounceRelative, vx: sampler.ball.vx, vy: sampler.ball.vy });
  }
  const offCentre = bounceSamples.filter((sample) => Math.abs(sample.relative) > 0.15);
  evidence.steer = { samples: bounceSamples, offCentre: offCentre.length };
  const step7_steering =
    bounceSamples.length >= 3 &&
    offCentre.length >= 1 &&
    // Every off-centre bounce steered the ball toward the side it was struck...
    offCentre.every((sample) => Math.sign(sample.vx) === Math.sign(sample.relative)) &&
    // ...and every bounce sent it back up the court.
    bounceSamples.every((sample) => sample.vy < 0);

  // 8. Speed rises by exactly the authored increment on each paddle hit, and
  //    clamps at the authored maximum. Measured from a FRESH round: step 7 has
  //    already driven the ball to its ceiling, and a saturated ball cannot show
  //    a ramp.
  await evalShell(harness, `(s) => { s.resetRound(); s.parkPaddle(480); s.serve(); }`);
  const speeds: number[] = [];
  let ramp = await state(harness);
  for (let i = 0; i < 16; i++) {
    const before = ramp.counts['paddle-bounce'] ?? 0;
    ramp = await rally(harness, (s) => (s.counts['paddle-bounce'] ?? 0) > before, { reserveOnLoss: true });
    if (ramp.status !== 'playing') break;
    speeds.push(ramp.ball.speed);
  }
  evidence.speeds = speeds;
  const nonDecreasing = speeds.every((speed, i) => i === 0 || speed >= speeds[i - 1]!);
  const step8_speedRamp =
    speeds.length >= 3 &&
    // 320 initial + 18 per hit, exactly, for the first two returns.
    Math.abs(speeds[0]! - 338) < 0.51 &&
    Math.abs(speeds[1]! - 356) < 0.51 &&
    nonDecreasing &&
    speeds.every((speed) => speed <= 560 + 0.01); // never past the authored maximum

  // 9. Stop playing: the ball reaches the loss edge, costs a life, and parks.
  await evalShell(harness, `(s) => s.reset()`);
  await evalShell(harness, `(s) => { s.parkPaddle(90); s.serve(); }`);
  const livesBefore = (await state(harness)).livesRemaining;
  // No tracking at all - the paddle stays parked at the far left.
  let lost = await state(harness);
  for (let i = 0; i < 900 && (lost.counts['ball-lost'] ?? 0) === 0; i += 6) {
    await harness.stepFrames(6);
    lost = await state(harness);
  }
  evidence.lost = { livesBefore, livesAfter: lost.livesRemaining, status: lost.status, ball: lost.ball };
  const step9_ballLost =
    (lost.counts['ball-lost'] ?? 0) >= 1 &&
    lost.livesRemaining === livesBefore - 1 &&
    lost.status === 'round-over' &&
    lost.ball.live === false;

  // 10. A round reset re-centres the paddle and re-arms the serve without
  //     restoring bricks already cleared or score already earned.
  const beforeReset = await state(harness);
  await evalShell(harness, `(s) => s.resetRound()`);
  await harness.stepFrames(2);
  const afterReset = await state(harness);
  evidence.roundReset = {
    before: { bricks: beforeReset.bricksRemaining, score: beforeReset.scores['player'] },
    after: { bricks: afterReset.bricksRemaining, score: afterReset.scores['player'], paddle: afterReset.paddles[0] },
  };
  const step10_roundReset =
    afterReset.status === 'idle' &&
    afterReset.ball.live === false &&
    afterReset.paddles[0]!.x === 480 && // re-centred between minTravel and maxTravel
    afterReset.bricksRemaining === beforeReset.bricksRemaining &&
    afterReset.scores['player'] === beforeReset.scores['player'];

  // 11. Clearing the whole board completes the match, with the authored total
  //     score: ten 1-hp bricks at 10 plus five 2-hp bricks at 25.
  await evalShell(harness, `(s) => { s.reset(); s.serve(); }`);
  const cleared = await rally(harness, (s) => s.status === 'complete', {
    reserveOnLoss: true,
    budgetFrames: 40000,
  });
  evidence.cleared = {
    status: cleared.status,
    bricks: cleared.bricksRemaining,
    winner: cleared.winnerId,
    score: cleared.scores['player'],
    destroyed: cleared.counts['brick-destroyed'],
    lives: cleared.livesRemaining,
  };
  const step11_boardClear =
    cleared.status === 'complete' &&
    cleared.bricksRemaining === 0 &&
    cleared.winnerId === 'player' &&
    (cleared.counts['match-complete'] ?? 0) >= 1 &&
    cleared.scores['player'] === 225;

  // 12. A completed match is inert: further serves and frames change nothing.
  const beforeIdle = await state(harness);
  await evalShell(harness, `(s) => s.serve()`);
  await harness.stepFrames(20);
  const afterIdle = await state(harness);
  evidence.inert = { before: beforeIdle.ball, after: afterIdle.ball };
  const step12_completeIsInert =
    afterIdle.status === 'complete' &&
    afterIdle.ball.live === false &&
    afterIdle.ball.x === beforeIdle.ball.x &&
    afterIdle.ball.y === beforeIdle.ball.y &&
    afterIdle.counts['served'] === beforeIdle.counts['served'];

  const passed =
    step1_boot &&
    step2_paddle &&
    step3_serve &&
    step4_wallBounce &&
    step5_brick &&
    step6_toughBrick &&
    step7_steering &&
    step8_speedRamp &&
    step9_ballLost &&
    step10_roundReset &&
    step11_boardClear &&
    step12_completeIsInert;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_paddle,
      step3_serve,
      step4_wallBounce,
      step5_brick,
      step6_toughBrick,
      step7_steering,
      step8_speedRamp,
      step9_ballLost,
      step10_roundReset,
      step11_boardClear,
      step12_completeIsInert,
    },
  };
}
