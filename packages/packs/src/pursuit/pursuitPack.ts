/**
 * Pursuit pressure pack (Final Product Completion, Wave 1 - matrix L01/L02).
 *
 * Renderer-neutral pressure along the run axis. Definitions come from the
 * validated `content/pursuit.json`. No Phaser, no wall clock, no RNG. Two
 * bounded modes (`wall`, `chaser`) - see the contract for the semantics.
 *
 * Deliberately not an AI pack: nothing here perceives, navigates or fights.
 * Consumers: chase-platformer (wall), endless-runner / auto-runner (chaser).
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  PursuitCatalog,
  PursuitMode,
  PursuitOutcome,
  PursuitService,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: PursuitCatalog = {
  schemaVersion: 1,
  mode: 'wall',
  startX: 0,
  speed: 0,
  catchDistance: 0,
  escapeX: null,
  maxGap: 0,
  closeSpeed: 0,
  recoverSpeed: 0,
  stumbleMs: 0,
  failY: 0,
};

class PursuitServiceImpl implements PursuitService {
  private px: number;
  private py = 0;
  private onGround = true;
  private pursuer: number;
  private gapValue: number;
  private stumbleLeft = 0;
  private stumbleCount = 0;
  private current: PursuitOutcome = 'playing';
  private last: string | null = null;

  constructor(
    private readonly events: EventBus,
    private readonly catalog: PursuitCatalog,
  ) {
    this.px = catalog.startX;
    this.pursuer = catalog.mode === 'wall' ? catalog.startX : catalog.startX - catalog.maxGap;
    this.gapValue = catalog.maxGap;
  }

  mode(): PursuitMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.mode === 'wall' ? this.catalog.speed > 0 : this.catalog.maxGap > 0;
  }

  setPlayer(x: number, y: number, onGround: boolean): void {
    if (!this.active()) return;
    this.px = x;
    this.py = y;
    this.onGround = onGround;
  }

  stumble(durationMs?: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const ms = durationMs ?? this.catalog.stumbleMs;
    if (ms <= 0) return;
    this.stumbleLeft = Math.max(this.stumbleLeft, ms);
    this.stumbleCount += 1;
    this.last = 'stumbled';
    this.events.emit('pursuit:stumbled', { stumbles: this.stumbleCount, gap: this.gap() });
  }

  stumbling(): boolean {
    return this.stumbleLeft > 0;
  }

  stumbleMsLeft(): number {
    return this.stumbleLeft;
  }

  stumbles(): number {
    return this.stumbleCount;
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const ms = Math.max(0, deltaMs);
    const dt = ms / 1000;
    // Split the frame: the part spent stumbling closes the gap, the rest
    // recovers it - so one long frame and many short ones integrate alike.
    const stumbledMs = Math.min(this.stumbleLeft, ms);
    if (this.stumbleLeft > 0) this.stumbleLeft = Math.max(0, this.stumbleLeft - ms);

    if (this.catalog.mode === 'wall') {
      this.pursuer += this.catalog.speed * dt;
    } else {
      this.gapValue = Math.max(0, this.gapValue - this.catalog.closeSpeed * (stumbledMs / 1000));
      this.gapValue = Math.min(this.catalog.maxGap, this.gapValue + this.catalog.recoverSpeed * ((ms - stumbledMs) / 1000));
      this.pursuer = this.px - this.gapValue;
    }

    if (this.catalog.failY > 0 && this.py > this.catalog.failY) {
      this.current = 'failed';
      this.last = 'fell';
      this.events.emit('pursuit:caught', { mode: this.catalog.mode, reason: 'fell' });
      return;
    }
    if (this.gap() <= this.catalog.catchDistance) {
      this.current = 'failed';
      this.last = 'caught';
      this.events.emit('pursuit:caught', { mode: this.catalog.mode, reason: 'caught' });
      return;
    }
    if (this.catalog.escapeX !== null && this.px >= this.catalog.escapeX && this.onGround) {
      this.current = 'complete';
      this.last = 'escaped';
      this.events.emit('pursuit:escaped', { mode: this.catalog.mode });
    }
  }

  pursuerX(): number {
    return this.pursuer;
  }

  gap(): number {
    return this.px - this.pursuer;
  }

  escapeX(): number | null {
    return this.catalog.escapeX;
  }

  outcome(): PursuitOutcome {
    return this.current;
  }

  lastResult(): string | null {
    return this.last;
  }

  reset(): void {
    this.px = this.catalog.startX;
    this.py = 0;
    this.onGround = true;
    this.pursuer = this.catalog.mode === 'wall' ? this.catalog.startX : this.catalog.startX - this.catalog.maxGap;
    this.gapValue = this.catalog.maxGap;
    this.stumbleLeft = 0;
    this.stumbleCount = 0;
    this.current = 'playing';
    this.last = null;
  }
}

export const pursuitPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.pursuit,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.pursuit],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['pursuit']?.value as PursuitCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new PursuitServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.pursuit, service);
    return {
      id: PACK_IDS.pursuit,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { PursuitService };
