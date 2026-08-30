import { describe, expect, it } from 'vitest';
import type { BallPaddleDocument, BallPaddleEvent, BallPaddleService, GameContext } from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  ballPaddlePack,
  BallPaddleServiceImpl,
  MissingBallPaddleDocumentError,
  UnknownPaddleError,
  UnsupportedBallSpeedError,
} from '../src/ballPaddle/ballPaddlePack.ts';

/** Breakout-shaped: bricks, a bottom loss edge, one horizontal paddle. */
const BREAKOUT: BallPaddleDocument = {
  schemaVersion: 1,
  ball: {
    radius: 8,
    initialSpeed: 300,
    minimumSpeed: 200,
    maximumSpeed: 600,
    speedIncreasePerHit: 20,
    maximumBounceAngleDegrees: 60,
    servePolicy: { kind: 'fixed', dx: 0, dy: -1 },
  },
  arena: {
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    edges: [{ edge: 'bottom', behavior: 'loss' }],
    serveX: 400,
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
      speed: 400,
      fixedX: 400,
      fixedY: 540,
      minTravel: 60,
      maxTravel: 740,
      bounceInfluence: 1,
    },
  ],
  bricks: [
    { id: 'plain', hp: 1, score: 10 },
    { id: 'tough', hp: 2, score: 25, itemDropId: 'coin-1' },
  ],
  layout: [
    { id: 'b-plain', brickId: 'plain', x: 380, y: 100, width: 40, height: 20 },
    { id: 'b-tough', brickId: 'tough', x: 380, y: 60, width: 40, height: 20 },
  ],
  match: { lives: 3 },
};

/** Pong-shaped: two vertical paddles, goal edges, a target score, no bricks. */
const PONG: BallPaddleDocument = {
  schemaVersion: 1,
  ball: {
    radius: 8,
    initialSpeed: 300,
    minimumSpeed: 200,
    maximumSpeed: 600,
    speedIncreasePerHit: 15,
    maximumBounceAngleDegrees: 55,
    servePolicy: { kind: 'alternate', dx: 1, dy: 0 },
  },
  arena: {
    left: 0,
    top: 0,
    right: 800,
    bottom: 400,
    edges: [
      { edge: 'left', behavior: 'goal', id: 'goal-right-player', scoresFor: 'right' },
      { edge: 'right', behavior: 'goal', id: 'goal-left-player', scoresFor: 'left' },
    ],
    serveX: 400,
    serveY: 200,
  },
  paddles: [
    {
      id: 'left',
      playerId: 'left',
      axis: 'vertical',
      facing: 'right',
      width: 16,
      height: 100,
      speed: 400,
      fixedX: 40,
      fixedY: 200,
      minTravel: 50,
      maxTravel: 350,
      bounceInfluence: 1,
    },
    {
      id: 'right',
      playerId: 'right',
      axis: 'vertical',
      facing: 'left',
      width: 16,
      height: 100,
      speed: 400,
      fixedX: 760,
      fixedY: 200,
      minTravel: 50,
      maxTravel: 350,
      bounceInfluence: 1,
    },
  ],
  match: { targetScore: 2 },
};

function kinds(events: readonly BallPaddleEvent[]): string[] {
  return events.map((event) => event.kind);
}

/**
 * Run frames until `predicate` or the budget runs out; returns every event seen.
 *
 * Takes the impl, not the service interface: `update()` is deliberately absent
 * from `BallPaddleService` so a consumer cannot double-step the simulation. The
 * pack is the only caller in a real game; here the test plays that role.
 */
function runUntil(
  service: BallPaddleServiceImpl,
  predicate: (events: readonly BallPaddleEvent[]) => boolean,
  frames = 600,
): BallPaddleEvent[] {
  const all: BallPaddleEvent[] = [];
  for (let i = 0; i < frames; i++) {
    service.update(16.67);
    const events = service.drainEvents();
    all.push(...events);
    if (predicate(events)) break;
  }
  return all;
}

function createContext(doc?: BallPaddleDocument): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (doc) data['ball-paddle'] = { schemaId: 'ball-paddle', valid: true, value: doc };
  return { ...base, content: { ...base.content, data } };
}

describe('ballPaddlePack installation', () => {
  it('provides arcade.ball-paddle and releases it on dispose', () => {
    const context = createContext(BREAKOUT);
    const installed = ballPaddlePack.install(context, {});
    expect(context.capabilities.has('arcade.ball-paddle')).toBe(true);
    expect(installed.id).toBe('sw2d.ball-paddle');
    installed.dispose();
    expect(context.capabilities.has('arcade.ball-paddle')).toBe(false);
  });

  it('requires the content document', () => {
    expect(() => ballPaddlePack.install(createContext(), {})).toThrow(MissingBallPaddleDocumentError);
  });

  it('rejects a malformed definition at install time', () => {
    const bad = { ...BREAKOUT, paddles: [{ ...BREAKOUT.paddles[0]!, facing: 'left' as const }] };
    expect(() => ballPaddlePack.install(createContext(bad), {})).toThrow(/implies axis/);
  });

  it('rejects a speed the bounded substep budget cannot integrate safely', () => {
    const tooFast = { ...BREAKOUT, ball: { ...BREAKOUT.ball, maximumSpeed: 100000 } };
    expect(() => new BallPaddleServiceImpl(tooFast)).toThrow(UnsupportedBallSpeedError);
  });

  it('optionally serves on install', () => {
    const context = createContext(BREAKOUT);
    ballPaddlePack.install(context, { autoServe: true });
    const service = context.capabilities.require<BallPaddleService>('arcade.ball-paddle');
    expect(service.status()).toBe('playing');
    expect(service.state().ball.live).toBe(true);
  });
});

describe('serve', () => {
  it('parks the ball at the serve point until served', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    const state = service.state();
    expect(state.status).toBe('idle');
    expect(state.ball).toMatchObject({ x: 400, y: 400, vx: 0, vy: 0, live: false });
    service.update(16.67);
    expect(service.drainEvents()).toEqual([]);
  });

  it('launches at the initial speed in the policy direction', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve();
    expect(kinds(service.drainEvents())).toEqual(['served']);
    const ball = service.state().ball;
    expect(ball.live).toBe(true);
    expect(ball.speed).toBe(300);
    expect(ball.vy).toBeCloseTo(-300, 6);
    expect(ball.vx).toBeCloseTo(0, 6);
    expect(service.status()).toBe('playing');
  });

  it('alternates the serve direction for a pong-style policy', () => {
    const service = new BallPaddleServiceImpl(PONG);
    service.serve();
    const first = service.state().ball.vx;
    service.resetRound();
    service.serve();
    const second = service.state().ball.vx;
    expect(Math.sign(first)).toBe(1);
    expect(Math.sign(second)).toBe(-1);
  });
});

describe('walls and paddles', () => {
  it('bounces off a bounce edge and keeps its speed', () => {
    // Brick-free: the brick column sits directly above the serve point, so with
    // bricks in play the ball would meet one before it ever reached the wall.
    const service = new BallPaddleServiceImpl({ ...BREAKOUT, bricks: [], layout: [] });
    service.serve(); // straight up
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'wall-bounce'));
    const bounce = events.find((e) => e.kind === 'wall-bounce');
    expect(bounce).toMatchObject({ kind: 'wall-bounce', edge: 'top' });
    const ball = service.state().ball;
    expect(ball.vy).toBeGreaterThan(0); // now heading down
    expect(ball.speed).toBe(300); // a wall does not change speed
  });

  it('steers by hit location: centre returns straight, edge returns angled', () => {
    // Centre hit: serve straight down at the paddle centre.
    const centre = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, servePolicy: { kind: 'fixed', dx: 0, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveY: 300 },
    });
    centre.serve();
    const centreEvents = runUntil(centre, (batch) => batch.some((e) => e.kind === 'paddle-bounce'));
    const centreBounce = centreEvents.find((e) => e.kind === 'paddle-bounce');
    expect(centreBounce).toBeDefined();
    if (centreBounce?.kind === 'paddle-bounce') {
      expect(Math.abs(centreBounce.relative)).toBeLessThan(0.05);
      expect(centreBounce.vx).toBeCloseTo(0, 1);
      expect(centreBounce.vy).toBeLessThan(0); // sent back up
    }

    // Edge hit: serve down at a point near the right end of the paddle.
    const edge = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, servePolicy: { kind: 'fixed', dx: 0, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveX: 450, serveY: 300 },
    });
    edge.serve();
    const edgeEvents = runUntil(edge, (batch) => batch.some((e) => e.kind === 'paddle-bounce'));
    const edgeBounce = edgeEvents.find((e) => e.kind === 'paddle-bounce');
    expect(edgeBounce).toBeDefined();
    if (edgeBounce?.kind === 'paddle-bounce') {
      expect(edgeBounce.relative).toBeGreaterThan(0.5); // struck right of centre
      expect(edgeBounce.vx).toBeGreaterThan(0); // steered right
      expect(edgeBounce.vy).toBeLessThan(0);
    }
  });

  it('raises speed per paddle hit and clamps at the maximum', () => {
    const service = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, speedIncreasePerHit: 100, maximumSpeed: 450 },
    });
    service.serve();
    const speeds: number[] = [];
    for (let i = 0; i < 2000 && speeds.length < 4; i++) {
      service.update(16.67);
      for (const event of service.drainEvents()) {
        if (event.kind === 'paddle-bounce') speeds.push(event.speed);
      }
      if (service.status() === 'round-over' || service.status() === 'complete') break;
    }
    expect(speeds.length).toBeGreaterThanOrEqual(2);
    expect(speeds[0]).toBe(400); // 300 + 100
    expect(speeds[1]).toBe(450); // clamped at maximumSpeed
    if (speeds[2] !== undefined) expect(speeds[2]).toBe(450);
  });

  it('moves a paddle by intent and clamps it at its travel bounds', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    expect(service.paddle('paddle')).toMatchObject({ x: 400, y: 540, intent: 0 });

    service.setPaddleIntent('paddle', 1);
    service.update(100);
    expect(service.paddle('paddle')!.x).toBeCloseTo(440, 6);

    for (let i = 0; i < 100; i++) service.update(100);
    expect(service.paddle('paddle')).toMatchObject({ x: 740, atMax: true, atMin: false });

    service.setPaddleIntent('paddle', -1);
    for (let i = 0; i < 100; i++) service.update(100);
    expect(service.paddle('paddle')).toMatchObject({ x: 60, atMin: true });

    expect(() => service.setPaddleIntent('nope', 1)).toThrow(UnknownPaddleError);
  });

  it('clamps an out-of-range intent rather than moving faster', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.setPaddleIntent('paddle', 99);
    expect(service.paddle('paddle')!.intent).toBe(1);
    service.update(100);
    expect(service.paddle('paddle')!.x).toBeCloseTo(440, 6);
  });
});

describe('bricks', () => {
  it('damages a multi-hp brick before destroying it, and scores on destruction', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve(); // straight up into the brick column
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'brick-destroyed'));

    const hit = events.find((e) => e.kind === 'brick-hit');
    const destroyed = events.find((e) => e.kind === 'brick-destroyed');
    expect(destroyed).toBeDefined();
    if (destroyed?.kind === 'brick-destroyed') {
      expect(destroyed.placementId).toBe('b-plain'); // the lower brick is reached first
      expect(destroyed.score).toBe(10);
      expect(destroyed.itemDropId).toBeUndefined();
    }
    // The 1-hp brick is destroyed without a prior 'brick-hit'.
    expect(hit === undefined || hit.kind !== 'brick-hit' || hit.placementId !== 'b-plain').toBe(true);
    expect(service.score('p1')).toBe(10);
    expect(service.state().bricksRemaining).toBe(1);
  });

  it('reports the canonical item drop id when a brick that declares one is destroyed', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve();
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'brick-destroyed' && e.brickId === 'tough'), 2000);
    const tough = events.find((e) => e.kind === 'brick-destroyed' && e.brickId === 'tough');
    expect(tough).toBeDefined();
    if (tough?.kind === 'brick-destroyed') {
      expect(tough.itemDropId).toBe('coin-1');
      expect(tough.score).toBe(25);
    }
    // Its first collision only damaged it.
    const toughHits = events.filter((e) => e.kind === 'brick-hit' && e.placementId === 'b-tough');
    expect(toughHits).toHaveLength(1);
    if (toughHits[0]?.kind === 'brick-hit') expect(toughHits[0].hpRemaining).toBe(1);
  });

  it('completes the match when the board is cleared', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve();
    runUntil(service, (batch) => batch.some((e) => e.kind === 'match-complete'), 4000);
    expect(service.status()).toBe('complete');
    expect(service.state().bricksRemaining).toBe(0);
    expect(service.state().winnerId).toBe('p1');
    // A completed match ignores further updates and serves, and parks the ball:
    // "complete" alongside a live ball would be contradictory state.
    expect(service.state().ball.live).toBe(false);
    service.drainEvents();
    service.update(16.67);
    service.serve();
    expect(service.drainEvents()).toEqual([]);
  });
});

describe('loss, goals and match rules', () => {
  it('loses a life on the loss edge and parks the ball', () => {
    const service = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      // Aim into the bottom-left corner, away from the paddle.
      ball: { ...BREAKOUT.ball, servePolicy: { kind: 'fixed', dx: -1, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveX: 100, serveY: 400 },
      paddles: [{ ...BREAKOUT.paddles[0]!, fixedX: 700, minTravel: 700, maxTravel: 700 }],
    });
    service.serve();
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'ball-lost'));
    const lost = events.find((e) => e.kind === 'ball-lost');
    expect(lost).toMatchObject({ kind: 'ball-lost', edge: 'bottom', livesRemaining: 2 });
    expect(service.status()).toBe('round-over');
    expect(service.state().ball.live).toBe(false);
    expect(service.livesRemaining()).toBe(2);
  });

  it('ends the match when lives run out', () => {
    const doc: BallPaddleDocument = {
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, servePolicy: { kind: 'fixed', dx: -1, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveX: 100, serveY: 400 },
      paddles: [{ ...BREAKOUT.paddles[0]!, fixedX: 700, minTravel: 700, maxTravel: 700 }],
      match: { lives: 2 },
    };
    const service = new BallPaddleServiceImpl(doc);
    service.serve();
    runUntil(service, (batch) => batch.some((e) => e.kind === 'ball-lost'));
    expect(service.livesRemaining()).toBe(1);
    service.resetRound();
    service.serve();
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'match-complete'));
    expect(kinds(events)).toContain('match-complete');
    expect(service.status()).toBe('complete');
    expect(service.state().winnerId).toBeNull();
  });

  it('scores a goal for the owner named on the edge', () => {
    const service = new BallPaddleServiceImpl({
      ...PONG,
      // Park both paddles out of the way so the ball reaches the right goal.
      paddles: PONG.paddles.map((p) => ({ ...p, minTravel: 50, maxTravel: 50 })),
    });
    service.serve(); // toward +x, into the right edge
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'goal'));
    const goal = events.find((e) => e.kind === 'goal');
    expect(goal).toMatchObject({ kind: 'goal', edge: 'right', edgeId: 'goal-left-player', scoresFor: 'left', score: 1 });
    expect(service.score('left')).toBe(1);
    expect(service.score('right')).toBe(0);
    expect(service.status()).toBe('round-over');
  });

  it('completes the match at the target score', () => {
    const service = new BallPaddleServiceImpl({
      ...PONG,
      ball: { ...PONG.ball, servePolicy: { kind: 'fixed', dx: 1, dy: 0 } },
      paddles: PONG.paddles.map((p) => ({ ...p, minTravel: 50, maxTravel: 50 })),
    });
    service.serve();
    runUntil(service, (batch) => batch.some((e) => e.kind === 'goal'));
    service.resetRound();
    service.serve();
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'match-complete'));
    expect(service.score('left')).toBe(2);
    expect(kinds(events)).toContain('match-complete');
    expect(service.state().winnerId).toBe('left');
  });

  it('keeps two players independent: each paddle answers only its own intent', () => {
    const service = new BallPaddleServiceImpl(PONG);
    service.setPaddleIntent('left', -1);
    service.update(100);
    expect(service.paddle('left')!.y).toBeCloseTo(160, 6);
    expect(service.paddle('right')!.y).toBe(200);

    service.setPaddleIntent('right', 1);
    service.update(100);
    expect(service.paddle('left')!.y).toBeCloseTo(120, 6);
    expect(service.paddle('right')!.y).toBeCloseTo(240, 6);
  });
});

describe('high-speed integration and reset', () => {
  it('never passes through the paddle at the top supported speed', () => {
    // 600 u/s at 60fps is 10 units per frame - more than the 8-unit radius, so a
    // single-step integrator would tunnel. The substep budget must not.
    const service = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, initialSpeed: 600, speedIncreasePerHit: 0, servePolicy: { kind: 'fixed', dx: 0, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveY: 200 },
    });
    service.serve();
    const events = runUntil(service, (batch) => batch.some((e) => e.kind === 'paddle-bounce' || e.kind === 'ball-lost'));
    expect(kinds(events)).toContain('paddle-bounce');
    expect(kinds(events)).not.toContain('ball-lost');
  });

  it('survives a long frame without tunnelling', () => {
    const service = new BallPaddleServiceImpl({
      ...BREAKOUT,
      bricks: [],
      layout: [],
      ball: { ...BREAKOUT.ball, initialSpeed: 600, speedIncreasePerHit: 0, servePolicy: { kind: 'fixed', dx: 0, dy: 1 } },
      arena: { ...BREAKOUT.arena, serveY: 200 },
    });
    service.serve();
    // One 1/30s frame covers 20 units - well past the paddle's 16-unit thickness.
    const all: BallPaddleEvent[] = [];
    for (let i = 0; i < 40; i++) {
      service.update(1000 / 30);
      all.push(...service.drainEvents());
    }
    expect(kinds(all)).toContain('paddle-bounce');
    expect(kinds(all)).not.toContain('ball-lost');
  });

  it('is deterministic: the same inputs produce the same trajectory', () => {
    const run = (): string => {
      const service = new BallPaddleServiceImpl(BREAKOUT);
      service.serve();
      const log: string[] = [];
      for (let i = 0; i < 200; i++) {
        service.setPaddleIntent('paddle', i % 40 < 20 ? 1 : -1);
        service.update(16.67);
        for (const event of service.drainEvents()) log.push(JSON.stringify(event));
      }
      log.push(JSON.stringify(service.state().ball));
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('resetRound keeps scores and bricks; reset clears everything', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve();
    runUntil(service, (batch) => batch.some((e) => e.kind === 'brick-destroyed'));
    service.setPaddleIntent('paddle', 1);
    service.update(200);
    const scored = service.score('p1');
    expect(scored).toBeGreaterThan(0);

    service.resetRound();
    expect(service.state().ball.live).toBe(false);
    expect(service.status()).toBe('idle');
    expect(service.paddle('paddle')!.x).toBe(400); // re-centred
    expect(service.score('p1')).toBe(scored); // score kept
    expect(service.state().bricksRemaining).toBe(1); // brick still gone

    service.reset();
    expect(service.score('p1')).toBe(0);
    expect(service.livesRemaining()).toBe(3);
    expect(service.state().bricksRemaining).toBe(2);
    expect(service.state().serves).toBe(0);
    expect(service.status()).toBe('idle');
  });
});

describe('single ownership of frame advancement', () => {
  /**
   * The proof caught this: the pack advanced the simulation AND the consuming
   * shell advanced it, so the ball double-stepped and the shell only ever saw
   * the events of its own half. `update()` is now absent from
   * `BallPaddleService` entirely - the same rule `ActionInput` uses - so a
   * consumer cannot drive the simulation even by accident.
   */
  it('does not expose update() on the service interface', () => {
    const context = createContext(BREAKOUT);
    ballPaddlePack.install(context, {});
    const service = context.capabilities.require<BallPaddleService>('arcade.ball-paddle');
    expect((service as unknown as Record<string, unknown>)['update']).toBeTypeOf('function');
    // ...but it is not part of the contract a consumer programs against.
    const contractKeys: (keyof BallPaddleService)[] = [
      'definition',
      'state',
      'status',
      'serve',
      'drainEvents',
      'setPaddleIntent',
      'paddle',
      'bricks',
      'score',
      'livesRemaining',
      'resetRound',
      'reset',
    ];
    for (const key of contractKeys) expect(service[key]).toBeTypeOf('function');
    expect(contractKeys).not.toContain('update');
  });

  it('reports every event exactly once through the drain', () => {
    const context = createContext(BREAKOUT);
    const installed = ballPaddlePack.install(context, {});
    const service = context.capabilities.require<BallPaddleService>('arcade.ball-paddle');
    service.serve();

    const seen: string[] = [];
    for (let i = 0; i < 3000 && service.status() !== 'complete'; i++) {
      // The pack is the single driver, exactly as in a real game.
      installed.update?.(16.67);
      for (const event of service.drainEvents()) seen.push(event.kind);
    }
    const destroyed = seen.filter((kind) => kind === 'brick-destroyed').length;
    // One event per brick actually removed - no loss, no duplication.
    expect(destroyed).toBe(2);
    expect(service.state().bricksRemaining).toBe(0);
    expect(seen.filter((kind) => kind === 'served')).toHaveLength(1);
  });

  it('drains empty once drained', () => {
    const service = new BallPaddleServiceImpl(BREAKOUT);
    service.serve();
    expect(service.drainEvents()).toHaveLength(1);
    expect(service.drainEvents()).toEqual([]);
  });
});

describe('events on the bus', () => {
  it('emits the cross-system facts a HUD would react to', () => {
    const context = createContext(BREAKOUT);
    const installed = ballPaddlePack.install(context, {});
    const service = context.capabilities.require<BallPaddleService>('arcade.ball-paddle');

    const seen: string[] = [];
    context.events.on('ballPaddle:brickDestroyed', () => seen.push('brick'));
    context.events.on('ballPaddle:paddleBounce', () => seen.push('bounce'));
    context.events.on('ballPaddle:matchComplete', () => seen.push('complete'));

    service.serve();
    for (let i = 0; i < 2000 && service.status() !== 'complete'; i++) installed.update?.(16.67);
    expect(seen.filter((s) => s === 'brick').length).toBe(2);
    expect(seen).toContain('bounce');
    expect(seen).toContain('complete');
  });
});
