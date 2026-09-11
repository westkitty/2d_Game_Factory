/**
 * Attack range, target selection and autonomous strikes (Category-C Wave 30).
 *
 * Renderer-neutral combat targeting. Overlay kits stay local. Empty
 * catalogs stay inert.
 *
 * Bounded modes: tower (auto nearest in range), auto (two sides auto-strike),
 * range (player strike valid only inside authored range). Not pathfinding.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
  TargetingActorDef,
  TargetingCatalog,
  TargetingMode,
  TargetingOutcome,
  TargetingService,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: TargetingCatalog = {
  schemaVersion: 1,
  mode: 'tower',
  actors: [{ id: 'none', x: 0, y: 0, range: 1, damage: 1, cooldownMs: 0, team: 'player', health: 1 }],
};

interface LiveActor {
  readonly def: TargetingActorDef;
  x: number;
  y: number;
  hp: number;
  readyAt: number;
}

class TargetingServiceImpl implements TargetingService {
  private actors = new Map<string, LiveActor>();
  private last: string | null = null;
  private current: TargetingOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: TargetingCatalog,
  ) {
    this.rebuild();
  }

  mode(): TargetingMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.actors.length > 0 && this.catalog.actors[0]?.id !== 'none';
  }

  setPos(id: string, x: number, y: number): void {
    if (!this.active()) return;
    const live = this.actors.get(id);
    if (live) {
      live.x = x;
      live.y = y;
    }
  }

  tick(_deltaMs: number, nowMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    if (this.catalog.mode === 'range') return;
    for (const actor of this.actors.values()) {
      if (actor.hp <= 0 || actor.def.id === 'none') continue;
      const targetId = this.pickTarget(actor.def.id);
      if (targetId) this.applyStrike(actor.def.id, targetId, nowMs);
    }
  }

  canStrike(attackerId: string, targetId: string): boolean {
    const attacker = this.actors.get(attackerId);
    const target = this.actors.get(targetId);
    if (!attacker || !target || attacker.hp <= 0 || target.hp <= 0) return false;
    return this.inRange(attacker, target);
  }

  pick(attackerId: string): string | null {
    return this.pickTarget(attackerId);
  }

  strike(attackerId: string, targetId: string, nowMs: number): boolean {
    if (!this.active() || this.current !== 'playing') return false;
    return this.applyStrike(attackerId, targetId, nowMs);
  }

  alive(team: 'player' | 'enemy'): number {
    return [...this.actors.values()].filter((a) => a.def.team === team && a.hp > 0 && a.def.id !== 'none').length;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): TargetingOutcome {
    return this.current;
  }

  reset(): void {
    this.rebuild();
    this.last = null;
    this.current = 'playing';
  }

  private rebuild(): void {
    this.actors = new Map(
      this.catalog.actors.map((def) => [def.id, { def, x: def.x, y: def.y, hp: def.health, readyAt: 0 }]),
    );
  }

  private inRange(attacker: LiveActor, target: LiveActor): boolean {
    return Math.hypot(attacker.x - target.x, attacker.y - target.y) <= attacker.def.range;
  }

  private pickTarget(attackerId: string): string | null {
    const attacker = this.actors.get(attackerId);
    if (!attacker || attacker.hp <= 0) return null;
    let best: LiveActor | null = null;
    let bestD = Infinity;
    for (const other of this.actors.values()) {
      if (other.def.id === attackerId || other.def.id === 'none' || other.hp <= 0) continue;
      if (other.def.team === attacker.def.team) continue;
      if (!this.inRange(attacker, other)) continue;
      const d = Math.hypot(attacker.x - other.x, attacker.y - other.y);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best?.def.id ?? null;
  }

  private applyStrike(attackerId: string, targetId: string, nowMs: number): boolean {
    const attacker = this.actors.get(attackerId);
    const target = this.actors.get(targetId);
    if (!attacker || !target || attacker.hp <= 0 || target.hp <= 0) {
      this.last = 'invalid';
      return false;
    }
    if (nowMs < attacker.readyAt) {
      this.last = 'cooldown';
      return false;
    }
    if (!this.inRange(attacker, target)) {
      this.last = 'out-of-range';
      return false;
    }
    target.hp = Math.max(0, target.hp - attacker.def.damage);
    attacker.readyAt = nowMs + attacker.def.cooldownMs;
    this.last = target.hp <= 0 ? `kill-${targetId}` : `hit-${targetId}`;
    this.events.emit('targeting:struck', { attackerId, targetId, remaining: target.hp });
    if (this.alive('enemy') === 0) {
      this.current = 'complete';
      this.last = 'cleared';
      this.events.emit('targeting:completed', { mode: this.catalog.mode, outcome: 'complete' });
    } else if (this.alive('player') === 0) {
      this.current = 'failed';
      this.last = 'wiped';
      this.events.emit('targeting:completed', { mode: this.catalog.mode, outcome: 'failed' });
    }
    return true;
  }
}

export const targetingPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.targeting,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.targeting],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['targeting']?.value as TargetingCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new TargetingServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.targeting, service);
    return {
      id: PACK_IDS.targeting,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { TargetingService };
