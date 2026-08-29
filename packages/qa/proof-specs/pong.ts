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

/**
 * Phase 15 Pong journey - the INPUT FOUNDATION only.
 *
 * There is deliberately no ball, no bounce and no score here: those are Phase 16
 * (`arcade.ball-paddle`). What this proves is the property Phase 16 will be built
 * on and cannot itself establish - two paddles, two isolated channels, and
 * simultaneous opposite intent with no cross-talk.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 1. Two authored slots, nobody seated, cannot start.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = s1;
  const step1_twoSlots =
    snap.scene === 'sw2d.play' &&
    snap.capabilities.includes('input.players') &&
    s1.slots.length === 2 &&
    s1.slots.map((slot) => slot.playerId).join(',') === 'left,right' &&
    s1.canStart === false &&
    s1.playerAdapterCount === 0;

  // 2. Both players seat on disjoint keyboard profiles and the match can start.
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
  evidence.seated = { joinLeft, joinRight, started, slots: s2.slots };
  const step2_seated =
    joinLeft.ok === true &&
    joinRight.ok === true &&
    started === true &&
    s2.phase === 'playing' &&
    s2.playerAdapterCount === 2 &&
    Object.keys(s2.paddles).sort().join(',') === 'left,right' &&
    // requireReady is false in this roster, so joining is enough to start.
    s2.canStart === true;

  const start = await state(harness);

  // 3. Left player moves up while the right paddle stays exactly still.
  await key(harness, 'keydown', 'KeyW');
  await harness.stepFrames(16);
  const s3 = await state(harness);
  evidence.leftOnly = { before: start.paddles, after: s3.paddles };
  const step3_leftOnly =
    s3.paddles['left']!.y < start.paddles['left']!.y &&
    s3.paddles['left']!.moveY === -1 &&
    s3.paddles['right']!.y === start.paddles['right']!.y &&
    s3.paddles['right']!.moveY === 0;

  // 4. Right player moves down at the same time - simultaneous OPPOSITE intent.
  await key(harness, 'keydown', 'ArrowDown');
  await harness.stepFrames(16);
  const s4 = await state(harness);
  evidence.opposite = s4.paddles;
  const step4_oppositeIntent =
    s4.paddles['left']!.moveY === -1 &&
    s4.paddles['right']!.moveY === 1 &&
    s4.oppositeIntent === true &&
    s4.paddles['left']!.y < s3.paddles['left']!.y &&
    s4.paddles['right']!.y > s3.paddles['right']!.y;

  // 5. Releasing one player's key stops only that paddle.
  await key(harness, 'keyup', 'KeyW');
  await harness.stepFrames(10);
  const s5 = await state(harness);
  evidence.releaseLeft = s5.paddles;
  const step5_independentRelease =
    s5.paddles['left']!.moveY === 0 &&
    s5.paddles['right']!.moveY === 1 &&
    s5.paddles['right']!.y > s4.paddles['right']!.y &&
    s5.oppositeIntent === false;

  // 6. The right paddle clamps at the court edge rather than leaving the court -
  //    a movement channel that is genuinely bounded, not just wired.
  await harness.stepFrames(120);
  const s6 = await state(harness);
  await key(harness, 'keyup', 'ArrowDown');
  await harness.stepFrames(4);
  evidence.clamped = s6.paddles;
  const step6_clamped = s6.paddles['right']!.atBottom === true && s6.paddles['left']!.atBottom === false;

  // 7. The right player's key never touched the left paddle at any point.
  const s7 = await state(harness);
  evidence.final = s7.paddles;
  const step7_noCrossTalk =
    s7.paddles['left']!.y === s5.paddles['left']!.y && // untouched since its own release
    s7.paddles['left']!.moveY === 0 &&
    s7.paddles['right']!.moveY === 0;

  const passed =
    step1_twoSlots &&
    step2_seated &&
    step3_leftOnly &&
    step4_oppositeIntent &&
    step5_independentRelease &&
    step6_clamped &&
    step7_noCrossTalk;

  return {
    passed,
    details: {
      ...evidence,
      step1_twoSlots,
      step2_seated,
      step3_leftOnly,
      step4_oppositeIntent,
      step5_independentRelease,
      step6_clamped,
      step7_noCrossTalk,
    },
  };
}
