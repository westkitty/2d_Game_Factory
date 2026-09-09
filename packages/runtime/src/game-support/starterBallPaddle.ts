import { BALL_PADDLE_CAPABILITY_ID, type BallPaddleService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.ball-paddle`
 * (Category-C Wave 5).
 *
 * Inert unless the game installed the pack and the catalog is a real table.
 * Presentation is a high-contrast HUD so paddle / ball / bricks / scores are
 * readable in the first short play session. `{ hud: false }` lets expanded
 * kits keep their own presentation.
 */

export interface StarterBallPaddleSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly paddleX: number;
  readonly paddleY: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly ballVx: number;
  readonly ballVy: number;
  readonly bricksRemaining: number;
  readonly lives: number;
  readonly score: number;
  readonly playerScore: number;
  readonly opponentScore: number;
  readonly paddleReturns: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

export interface StarterBallPaddleBinding {
  readonly active: boolean;
  setPaddleAxis(axis: number): void;
  tick(deltaMs: number): void;
  snapshot(): StarterBallPaddleSnapshot;
  render(): void;
  mode(): string | null;
  opponent(): { readonly x: number; readonly y: number } | null;
  bricks(): readonly { readonly id: string; readonly x: number; readonly y: number; readonly alive: boolean }[];
  dispose(): void;
}

const INERT: StarterBallPaddleBinding = {
  active: false,
  setPaddleAxis: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    paddleX: 0,
    paddleY: 0,
    ballX: 0,
    ballY: 0,
    ballVx: 0,
    ballVy: 0,
    bricksRemaining: 0,
    lives: 0,
    score: 0,
    playerScore: 0,
    opponentScore: 0,
    paddleReturns: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  mode: () => null,
  opponent: () => null,
  bricks: () => [],
  dispose: () => undefined,
};

export function bindStarterBallPaddle(context: SceneContext, options?: { readonly hud?: boolean }): StarterBallPaddleBinding {
  if (!context.capabilities.has(BALL_PADDLE_CAPABILITY_ID)) return INERT;
  const table = context.capabilities.require<BallPaddleService>(BALL_PADDLE_CAPABILITY_ID);
  if (!table.active()) return INERT;
  table.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const sprites: { destroy(): void }[] = [];
  let paddleSprite: { setPosition(x: number, y: number): unknown; destroy(): void } | null = null;
  let ballSprite: { setPosition(x: number, y: number): unknown; destroy(): void } | null = null;
  let opponentSprite: { setPosition(x: number, y: number): unknown; destroy(): void } | null = null;
  const brickSprites: { id: string; sprite: { setVisible(v: boolean): unknown; destroy(): void } }[] = [];

  if (hud) {
    const paddleKey = context.assets.resolve('player');
    const ballKey = context.assets.resolve('pickup');
    const brickKey = context.assets.resolve('enemy');
    const pad = table.paddle();
    paddleSprite = scene.add.image(pad.x, pad.y, paddleKey).setDisplaySize(pad.width, pad.height).setDepth(4);
    sprites.push(paddleSprite);
    const b = table.ball();
    ballSprite = scene.add.image(b.x, b.y, ballKey).setDisplaySize(b.radius * 2, b.radius * 2).setDepth(5);
    sprites.push(ballSprite);
    const opp = table.opponent();
    if (opp) {
      opponentSprite = scene.add.image(opp.x, opp.y, brickKey).setDisplaySize(opp.width, opp.height).setDepth(4);
      sprites.push(opponentSprite);
    }
    for (const brick of table.bricks()) {
      const sprite = scene.add.image(brick.x, brick.y, brickKey).setDisplaySize(brick.halfWidth * 2 - 14, brick.halfHeight * 2).setDepth(3);
      brickSprites.push({ id: brick.id, sprite });
      sprites.push(sprite);
    }
  }

  function snapshot(): StarterBallPaddleSnapshot {
    const pad = table.paddle();
    const b = table.ball();
    return {
      active: true,
      mode: table.mode(),
      paddleX: pad.x,
      paddleY: pad.y,
      ballX: b.x,
      ballY: b.y,
      ballVx: b.vx,
      ballVy: b.vy,
      bricksRemaining: table.bricksRemaining(),
      lives: table.lives(),
      score: table.score(),
      playerScore: table.playerScore(),
      opponentScore: table.opponentScore(),
      paddleReturns: table.paddleReturns(),
      lastResult: table.lastResult(),
      outcome: table.outcome(),
    };
  }

  function render(): void {
    const pad = table.paddle();
    const b = table.ball();
    paddleSprite?.setPosition(pad.x, pad.y);
    ballSprite?.setPosition(b.x, b.y);
    const opp = table.opponent();
    if (opp) opponentSprite?.setPosition(opp.x, opp.y);
    for (const entry of brickSprites) {
      const live = table.bricks().find((brick) => brick.id === entry.id);
      entry.sprite.setVisible(live?.alive ?? false);
    }
    if (!title || !status || !hint) return;
    if (table.mode() === 'pong') {
      title.setText('PONG');
      status.setText(
        `you ${table.playerScore()}  ·  opp ${table.opponentScore()}${table.outcome() !== 'playing' ? `  ·  ${table.outcome().toUpperCase()}` : ''}`,
      );
    } else {
      title.setText('BREAKOUT');
      status.setText(
        `score ${table.score()}  ·  bricks ${table.bricksRemaining()}  ·  lives ${table.lives()}${table.outcome() !== 'playing' ? `  ·  ${table.outcome().toUpperCase()}` : ''}`,
      );
    }
    hint.setText('MOVE WASD/ARROWS   RETURN THE BALL');
  }

  render();

  let disposed = false;
  return {
    active: true,
    setPaddleAxis(axis: number): void {
      table.setPaddleAxis(axis);
    },
    tick(deltaMs: number): void {
      table.tick(deltaMs);
      render();
    },
    snapshot,
    render,
    mode: () => table.mode(),
    opponent: () => table.opponent(),
    bricks: () => table.bricks(),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const sprite of sprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
