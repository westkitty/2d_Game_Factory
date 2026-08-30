import { describe, expect, it } from 'vitest';
import {
  BALL_PADDLE_CAPABILITY_ID,
  InvalidBallPaddleError,
  axisForFacing,
  createRng,
  normalForFacing,
  paddleBounceDirection,
  paddleHitOffset,
  serveDirection,
  validateBallPaddleDocument,
  type BallPaddleDocument,
} from '../src/index.ts';

const BASE: BallPaddleDocument = {
  schemaVersion: 1,
  ball: {
    radius: 8,
    initialSpeed: 300,
    minimumSpeed: 200,
    maximumSpeed: 700,
    speedIncreasePerHit: 20,
    maximumBounceAngleDegrees: 60,
    servePolicy: { kind: 'fixed', dx: 1, dy: -1 },
  },
  arena: {
    left: 0,
    top: 0,
    right: 960,
    bottom: 540,
    edges: [{ edge: 'bottom', behavior: 'loss' }],
    serveX: 480,
    serveY: 400,
  },
  paddles: [
    {
      id: 'paddle',
      playerId: 'p1',
      axis: 'horizontal',
      facing: 'up',
      width: 120,
      height: 16,
      speed: 500,
      fixedX: 480,
      fixedY: 500,
      minTravel: 60,
      maxTravel: 900,
      bounceInfluence: 1,
    },
  ],
};

describe('ball/paddle contract', () => {
  it('publishes the Phase 16 capability id', () => {
    expect(BALL_PADDLE_CAPABILITY_ID).toBe('arcade.ball-paddle');
  });

  it('derives the travel axis and bounce normal from a paddle facing', () => {
    expect(axisForFacing('left')).toBe('vertical');
    expect(axisForFacing('right')).toBe('vertical');
    expect(axisForFacing('up')).toBe('horizontal');
    expect(axisForFacing('down')).toBe('horizontal');
    expect(normalForFacing('up')).toEqual({ nx: 0, ny: -1 });
    expect(normalForFacing('right')).toEqual({ nx: 1, ny: 0 });
  });
});

describe('paddleHitOffset', () => {
  const horizontal = { axis: 'horizontal' as const, width: 100, height: 16 };
  const vertical = { axis: 'vertical' as const, width: 16, height: 100 };

  it('is 0 at the centre and +/-1 at the ends', () => {
    expect(paddleHitOffset(horizontal, 200, 400, 200, 400)).toBe(0);
    expect(paddleHitOffset(horizontal, 200, 400, 250, 400)).toBe(1);
    expect(paddleHitOffset(horizontal, 200, 400, 150, 400)).toBe(-1);
  });

  it('measures along the paddle travel axis, not across it', () => {
    // A vertical paddle steers by where the ball hit it in Y.
    expect(paddleHitOffset(vertical, 80, 300, 80, 325)).toBe(0.5);
    // Moving in X on a vertical paddle changes nothing.
    expect(paddleHitOffset(vertical, 80, 300, 400, 300)).toBe(0);
  });

  it('clamps a hit beyond the paddle end', () => {
    expect(paddleHitOffset(horizontal, 200, 400, 900, 400)).toBe(1);
    expect(paddleHitOffset(horizontal, 200, 400, -900, 400)).toBe(-1);
  });
});

describe('paddleBounceDirection', () => {
  it('returns the paddle normal for a dead-centre hit', () => {
    expect(paddleBounceDirection('up', 0, 60)).toEqual({ dx: 0, dy: -1 });
    const right = paddleBounceDirection('right', 0, 60);
    expect(right.dx).toBeCloseTo(1, 10);
    expect(right.dy).toBeCloseTo(0, 10);
  });

  it('steers toward the side that was struck, for every facing', () => {
    // Breakout paddle: hit right of centre goes up-and-right.
    const up = paddleBounceDirection('up', 1, 60);
    expect(up.dx).toBeGreaterThan(0);
    expect(up.dy).toBeLessThan(0);
    // Pong left paddle: hit below centre goes right-and-down.
    const rightFacing = paddleBounceDirection('right', 1, 60);
    expect(rightFacing.dx).toBeGreaterThan(0);
    expect(rightFacing.dy).toBeGreaterThan(0);
    // Pong right paddle: hit below centre goes left-and-down.
    const leftFacing = paddleBounceDirection('left', 1, 60);
    expect(leftFacing.dx).toBeLessThan(0);
    expect(leftFacing.dy).toBeGreaterThan(0);
  });

  it('always returns a unit vector', () => {
    for (const relative of [-1, -0.4, 0, 0.4, 1]) {
      for (const facing of ['left', 'right', 'up', 'down'] as const) {
        const out = paddleBounceDirection(facing, relative, 60);
        expect(Math.hypot(out.dx, out.dy)).toBeCloseTo(1, 10);
      }
    }
  });

  it('never sends the ball parallel to the paddle face', () => {
    // The 80-degree cap is the degenerate-trajectory prevention: the component
    // along the normal stays above cos(80 deg) for any input.
    for (const relative of [-1, 1]) {
      const out = paddleBounceDirection('up', relative, 999);
      expect(Math.abs(out.dy)).toBeGreaterThan(Math.cos((80.5 * Math.PI) / 180));
    }
  });

  it('scales steering by bounceInfluence, and 0 makes a flat mirror', () => {
    const full = paddleBounceDirection('up', 1, 60, 1);
    const half = paddleBounceDirection('up', 1, 60, 0.5);
    const none = paddleBounceDirection('up', 1, 60, 0);
    expect(half.dx).toBeGreaterThan(0);
    expect(half.dx).toBeLessThan(full.dx);
    expect(none).toEqual({ dx: 0, dy: -1 });
  });
});

describe('serveDirection', () => {
  it('returns the same normalised direction every time for a fixed policy', () => {
    const policy = { kind: 'fixed', dx: 3, dy: -4 } as const;
    const first = serveDirection(policy, 0, createRng);
    const later = serveDirection(policy, 7, createRng);
    expect(first).toEqual(later);
    expect(Math.hypot(first.dx, first.dy)).toBeCloseTo(1, 10);
    expect(first.dx).toBeCloseTo(0.6, 10);
  });

  it('flips the dominant axis on alternate serves', () => {
    const policy = { kind: 'alternate', dx: 1, dy: 0.2 } as const;
    const even = serveDirection(policy, 0, createRng);
    const odd = serveDirection(policy, 1, createRng);
    expect(Math.sign(even.dx)).toBe(1);
    expect(Math.sign(odd.dx)).toBe(-1);
    // The non-dominant axis is untouched, so the serve is not mirrored twice.
    expect(odd.dy).toBeCloseTo(even.dy, 10);
  });

  it('is deterministic and index-varying for a seeded policy', () => {
    const policy = { kind: 'seeded-direction', dx: 1, dy: 0, seed: 1234, spreadDegrees: 30 } as const;
    const a1 = serveDirection(policy, 0, createRng);
    const a2 = serveDirection(policy, 0, createRng);
    const b = serveDirection(policy, 1, createRng);
    expect(a1).toEqual(a2); // same index, same result
    expect(a1).not.toEqual(b); // successive serves differ
    expect(Math.hypot(a1.dx, a1.dy)).toBeCloseTo(1, 10);
    // Inside the authored cone.
    expect(Math.abs(Math.atan2(a1.dy, a1.dx))).toBeLessThanOrEqual((30 * Math.PI) / 180 + 1e-9);
  });
});

describe('validateBallPaddleDocument', () => {
  it('accepts a well-formed document', () => {
    expect(() => validateBallPaddleDocument(BASE)).not.toThrow();
  });

  it('rejects inconsistent speed bounds', () => {
    expect(() =>
      validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, minimumSpeed: 800 } }),
    ).toThrow(/minimumSpeed/);
    expect(() =>
      validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, initialSpeed: 50 } }),
    ).toThrow(/initialSpeed/);
    expect(() => validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, radius: 0 } })).toThrow(/radius/);
  });

  it('rejects a bounce angle that would send the ball along the paddle face', () => {
    expect(() =>
      validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, maximumBounceAngleDegrees: 89 } }),
    ).toThrow(/parallel to its own face/);
    expect(() =>
      validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, maximumBounceAngleDegrees: 0 } }),
    ).toThrow(InvalidBallPaddleError);
  });

  it('rejects a paddle whose declared axis disagrees with its facing', () => {
    expect(() =>
      validateBallPaddleDocument({
        ...BASE,
        paddles: [{ ...BASE.paddles[0]!, facing: 'left' }],
      }),
    ).toThrow(/implies axis "vertical", but declares "horizontal"/);
  });

  it('rejects duplicate paddle ids, bad travel bounds and out-of-range influence', () => {
    expect(() =>
      validateBallPaddleDocument({ ...BASE, paddles: [BASE.paddles[0]!, BASE.paddles[0]!] }),
    ).toThrow(/Duplicate paddle id/);
    expect(() =>
      validateBallPaddleDocument({ ...BASE, paddles: [{ ...BASE.paddles[0]!, minTravel: 900, maxTravel: 60 }] }),
    ).toThrow(/minTravel/);
    expect(() =>
      validateBallPaddleDocument({ ...BASE, paddles: [{ ...BASE.paddles[0]!, bounceInfluence: 2 }] }),
    ).toThrow(/bounceInfluence/);
  });

  it('rejects a layout that references an unknown brick', () => {
    expect(() =>
      validateBallPaddleDocument({
        ...BASE,
        bricks: [{ id: 'plain', hp: 1, score: 10 }],
        layout: [{ id: 'b1', brickId: 'missing', x: 0, y: 0, width: 40, height: 20 }],
      }),
    ).toThrow(/unknown brick "missing"/);
  });

  it('rejects a serve point outside the arena, and a zero serve direction', () => {
    expect(() =>
      validateBallPaddleDocument({ ...BASE, arena: { ...BASE.arena, serveX: 5000 } }),
    ).toThrow(/serve point/);
    expect(() =>
      validateBallPaddleDocument({ ...BASE, ball: { ...BASE.ball, servePolicy: { kind: 'fixed', dx: 0, dy: 0 } } }),
    ).toThrow(/non-zero/);
  });

  it('rejects duplicate arena edge rules and degenerate bounds', () => {
    expect(() =>
      validateBallPaddleDocument({
        ...BASE,
        arena: { ...BASE.arena, edges: [{ edge: 'top', behavior: 'bounce' }, { edge: 'top', behavior: 'loss' }] },
      }),
    ).toThrow(/Duplicate arena edge rule/);
    expect(() => validateBallPaddleDocument({ ...BASE, arena: { ...BASE.arena, right: 0 } })).toThrow(/positive width/);
  });

  it('rejects invalid brick hp/score and match rules', () => {
    expect(() =>
      validateBallPaddleDocument({ ...BASE, bricks: [{ id: 'b', hp: 0, score: 1 }] }),
    ).toThrow(/hp must be an integer/);
    expect(() => validateBallPaddleDocument({ ...BASE, match: { lives: 0 } })).toThrow(/lives/);
    expect(() => validateBallPaddleDocument({ ...BASE, match: { targetScore: 0 } })).toThrow(/targetScore/);
  });
});
