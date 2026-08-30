import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { PlayerJoinResult } from '@sw2d/contracts';
import type { PongShellState } from '../../proofs/pong/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.pong-shell';

const state = (h: Harness): Promise<PongShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

function key(harness: Harness, type: 'keydown' | 'keyup', code: string): Promise<unknown> {
  return harness.evaluate(
    `window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { code: ${JSON.stringify(code)}, bubbles: true }))`,
  );
}

async function stepUntil(
  harness: Harness,
  predicate: (s: PongShellState) => boolean,
  budgetFrames = 900,
): Promise<PongShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(6);
    stepped += 6;
    current = await state(harness);
  }
  return current;
}

const paddleOf = (s: PongShellState, id: string) => s.paddles.find((paddle) => paddle.id === id)!;

/** Which physical keys each seated player's profile binds for up / down. */
const KEYS = {
  left: { up: 'KeyW', down: 'KeyS' },
  right: { up: 'ArrowUp', down: 'ArrowDown' },
} as const;

/**
 * Play the rally the way two players do: each defending paddle chases the ball
 * with its own player's real keys.
 *
 * Nothing here writes a paddle position. Both paddles move only because their
 * own `input.players` channel says so, which is what keeps the Phase-15
 * isolation claim live through the Phase-16 half of the journey.
 */
async function rally(
  harness: Harness,
  stopWhen: (s: PongShellState) => boolean,
  options: { defend?: readonly ('left' | 'right')[]; budgetFrames?: number; reserveOnLoss?: boolean } = {},
): Promise<PongShellState> {
  const defend = options.defend ?? (['left', 'right'] as const);
  const budget = options.budgetFrames ?? 3000;
  const held: Record<string, 'up' | 'down' | 'none'> = { left: 'none', right: 'none' };
  let current = await state(harness);
  let stepped = 0;

  const hold = async (side: 'left' | 'right', next: 'up' | 'down' | 'none'): Promise<void> => {
    if (held[side] === next) return;
    if (held[side] === 'up') await harness.keyUp(KEYS[side].up);
    if (held[side] === 'down') await harness.keyUp(KEYS[side].down);
    if (next === 'up') await harness.keyDown(KEYS[side].up);
    if (next === 'down') await harness.keyDown(KEYS[side].down);
    held[side] = next;
  };
  const release = async (): Promise<void> => {
    await hold('left', 'none');
    await hold('right', 'none');
  };

  while (!stopWhen(current) && stepped < budget) {
    if (current.status === 'round-over' && options.reserveOnLoss) {
      await release();
      await evalShell(harness, `(s) => { s.resetRound(); s.serve(); }`);
      current = await state(harness);
      continue;
    }
    if (current.status !== 'playing') break;

    for (const side of ['left', 'right'] as const) {
      if (!defend.includes(side)) {
        await hold(side, 'none');
        continue;
      }
      const paddle = paddleOf(current, side);
      const delta = current.ball.y - paddle.y;
      await hold(side, Math.abs(delta) < 8 ? 'none' : delta > 0 ? 'down' : 'up');
    }
    await harness.stepFrames(3);
    stepped += 3;
    current = await state(harness);
  }

  await release();
  return current;
}

/**
 * Pong journey - the composition of two post-ten phases.
 *
 * Steps 1-6 are the Phase 15 input foundation, unchanged in intent from when
 * this proof carried only that half: two seated players, two isolated channels,
 * simultaneous opposite intent, independent release and a real travel clamp.
 * Steps 7-12 are Phase 16 on top: the ball, the bounce, the goals and the match.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Two authored slots and both post-ten capabilities live; nobody seated.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { slots: s1.slots.map((slot) => slot.playerId), status: s1.status, scores: s1.scores };
  const step1_twoSlots =
    snap.scene === 'sw2d.play' &&
    snap.capabilities.includes('input.players') &&
    snap.capabilities.includes('arcade.ball-paddle') &&
    s1.slots.length === 2 &&
    s1.slots.map((slot) => slot.playerId).join(',') === 'left,right' &&
    s1.canStart === false &&
    s1.playerAdapterCount === 0 &&
    s1.status === 'idle' &&
    s1.ball.live === false;

  // 2. Both players seat on disjoint keyboard profiles and the match starts.
  const joinLeft = await evalShell<PlayerJoinResult>(
    harness,
    `(s) => s.join('left', { kind: 'keyboard-profile', profileId: 'keyboard-left' })`,
  );
  const joinRight = await evalShell<PlayerJoinResult>(
    harness,
    `(s) => s.join('right', { kind: 'keyboard-profile', profileId: 'keyboard-right' })`,
  );
  const started = await evalShell<boolean>(harness, `(s) => s.start()`);
  await harness.stepFrames(2);
  const s2 = await state(harness);
  evidence.seated = { joinLeft, joinRight, started };
  const step2_seated =
    joinLeft.ok === true &&
    joinRight.ok === true &&
    started === true &&
    s2.phase === 'playing' &&
    s2.playerAdapterCount === 2 &&
    s2.paddles.length === 2;

  const start = await state(harness);

  // 3. The left player moves up while the right paddle stays exactly still.
  await key(harness, 'keydown', 'KeyW');
  await harness.stepFrames(16);
  const s3 = await state(harness);
  evidence.leftOnly = { left: paddleOf(s3, 'left'), right: paddleOf(s3, 'right') };
  const step3_leftOnly =
    paddleOf(s3, 'left').y < paddleOf(start, 'left').y &&
    paddleOf(s3, 'left').intent === -1 &&
    paddleOf(s3, 'right').y === paddleOf(start, 'right').y &&
    paddleOf(s3, 'right').intent === 0;

  // 4. The right player moves down at the same time - simultaneous OPPOSITE intent.
  await key(harness, 'keydown', 'ArrowDown');
  await harness.stepFrames(16);
  const s4 = await state(harness);
  evidence.opposite = { left: paddleOf(s4, 'left'), right: paddleOf(s4, 'right'), flag: s4.oppositeIntent };
  const step4_oppositeIntent =
    paddleOf(s4, 'left').intent === -1 &&
    paddleOf(s4, 'right').intent === 1 &&
    s4.oppositeIntent === true &&
    paddleOf(s4, 'left').y < paddleOf(s3, 'left').y &&
    paddleOf(s4, 'right').y > paddleOf(s3, 'right').y;

  // 5. Releasing one player's key stops only that paddle.
  await key(harness, 'keyup', 'KeyW');
  await harness.stepFrames(10);
  const s5 = await state(harness);
  evidence.releaseLeft = { left: paddleOf(s5, 'left'), right: paddleOf(s5, 'right') };
  const step5_independentRelease =
    paddleOf(s5, 'left').intent === 0 &&
    paddleOf(s5, 'right').intent === 1 &&
    paddleOf(s5, 'right').y > paddleOf(s4, 'right').y &&
    s5.oppositeIntent === false;

  // 6. The moving paddle clamps at the court edge and the other never moved.
  await harness.stepFrames(140);
  const s6 = await state(harness);
  await key(harness, 'keyup', 'ArrowDown');
  await harness.stepFrames(4);
  evidence.clamped = { left: paddleOf(s6, 'left'), right: paddleOf(s6, 'right') };
  const step6_clampedNoCrossTalk =
    paddleOf(s6, 'right').atMax === true &&
    paddleOf(s6, 'left').atMax === false &&
    paddleOf(s6, 'left').y === paddleOf(s5, 'left').y;

  // ---------------------------------------------------------------------
  // Phase 16 - the ball, on top of the channels above.
  // ---------------------------------------------------------------------

  // 7. Serve: the ball leaves the centre at the authored initial speed.
  await evalShell(harness, `(s) => s.serve()`);
  await harness.stepFrames(2);
  const s7 = await state(harness);
  evidence.served = { ball: s7.ball, counts: s7.counts };
  const step7_serve =
    s7.status === 'playing' &&
    s7.ball.live === true &&
    s7.counts['served'] === 1 &&
    Math.abs(Math.hypot(s7.ball.vx, s7.ball.vy) - 340) < 2 &&
    s7.ball.vx > 0; // the alternate policy's first serve goes right

  // 8. Both players defend, so a rally happens: the ball bounces off the top or
  //     bottom wall, which are unlisted edges and therefore default to `bounce`.
  //     A wall is a mirror - the ball's speed stays entirely explained by the
  //     serve speed plus one authored increment per paddle hit.
  const walled = await rally(harness, (s) => (s.counts['wall-bounce'] ?? 0) > 0, { budgetFrames: 1500 });
  const explained = Math.min(340 + 20 * (walled.counts['paddle-bounce'] ?? 0), 560);
  evidence.wall = {
    count: walled.counts['wall-bounce'],
    paddleBounces: walled.counts['paddle-bounce'],
    speed: walled.ball.speed,
    explained,
  };
  const step8_wallBounce =
    (walled.counts['wall-bounce'] ?? 0) > 0 &&
    walled.ball.live === true &&
    Math.abs(walled.ball.speed - explained) < 2;

  // 9. A paddle returns the ball: the bounce reports where it was struck, and
  //    the ball leaves faster by exactly the authored increment.
  const bouncesBefore = (await state(harness)).counts['paddle-bounce'] ?? 0;
  const speedBefore = (await state(harness)).ball.speed;
  const returned = await rally(harness, (s) => (s.counts['paddle-bounce'] ?? 0) > bouncesBefore, {
    budgetFrames: 2400,
  });
  evidence.rally = {
    bounces: returned.counts['paddle-bounce'],
    speedBefore,
    speedAfter: returned.ball.speed,
    relative: returned.lastBounceRelative,
  };
  const step9_paddleReturn =
    (returned.counts['paddle-bounce'] ?? 0) > bouncesBefore &&
    returned.lastBounceRelative !== null &&
    Math.abs(returned.lastBounceRelative) <= 1 &&
    returned.ball.live === true &&
    // One authored speedIncreasePerHit, or already clamped at the maximum.
    (Math.abs(returned.ball.speed - Math.min(speedBefore + 20, 560)) < 2 || returned.ball.speed === 560);

  // 10. Stop defending on the right: the ball leaves through the right edge,
  //     which the document names as a goal scoring for 'left'.
  const goalsBefore = (await state(harness)).counts['goal'] ?? 0;
  const leftBefore = (await state(harness)).scores['left'] ?? 0;
  const scored = await rally(harness, (s) => (s.counts['goal'] ?? 0) > goalsBefore, {
    defend: ['left'],
    budgetFrames: 3000,
  });
  evidence.goal = {
    scores: scored.scores,
    status: scored.status,
    goals: scored.counts['goal'],
    edgeOwnerGained: (scored.scores['left'] ?? 0) - leftBefore,
  };
  const step10_goal =
    (scored.counts['goal'] ?? 0) > goalsBefore &&
    scored.status === 'round-over' &&
    scored.ball.live === false &&
    // The edge names 'left' as its scorer, and that is exactly who gained.
    (scored.scores['left'] ?? 0) === leftBefore + 1;

  // 11. Reaching the authored target score completes the match with that winner.
  let match = scored;
  for (let i = 0; i < 10 && match.status !== 'complete'; i++) {
    await evalShell(harness, `(s) => { s.resetRound(); s.serve(); }`);
    match = await rally(harness, (s) => s.status !== 'playing', { defend: ['left'], budgetFrames: 3000 });
  }
  evidence.match = { status: match.status, winner: match.winnerId, scores: match.scores, ball: match.ball };
  const step11_matchComplete =
    match.status === 'complete' &&
    match.winnerId === 'left' &&
    (match.scores['left'] ?? 0) >= 2 && // the authored targetScore
    (match.counts['match-complete'] ?? 0) >= 1 &&
    match.ball.live === false; // a finished match parks the ball

  // 12. The two players never stopped being independent: the simulation the
  //     ball ran in is the same one both channels were driving.
  const s12 = await state(harness);
  evidence.final = { adapters: s12.playerAdapterCount, slots: s12.slots.map((slot) => slot.state) };
  const step12_stillIsolated =
    s12.playerAdapterCount === 2 &&
    s12.slots.every((slot) => slot.joined) &&
    (snap.listeners as Record<string, number>)['input.adapters'] === 2;

  const passed =
    step1_twoSlots &&
    step2_seated &&
    step3_leftOnly &&
    step4_oppositeIntent &&
    step5_independentRelease &&
    step6_clampedNoCrossTalk &&
    step7_serve &&
    step8_wallBounce &&
    step9_paddleReturn &&
    step10_goal &&
    step11_matchComplete &&
    step12_stillIsolated;

  return {
    passed,
    details: {
      ...evidence,
      step1_twoSlots,
      step2_seated,
      step3_leftOnly,
      step4_oppositeIntent,
      step5_independentRelease,
      step6_clampedNoCrossTalk,
      step7_serve,
      step8_wallBounce,
      step9_paddleReturn,
      step10_goal,
      step11_matchComplete,
      step12_stillIsolated,
    },
  };
}
