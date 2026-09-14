/**
 * Wall-slide / wall-jump / ledge grammar (Category-C Wave 30; ledges and the
 * movement state machine added by the Final Product Completion program,
 * Wave 1 - matrix L03).
 *
 * Renderer-neutral contact with authored vertical surfaces and ledge corners.
 * Overlay platform kits stay local. Empty catalogs stay inert.
 *
 * Bounded modes: slide (cap fall, jump climbs) and leap (same contact, jump
 * kicks away). The parkour grammar is one state machine:
 *
 *   grounded -> airborne -> sliding | ledge-hang
 *   ledge-hang -> climbing -> grounded      (UP)
 *   ledge-hang -> airborne                  (DOWN, lockout before regrab)
 *   ledge-hang -> airborne (jump)           (JUMP)
 *   sliding    -> airborne (wall-jump)      (JUMP)
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  LedgeDef,
  SystemPackDefinition,
  WallCatalog,
  WallMode,
  WallMoveState,
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

const DEFAULT_HANG_OFFSET_Y = 22;
const DEFAULT_HANG_OFFSET_X = 14;
const DEFAULT_CLIMB_MS = 180;
const DEFAULT_REGRAB_LOCKOUT_MS = 400;

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
  private moveState: WallMoveState = 'grounded';
  private liveLedge: LedgeDef | null = null;
  private climbLeftMs = 0;
  private lockoutMs = 0;
  private grabs = 0;
  private climbs = 0;
  private drops = 0;

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
    // While pinned the shell echoes the pinned position back; keep it.
    if (this.moveState === 'ledge-hang' || this.moveState === 'climbing') return;
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

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dt);

    if (this.moveState === 'climbing') {
      this.climbLeftMs = Math.max(0, this.climbLeftMs - dt);
      if (this.climbLeftMs === 0 && this.liveLedge) {
        const ledgeId = this.liveLedge.id;
        const top = this.ledgeTop(this.liveLedge);
        this.posX = top.x;
        this.posY = top.y;
        this.velX = 0;
        this.velY = 0;
        this.onGround = true;
        this.moveState = 'grounded';
        this.liveLedge = null;
        this.last = 'climbed';
        this.events.emit('wall:ledge', { ledgeId, transition: 'climbed' });
      }
      this.slidingState = false;
      this.liveWall = null;
      this.checkGoal();
      return;
    }

    if (this.moveState === 'ledge-hang') {
      this.slidingState = false;
      this.liveWall = null;
      this.checkGoal();
      return;
    }

    // Ledge grab has priority over a slide: airborne, not locked out, moving
    // toward (or holding toward) the ledge corner, and inside the grab box.
    if (!this.onGround && this.lockoutMs === 0) {
      const ledge = this.grabbableLedge();
      if (ledge) {
        const hang = this.hangPosition(ledge);
        this.posX = hang.x;
        this.posY = hang.y;
        this.velX = 0;
        this.velY = 0;
        this.moveState = 'ledge-hang';
        this.liveLedge = ledge;
        this.slidingState = false;
        this.liveWall = null;
        this.grabs += 1;
        this.last = 'grabbed';
        this.events.emit('wall:ledge', { ledgeId: ledge.id, transition: 'grabbed' });
        this.checkGoal();
        return;
      }
    }

    const hit = this.contactWall();
    // `side` is which side of the wall the player is on (-1 left, +1 right);
    // holding *toward* the wall therefore means holdX has the opposite sign.
    // (Wave 30 shipped this inverted - sliding while pushing away from the
    // wall and kicking back into it; the ledge grammar work found and fixed
    // it, and the proofs now assert a real slide.)
    const toward = hit !== null && !this.onGround && this.holdX * -hit.side > 0.2;
    this.slidingState = toward;
    this.liveWall = toward ? hit!.id : null;
    if (this.slidingState && this.velY > this.catalog.slideSpeed) this.velY = this.catalog.slideSpeed;
    this.moveState = this.onGround ? 'grounded' : this.slidingState ? 'sliding' : 'airborne';
    this.checkGoal();
  }

  private checkGoal(): void {
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
    if (!this.active() || this.current !== 'playing') {
      this.last = 'no-wall';
      return null;
    }
    if (this.moveState === 'ledge-hang' && this.liveLedge) {
      const ledgeId = this.liveLedge.id;
      this.moveState = 'airborne';
      this.liveLedge = null;
      this.lockoutMs = this.catalog.regrabLockoutMs ?? DEFAULT_REGRAB_LOCKOUT_MS;
      this.onGround = false;
      this.last = 'hang-jump';
      this.events.emit('wall:ledge', { ledgeId, transition: 'jumped' });
      return { vx: 0, vy: this.catalog.hangJumpVy ?? this.catalog.jumpVy };
    }
    if (!this.slidingState || this.liveWall === null) {
      this.last = 'no-wall';
      return null;
    }
    const hit = this.contactWall();
    const away = hit ? hit.side : this.holdX >= 0 ? -1 : 1;
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

  state(): WallMoveState {
    return this.moveState;
  }

  ledgeId(): string | null {
    return this.liveLedge?.id ?? null;
  }

  pinned(): { readonly x: number; readonly y: number } | null {
    if (!this.liveLedge) return null;
    if (this.moveState === 'ledge-hang') return this.hangPosition(this.liveLedge);
    if (this.moveState === 'climbing') {
      const total = this.catalog.climbMs ?? DEFAULT_CLIMB_MS;
      const progress = total <= 0 ? 1 : 1 - this.climbLeftMs / total;
      const from = this.hangPosition(this.liveLedge);
      const to = this.ledgeTop(this.liveLedge);
      return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
    }
    return null;
  }

  climb(): boolean {
    if (this.moveState !== 'ledge-hang' || !this.liveLedge) return false;
    this.moveState = 'climbing';
    this.climbLeftMs = this.catalog.climbMs ?? DEFAULT_CLIMB_MS;
    this.climbs += 1;
    this.last = 'climbing';
    this.events.emit('wall:ledge', { ledgeId: this.liveLedge.id, transition: 'climbing' });
    if (this.climbLeftMs === 0) this.tick(0);
    return true;
  }

  drop(): boolean {
    if (this.moveState !== 'ledge-hang' || !this.liveLedge) return false;
    const ledgeId = this.liveLedge.id;
    this.moveState = 'airborne';
    this.liveLedge = null;
    this.lockoutMs = this.catalog.regrabLockoutMs ?? DEFAULT_REGRAB_LOCKOUT_MS;
    this.onGround = false;
    this.drops += 1;
    this.last = 'dropped';
    this.events.emit('wall:ledge', { ledgeId, transition: 'dropped' });
    return true;
  }

  release(): void {
    if (this.moveState !== 'ledge-hang' && this.moveState !== 'climbing') return;
    const ledgeId = this.liveLedge?.id ?? '';
    this.moveState = 'airborne';
    this.liveLedge = null;
    this.climbLeftMs = 0;
    this.lockoutMs = this.catalog.regrabLockoutMs ?? DEFAULT_REGRAB_LOCKOUT_MS;
    this.onGround = false;
    this.last = 'released';
    this.events.emit('wall:ledge', { ledgeId, transition: 'released' });
  }

  ledgeStats(): { readonly grabs: number; readonly climbs: number; readonly drops: number } {
    return { grabs: this.grabs, climbs: this.climbs, drops: this.drops };
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
    this.moveState = 'grounded';
    this.liveLedge = null;
    this.climbLeftMs = 0;
    this.lockoutMs = 0;
    this.grabs = 0;
    this.climbs = 0;
    this.drops = 0;
  }

  private hangPosition(ledge: LedgeDef): { x: number; y: number } {
    const ox = this.catalog.hangOffsetX ?? DEFAULT_HANG_OFFSET_X;
    const oy = this.catalog.hangOffsetY ?? DEFAULT_HANG_OFFSET_Y;
    return { x: ledge.x + (ledge.side === 'left' ? -ox : ox), y: ledge.y + oy };
  }

  private ledgeTop(ledge: LedgeDef): { x: number; y: number } {
    const ox = this.catalog.hangOffsetX ?? DEFAULT_HANG_OFFSET_X;
    return { x: ledge.x + (ledge.side === 'left' ? ox : -ox) * 1.4, y: ledge.y - this.catalog.player.radius - 8 };
  }

  private grabbableLedge(): LedgeDef | null {
    for (const ledge of this.catalog.ledges ?? []) {
      const hang = this.hangPosition(ledge);
      if (Math.abs(this.posX - hang.x) > ledge.grabHalfWidth) continue;
      if (Math.abs(this.posY - hang.y) > ledge.grabHalfHeight) continue;
      // Must be moving/holding toward the corner (from the open side) and not rising fast.
      const towardCorner = ledge.side === 'left' ? 1 : -1;
      const heading = this.holdX !== 0 ? this.holdX : this.velX;
      // Moving away from the corner never grabs; hanging still (a straight
      // hang-jump falling back) does.
      if (heading * towardCorner < 0) continue;
      if (this.velY < -60) continue;
      return ledge;
    }
    return null;
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
  version: '1.1.0',
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
