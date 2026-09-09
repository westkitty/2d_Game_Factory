/**
 * Arcade ball / paddle / rebound pack (Category-C capability program, Wave 5).
 *
 * Renderer-neutral table physics. Overlay-matching constants live in
 * generated `content/ball-paddle.json` so factory and overlay stay aligned.
 * Bounded modes: breakout (bricks + lives) and pong (chasing opponent +
 * first-to-N). Empty catalogs (no bricks, no pong table) stay inert.
 *
 * Deliberately not folded into `sw2d.arcade`: that pack is score/combo/lives
 * counters and explicitly is not rebound geometry.
 */

import type {
  BallPaddleBrickState,
  BallPaddleCatalog,
  BallPaddleMode,
  BallPaddleOutcome,
  BallPaddleService,
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateBallPaddleIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface LiveBrick {
  id: string;
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  alive: boolean;
}

function assertUniqueBrickIds(catalog: BallPaddleCatalog): void {
  const seen = new Set<string>();
  for (const brick of catalog.bricks) {
    if (seen.has(brick.id)) throw new DuplicateBallPaddleIdError(brick.id);
    seen.add(brick.id);
  }
}

const EMPTY_CATALOG: BallPaddleCatalog = {
  schemaVersion: 1,
  mode: 'breakout',
  court: { width: 960, height: 540 },
  paddle: { x: 480, y: 485, width: 150, height: 22, speed: 0, axis: 'x', min: 85, max: 875, hitHalf: 86 },
  ball: { x: 480, y: 270, vx: 0, vy: 0, radius: 18 },
  walls: { insetX: 12, top: 50, bottom: 522 },
  bricks: [],
  lives: 0,
};

class BallPaddleServiceImpl implements BallPaddleService {
  private paddleX: number;
  private paddleY: number;
  private paddleAxis = 0;
  private opponentAxis: number | null = null;
  private ballX: number;
  private ballY: number;
  private ballVx: number;
  private ballVy: number;
  private opponentX: number;
  private opponentY: number;
  private brickStates: LiveBrick[];
  private remainingLives: number;
  private brickScore = 0;
  private playerPts = 0;
  private opponentPts = 0;
  private returns = 0;
  private last = null as string | null;
  private current: BallPaddleOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: BallPaddleCatalog,
  ) {
    assertUniqueBrickIds(catalog);
    this.paddleX = catalog.paddle.x;
    this.paddleY = catalog.paddle.y;
    this.ballX = catalog.ball.x;
    this.ballY = catalog.ball.y;
    this.ballVx = catalog.ball.vx;
    this.ballVy = catalog.ball.vy;
    this.opponentX = catalog.pong?.opponentX ?? 0;
    this.opponentY = catalog.pong?.opponentY ?? 0;
    this.remainingLives = catalog.lives;
    this.brickStates = catalog.bricks.map((b) => ({ ...b, alive: true }));
  }

  mode(): BallPaddleMode {
    return this.catalog.mode;
  }

  active(): boolean {
    if (this.catalog.mode === 'pong') return this.catalog.pong !== undefined;
    return this.catalog.bricks.length > 0 && this.catalog.breakout !== undefined;
  }

  setPaddleAxis(axis: number): void {
    this.paddleAxis = axis === 0 ? 0 : axis > 0 ? 1 : -1;
  }

  setOpponentAxis(axis: number | null): void {
    this.opponentAxis = axis === null ? null : axis === 0 ? 0 : axis > 0 ? 1 : -1;
  }

  paddle() {
    return {
      x: this.paddleX,
      y: this.paddleY,
      width: this.catalog.paddle.width,
      height: this.catalog.paddle.height,
    };
  }

  opponent() {
    if (this.catalog.mode !== 'pong' || !this.catalog.pong) return null;
    return {
      x: this.opponentX,
      y: this.opponentY,
      width: this.catalog.pong.opponentWidth,
      height: this.catalog.pong.opponentHeight,
    };
  }

  ball() {
    return {
      x: this.ballX,
      y: this.ballY,
      vx: this.ballVx,
      vy: this.ballVy,
      radius: this.catalog.ball.radius,
    };
  }

  bricks(): readonly BallPaddleBrickState[] {
    return this.brickStates;
  }

  bricksRemaining(): number {
    return this.brickStates.filter((b) => b.alive).length;
  }

  lives(): number {
    return this.remainingLives;
  }

  score(): number {
    return this.brickScore;
  }

  playerScore(): number {
    return this.playerPts;
  }

  opponentScore(): number {
    return this.opponentPts;
  }

  paddleReturns(): number {
    return this.returns;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): BallPaddleOutcome {
    return this.current;
  }

  reset(): void {
    this.paddleX = this.catalog.paddle.x;
    this.paddleY = this.catalog.paddle.y;
    this.ballX = this.catalog.ball.x;
    this.ballY = this.catalog.ball.y;
    this.ballVx = this.catalog.ball.vx;
    this.ballVy = this.catalog.ball.vy;
    this.opponentX = this.catalog.pong?.opponentX ?? 0;
    this.opponentY = this.catalog.pong?.opponentY ?? 0;
    this.remainingLives = this.catalog.lives;
    this.brickScore = 0;
    this.playerPts = 0;
    this.opponentPts = 0;
    this.returns = 0;
    this.last = null;
    this.current = 'playing';
    this.paddleAxis = 0;
    this.brickStates = this.catalog.bricks.map((b) => ({ ...b, alive: true }));
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    const dtSec = dt / 1000;
    this.movePaddle(dtSec);
    if (this.catalog.mode === 'pong') this.moveOpponent(dt);
    this.ballX += this.ballVx * dtSec;
    this.ballY += this.ballVy * dtSec;
    if (this.catalog.mode === 'breakout') this.tickBreakout();
    else this.tickPong();
  }

  private movePaddle(dtSec: number): void {
    const { axis, speed, min, max } = this.catalog.paddle;
    if (axis === 'x') {
      this.paddleX = clamp(this.paddleX + this.paddleAxis * speed * dtSec, min, max);
    } else {
      this.paddleY = clamp(this.paddleY + this.paddleAxis * speed * dtSec, min, max);
    }
  }

  private moveOpponent(dt: number): void {
    const pong = this.catalog.pong;
    if (!pong) return;
    if (this.opponentAxis !== null) {
      const { speed, min, max } = this.catalog.paddle;
      this.opponentY = clamp(this.opponentY + this.opponentAxis * speed * (dt / 1000), min, max);
      return;
    }
    const t = Math.min(1, dt / pong.lerpMs);
    this.opponentY = this.opponentY + (this.ballY - this.opponentY) * t;
  }

  private tickBreakout(): void {
    const { court, walls, paddle, breakout: rules } = this.catalog;
    if (!rules) return;
    const left = walls.insetX;
    const right = court.width - walls.insetX;
    if (this.ballX < left) {
      this.ballX = left;
      this.ballVx = Math.abs(this.ballVx);
    } else if (this.ballX > right) {
      this.ballX = right;
      this.ballVx = -Math.abs(this.ballVx);
    }
    if (this.ballY < walls.top) {
      this.ballY = walls.top;
      this.ballVy = Math.abs(this.ballVy);
    }

    if (
      this.ballVy > 0 &&
      this.ballY > this.paddleY - rules.contactNear &&
      this.ballY < this.paddleY + rules.contactFar &&
      Math.abs(this.ballX - this.paddleX) < paddle.hitHalf
    ) {
      const contactOffset = clamp((this.ballX - this.paddleX) / rules.contactDivisor, -1, 1);
      const previousSign = this.ballVx >= 0 ? 1 : -1;
      let nextVx = clamp(
        this.ballVx + contactOffset * rules.contactScale + this.paddleAxis * rules.moveScale,
        -rules.maxSpeedX,
        rules.maxSpeedX,
      );
      if (Math.abs(nextVx) < rules.minSpeedX) {
        const sign = Math.abs(contactOffset) > 0.08 ? Math.sign(contactOffset) : previousSign;
        nextVx = (sign || 1) * rules.minSpeedX;
      }
      this.ballVx = nextVx;
      this.ballVy = -Math.abs(this.ballVy);
      this.ballY = this.paddleY - rules.parkOffset;
      this.returns += 1;
      this.last = 'paddle-return';
      this.events.emit('ballPaddle:returned', { mode: 'breakout' });
    }

    for (const brick of this.brickStates) {
      if (!brick.alive) continue;
      if (Math.abs(this.ballX - brick.x) >= brick.halfWidth) continue;
      if (Math.abs(this.ballY - brick.y) >= brick.halfHeight) continue;
      brick.alive = false;
      this.brickScore += rules.brickScore;
      this.ballVy = -this.ballVy;
      this.last = 'brick';
      this.events.emit('ballPaddle:brick', { brickId: brick.id, score: this.brickScore });
      if (this.bricksRemaining() === 0) {
        this.current = 'complete';
        this.ballVx = 0;
        this.ballVy = 0;
        this.events.emit('ballPaddle:cleared', {});
      }
      break;
    }

    if (this.current === 'playing' && this.ballY > court.height + 20) {
      this.remainingLives -= 1;
      this.last = 'drain';
      this.events.emit('ballPaddle:miss', { lives: this.remainingLives });
      if (this.remainingLives <= 0) {
        this.current = 'failed';
        this.ballVx = 0;
        this.ballVy = 0;
        this.events.emit('ballPaddle:drained', {});
        return;
      }
      this.serveBreakout();
    }
  }

  private serveBreakout(): void {
    const { court, breakout: rules } = this.catalog;
    this.ballX = court.width / 2;
    this.ballY = court.height / 2;
    this.ballVx = this.remainingLives % 2 === 0 ? -rules!.serveSpeed : rules!.serveSpeed;
    this.ballVy = -Math.abs(rules!.serveSpeed);
  }

  private tickPong(): void {
    const { court, walls, paddle } = this.catalog;
    const pong = this.catalog.pong;
    if (!pong) return;

    if (this.ballY < walls.top || this.ballY > walls.bottom) {
      this.ballVy *= -1;
    }

    if (
      this.ballX > pong.playerMinX &&
      this.ballX < pong.playerMaxX &&
      Math.abs(this.ballY - this.paddleY) < paddle.hitHalf &&
      this.ballVx < 0
    ) {
      this.ballVx = Math.abs(this.ballVx) + pong.speedBump;
      this.returns += 1;
      this.last = 'player-return';
      this.events.emit('ballPaddle:returned', { mode: 'pong' });
    }

    if (
      this.ballX > pong.opponentMinX &&
      this.ballX < pong.opponentMaxX &&
      Math.abs(this.ballY - this.opponentY) < pong.opponentHitHalf &&
      this.ballVx > 0
    ) {
      this.ballVx = -Math.abs(this.ballVx) - pong.speedBump;
    }

    if (this.ballX < -pong.scorePast) {
      this.opponentPts += 1;
      this.events.emit('ballPaddle:scored', {
        side: 'opponent',
        player: this.playerPts,
        opponent: this.opponentPts,
      });
      if (this.opponentPts >= pong.winScore) {
        this.current = 'failed';
        this.events.emit('ballPaddle:matchOver', { outcome: 'failed' });
        return;
      }
      this.servePong(pong.serveSpeed);
    } else if (this.ballX > court.width + pong.scorePast) {
      this.playerPts += 1;
      this.events.emit('ballPaddle:scored', {
        side: 'player',
        player: this.playerPts,
        opponent: this.opponentPts,
      });
      if (this.playerPts >= pong.winScore) {
        this.current = 'complete';
        this.events.emit('ballPaddle:matchOver', { outcome: 'complete' });
        return;
      }
      this.servePong(-pong.serveSpeed);
    }
  }

  private servePong(vx: number): void {
    const { court } = this.catalog;
    this.ballX = court.width / 2;
    this.ballY = court.height / 2;
    this.ballVx = vx;
  }
}

export const ballPaddlePack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.ballPaddle,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.ballPaddle],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['ball-paddle']?.value as BallPaddleCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new BallPaddleServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.ballPaddle, service);
    return {
      id: PACK_IDS.ballPaddle,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { BallPaddleService };
