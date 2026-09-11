/**
 * Wall-slide / wall-jump (Category-C Wave 30).
 *
 * Renderer-neutral contact with authored vertical surfaces. Overlay
 * platform kits stay local. Empty catalogs stay inert.
 *
 * Bounded modes: slide (cap fall, jump climbs) and leap (same contact,
 * jump kicks away). Not a full parkour grammar.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
  WallCatalog,
  WallMode,
  WallOutcome,
  WallService,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: WallCatalog = {
  schemaVersion: 1,
  mode: 'slide',
  player: { x: 0, y: 0, radius: 1 },
  walls: [{ id: 'none', x: 0, y: 0, halfWidth: 1, halfHeight: 1 }],
  slideSpeed: 0,
  jumpVx: 0,
  jumpVy: 0,
  goal: { x: 0, y: 0, radius: 1 },
  failY: 0,
};

class WallServiceImpl implements WallService {
  private posX: number;
  private posY: number;
  private velX = 0;
  private velY = 0;
  private onGround = false;
  private holdX = 0;
  private slidingState = false;
  private liveWall: string | null = null;
  private last: string | null = null;
  private current: WallOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: WallCatalog,
  ) {
    this.posX = catalog.player.x;
    this.posY = catalog.player.y;
  }

  mode(): WallMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.slideSpeed > 0 && this.catalog.walls[0]?.id !== 'none';
  }

  setPlayer(x: number, y: number, vx: number, vy: number, onGround: boolean): void {
    if (!this.active()) return;
    this.posX = x;
    this.posY = y;
    this.velX = vx;
    this.velY = vy;
    this.onGround = onGround;
  }

  setHoldX(axis: number): void {
    if (!this.active()) return;
    this.holdX = axis;
  }

  tick(_deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const hit = this.contactWall();
    const toward = hit !== null && !this.onGround && this.holdX * hit.side > 0.2;
    this.slidingState = toward;
    this.liveWall = toward ? hit!.id : null;
    if (this.slidingState && this.velY > this.catalog.slideSpeed) this.velY = this.catalog.slideSpeed;
    if (Math.hypot(this.posX - this.catalog.goal.x, this.posY - this.catalog.goal.y) <= this.catalog.goal.radius) {
      this.current = 'complete';
      this.last = 'goal';
      this.events.emit('wall:completed', { mode: this.catalog.mode, outcome: 'complete' });
    } else if (this.posY >= this.catalog.failY) {
      this.current = 'failed';
      this.last = 'fell';
      this.events.emit('wall:completed', { mode: this.catalog.mode, outcome: 'failed' });
    }
  }

  jump(): { readonly vx: number; readonly vy: number } | null {
    if (!this.active() || this.current !== 'playing' || !this.slidingState || this.liveWall === null) {
      this.last = 'no-wall';
      return null;
    }
    const hit = this.contactWall();
    const away = hit ? -hit.side : this.holdX >= 0 ? 1 : -1;
    this.last = this.catalog.mode === 'leap' ? 'leap' : 'climb';
    this.events.emit('wall:jumped', { mode: this.catalog.mode, wallId: this.liveWall });
    return { vx: away * this.catalog.jumpVx, vy: this.catalog.jumpVy };
  }

  sliding(): boolean {
    return this.slidingState;
  }

  wallId(): string | null {
    return this.liveWall;
  }

  x(): number {
    return this.posX;
  }

  y(): number {
    return this.posY;
  }

  vx(): number {
    return this.velX;
  }

  vy(): number {
    return this.velY;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): WallOutcome {
    return this.current;
  }

  reset(): void {
    this.posX = this.catalog.player.x;
    this.posY = this.catalog.player.y;
    this.velX = 0;
    this.velY = 0;
    this.onGround = false;
    this.holdX = 0;
    this.slidingState = false;
    this.liveWall = null;
    this.last = null;
    this.current = 'playing';
  }

  private contactWall(): { id: string; side: number } | null {
    const r = this.catalog.player.radius;
    for (const wall of this.catalog.walls) {
      if (wall.id === 'none') continue;
      const dx = this.posX - wall.x;
      const dy = this.posY - wall.y;
      if (Math.abs(dx) > wall.halfWidth + r || Math.abs(dy) > wall.halfHeight + r) continue;
      return { id: wall.id, side: dx >= 0 ? 1 : -1 };
    }
    return null;
  }
}

export const wallPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.wall,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.wall],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['wall']?.value as WallCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new WallServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.wall, service);
    return {
      id: PACK_IDS.wall,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { WallService };
