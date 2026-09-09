import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { BallPaddleCatalog, BallPaddleService, GameContext } from '@sw2d/contracts';
import { BALL_PADDLE_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { ballPaddlePack } from '../src/ballPaddle/ballPaddlePack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const BREAKOUT: BallPaddleCatalog = {
  schemaVersion: 1,
  mode: 'breakout',
  court: { width: 960, height: 540 },
  paddle: { x: 480, y: 485, width: 150, height: 22, speed: 340, axis: 'x', min: 85, max: 875, hitHalf: 86 },
  ball: { x: 480, y: 270, vx: 180, vy: -180, radius: 18 },
  walls: { insetX: 12, top: 50, bottom: 522 },
  bricks: [
    { id: 'brick-0-0', x: 260, y: 105, halfWidth: 42, halfHeight: 22 },
    { id: 'brick-0-1', x: 342, y: 105, halfWidth: 42, halfHeight: 22 },
  ],
  lives: 3,
  breakout: {
    contactDivisor: 65,
    contactScale: 72,
    moveScale: 24,
    minSpeedX: 105,
    maxSpeedX: 220,
    parkOffset: 24,
    serveSpeed: 180,
    contactNear: 25,
    contactFar: 12,
    brickScore: 10,
  },
};

const PONG: BallPaddleCatalog = {
  schemaVersion: 1,
  mode: 'pong',
  court: { width: 960, height: 540 },
  paddle: { x: 55, y: 270, width: 22, height: 110, speed: 260, axis: 'y', min: 70, max: 470, hitHalf: 70 },
  ball: { x: 480, y: 270, vx: 210, vy: 145, radius: 18 },
  walls: { insetX: 0, top: 18, bottom: 522 },
  bricks: [],
  lives: 0,
  pong: {
    opponentX: 905,
    opponentY: 270,
    opponentWidth: 22,
    opponentHeight: 110,
    opponentHitHalf: 70,
    lerpMs: 300,
    playerMinX: 35,
    playerMaxX: 75,
    opponentMinX: 885,
    opponentMaxX: 925,
    speedBump: 8,
    serveSpeed: 210,
    scorePast: 20,
    winScore: 3,
  },
};

function install(catalog?: BallPaddleCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { 'ball-paddle': { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = ballPaddlePack.install(ctx, undefined);
  const table = capabilities.require<BallPaddleService>(BALL_PADDLE_CAPABILITY_ID);
  return { events, capabilities, installed, table };
}

describe('sw2d.ball-paddle - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(BALL_PADDLE_CAPABILITY_ID).toBe(CAPABILITY_IDS.ballPaddle);
    expect(ballPaddlePack.provides).toEqual([BALL_PADDLE_CAPABILITY_ID]);
  });
});

describe('sw2d.ball-paddle - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ 'ball-paddle': BREAKOUT })).not.toThrow();
    expect(() => validateContentBundleData({ 'ball-paddle': PONG })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ 'ball-paddle': { ...BREAKOUT, mode: 'pinball' } })).toThrow();
  });
});

describe('sw2d.ball-paddle - breakout', () => {
  it('a descending ball on the paddle returns upward', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      ball: { x: 480, y: 470, vx: 40, vy: 180, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(16);
    expect(table.ball().vy).toBeLessThan(0);
    expect(table.paddleReturns()).toBe(1);
    expect(table.lastResult()).toBe('paddle-return');
    expect(table.outcome()).toBe('playing');
  });

  it('overlapping a brick breaks it, scores, and reverses vy', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      ball: { x: 260, y: 105, vx: 0, vy: 40, radius: 18 },
    };
    const { table } = install(catalog);
    expect(table.bricksRemaining()).toBe(2);
    table.tick(0);
    expect(table.bricksRemaining()).toBe(1);
    expect(table.score()).toBe(10);
    expect(table.lastResult()).toBe('brick');
    expect(table.ball().vy).toBe(-40);
  });

  it('clearing the last brick completes', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      bricks: [{ id: 'only', x: 260, y: 105, halfWidth: 42, halfHeight: 22 }],
      ball: { x: 260, y: 105, vx: 10, vy: -10, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.bricksRemaining()).toBe(0);
    expect(table.outcome()).toBe('complete');
    expect(table.ball().vx).toBe(0);
    expect(table.ball().vy).toBe(0);
  });

  it('draining past the court costs a life and serves again', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      ball: { x: 480, y: 580, vx: 0, vy: 180, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(16);
    expect(table.lives()).toBe(2);
    expect(table.lastResult()).toBe('drain');
    expect(table.outcome()).toBe('playing');
    expect(table.ball().x).toBe(480);
    expect(table.ball().y).toBe(270);
    expect(table.ball().vy).toBe(-180);
  });

  it('the last drain fails the table', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      lives: 1,
      ball: { x: 480, y: 580, vx: 0, vy: 180, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(16);
    expect(table.lives()).toBe(0);
    expect(table.outcome()).toBe('failed');
    expect(table.ball().vx).toBe(0);
  });

  it('the paddle clamps to its min/max', () => {
    const { table } = install(BREAKOUT);
    table.setPaddleAxis(-1);
    table.tick(10_000);
    expect(table.paddle().x).toBe(85);
    table.setPaddleAxis(1);
    table.tick(10_000);
    expect(table.paddle().x).toBe(875);
  });
});

describe('sw2d.ball-paddle - pong', () => {
  it('a ball in the player gate with vx<0 returns right', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      paddle: { ...PONG.paddle, y: 270 },
      ball: { x: 50, y: 270, vx: -210, vy: 0, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.ball().vx).toBeGreaterThan(0);
    expect(table.lastResult()).toBe('player-return');
    expect(table.paddleReturns()).toBe(1);
  });

  it('the opponent gate reverses a rightward ball', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      ball: { x: 900, y: 270, vx: 210, vy: 0, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.ball().vx).toBeLessThan(0);
    expect(table.lastResult()).toBeNull();
  });

  it('a ball past the left edge is an opponent point and a rightward serve', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      ball: { x: -40, y: 270, vx: -210, vy: 40, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.opponentScore()).toBe(1);
    expect(table.outcome()).toBe('playing');
    expect(table.ball().x).toBe(480);
    expect(table.ball().y).toBe(270);
    expect(table.ball().vx).toBe(210);
    expect(table.ball().vy).toBe(40);
  });

  it('reaching winScore on the opponent fails the match', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      pong: { ...PONG.pong!, winScore: 1 },
      ball: { x: -40, y: 270, vx: -210, vy: 40, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.opponentScore()).toBe(1);
    expect(table.outcome()).toBe('failed');
  });

  it('reaching winScore on the player completes the match', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      pong: { ...PONG.pong!, winScore: 1 },
      ball: { x: 990, y: 270, vx: 210, vy: -20, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.playerScore()).toBe(1);
    expect(table.outcome()).toBe('complete');
  });

  it('the opponent lerps toward the ball', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      ball: { x: 480, y: 400, vx: 0, vy: 0, radius: 18 },
    };
    const { table } = install(catalog);
    const before = table.opponent()!.y;
    table.tick(300);
    expect(table.opponent()!.y).toBeGreaterThan(before);
  });

  it('setOpponentAxis drives the human paddle and null restores lerp', () => {
    const catalog: BallPaddleCatalog = {
      ...PONG,
      ball: { x: 480, y: 400, vx: 0, vy: 0, radius: 18 },
    };
    const { table } = install(catalog);
    table.setOpponentAxis(-1);
    table.tick(10_000);
    expect(table.opponent()!.y).toBe(70);
    table.setOpponentAxis(null);
    table.tick(300);
    expect(table.opponent()!.y).toBeGreaterThan(70);
  });
});

describe('sw2d.ball-paddle - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(BREAKOUT);
    expect(capabilities.has(BALL_PADDLE_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(BALL_PADDLE_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate brick ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      bricks: [BREAKOUT.bricks[0]!, BREAKOUT.bricks[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { 'ball-paddle': { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => ballPaddlePack.install(ctx, undefined)).toThrow(/brick-0-0/);
  });

  it('a missing content/ball-paddle.json yields an inert service, not an error', () => {
    const { table } = install();
    expect(table.active()).toBe(false);
    table.tick(16);
    expect(table.outcome()).toBe('playing');
  });

  it('an empty brick list is inert even with breakout rules', () => {
    const { table } = install({ ...BREAKOUT, bricks: [] });
    expect(table.active()).toBe(false);
  });

  it('reset restores bricks, lives, scores and the serve', () => {
    const catalog: BallPaddleCatalog = {
      ...BREAKOUT,
      ball: { x: 260, y: 105, vx: 10, vy: -10, radius: 18 },
    };
    const { table } = install(catalog);
    table.tick(0);
    expect(table.bricksRemaining()).toBe(1);
    table.reset();
    expect(table.bricksRemaining()).toBe(2);
    expect(table.score()).toBe(0);
    expect(table.outcome()).toBe('playing');
    expect(table.ball()).toEqual({ x: 260, y: 105, vx: 10, vy: -10, radius: 18 });
  });
});
