/**
 * Arcade pinball table (Category-C Wave 30).
 *
 * Renderer-neutral ball, bumpers, optional flippers, drain and score.
 * Overlay physics kits stay local. Empty catalogs stay inert.
 *
 * Bounded modes: table (flippers + bumpers, complete at score) and toy
 * (launch into a goal pocket). Not Matter and not ball-paddle.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  PinballCatalog,
  PinballMode,
  PinballOutcome,
  PinballService,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: PinballCatalog = {
  schemaVersion: 1,
  mode: 'table',
  ball: { x: 0, y: 0, radius: 1, vx: 0, vy: 0 },
  gravity: 0,
  bounce: 0,
  bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  bumpers: [],
  drainY: 0,
  winScore: 0,
};

class PinballServiceImpl implements PinballService {
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  private points = 0;
  private last: string | null = null;
  private current: PinballOutcome = 'playing';
  private balls: number;
  private readonly cooldown = new Map<string, number>();

  constructor(
    private readonly events: EventBus,
    private readonly catalog: PinballCatalog,
  ) {
    this.x = catalog.ball.x;
    this.y = catalog.ball.y;
    this.vx = catalog.ball.vx;
    this.vy = catalog.ball.vy;
    this.balls = catalog.balls ?? (catalog.mode === 'table' ? 3 : 1);
  }

  mode(): PinballMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.gravity > 0 && this.catalog.winScore > 0;
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.min(deltaMs, 32) / 1000;
    this.vy += this.catalog.gravity * dt;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    if (this.x < this.catalog.bounds.minX) {
      this.x = this.catalog.bounds.minX;
      this.vx = Math.abs(this.vx) * this.catalog.bounce;
    }
    if (this.x > this.catalog.bounds.maxX) {
      this.x = this.catalog.bounds.maxX;
      this.vx = -Math.abs(this.vx) * this.catalog.bounce;
    }
    if (this.y < this.catalog.bounds.minY) {
      this.y = this.catalog.bounds.minY;
      this.vy = Math.abs(this.vy) * this.catalog.bounce;
    }
    for (const [id, left] of [...this.cooldown]) {
      const next = left - deltaMs;
      if (next <= 0) this.cooldown.delete(id);
      else this.cooldown.set(id, next);
    }
    for (const bumper of this.catalog.bumpers) {
      if (this.cooldown.has(bumper.id)) continue;
      if (Math.hypot(this.x - bumper.x, this.y - bumper.y) <= bumper.radius + this.catalog.ball.radius) {
        const dx = this.x - bumper.x;
        const dy = this.y - bumper.y;
        const len = Math.hypot(dx, dy) || 1;
        this.vx = (dx / len) * Math.max(4, Math.abs(this.vx));
        this.vy = (dy / len) * Math.max(4, Math.abs(this.vy));
        this.points += bumper.score;
        this.last = `bumper-${bumper.id}`;
        this.cooldown.set(bumper.id, 120);
        this.events.emit('pinball:bumper', { bumperId: bumper.id, score: this.points });
      }
    }
    if (this.catalog.goal && Math.hypot(this.x - this.catalog.goal.x, this.y - this.catalog.goal.y) <= this.catalog.goal.radius) {
      this.finish('complete', 'pocket');
      return;
    }
    if (this.points >= this.catalog.winScore) {
      this.finish('complete', 'score');
      return;
    }
    if (this.y >= this.catalog.drainY) {
      this.balls = Math.max(0, this.balls - 1);
      this.last = 'drain';
      if (this.balls <= 0) {
        this.finish('failed', 'game-over');
        return;
      }
      this.x = this.catalog.ball.x;
      this.y = this.catalog.ball.y;
      this.vx = this.catalog.ball.vx;
      this.vy = this.catalog.ball.vy;
    }
  }

  flip(side: 'left' | 'right'): void {
    if (!this.active() || this.current !== 'playing') return;
    const flipper = (this.catalog.flippers ?? []).find((f) => f.id === side);
    if (!flipper) return;
    if (Math.abs(this.x - flipper.x) <= flipper.halfWidth && Math.abs(this.y - flipper.y) <= 36) {
      this.vy = -Math.abs(flipper.kick);
      this.vx += side === 'left' ? 2 : -2;
      this.last = `flip-${side}`;
      this.events.emit('pinball:flip', { side });
    }
  }

  launch(vx: number, vy: number): void {
    if (!this.active() || this.current !== 'playing') return;
    this.vx = vx;
    this.vy = vy;
    this.last = 'launch';
  }

  ballX(): number {
    return this.x;
  }

  ballY(): number {
    return this.y;
  }

  score(): number {
    return this.points;
  }

  ballsRemaining(): number {
    return this.balls;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): PinballOutcome {
    return this.current;
  }

  reset(): void {
    this.x = this.catalog.ball.x;
    this.y = this.catalog.ball.y;
    this.vx = this.catalog.ball.vx;
    this.vy = this.catalog.ball.vy;
    this.points = 0;
    this.last = null;
    this.current = 'playing';
    this.balls = this.catalog.balls ?? (this.catalog.mode === 'table' ? 3 : 1);
    this.cooldown.clear();
  }

  private finish(outcome: PinballOutcome, reason: string): void {
    this.current = outcome;
    this.last = reason;
    this.events.emit('pinball:completed', { mode: this.catalog.mode, outcome });
  }
}

export const pinballPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.pinball,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.pinball],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['pinball']?.value as PinballCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new PinballServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.pinball, service);
    return {
      id: PACK_IDS.pinball,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { PinballService };
