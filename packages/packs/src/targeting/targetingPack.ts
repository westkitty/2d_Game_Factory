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
  TargetingSlotDef,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: TargetingCatalog = {
  schemaVersion: 1,
  mode: 'tower',
  actors: [{ id: 'none', x: 0, y: 0, range: 1, damage: 1, cooldownMs: 0, team: 'player', health: 1 }],
};

interface LiveActor {
  def: TargetingActorDef;
  x: number;
  y: number;
  hp: number;
  readyAt: number;
  tier: number;
}

class TargetingServiceImpl implements TargetingService {
  private actors = new Map<string, LiveActor>();
  private last: string | null = null;
  private current: TargetingOutcome = 'playing';
  private coins = 0;
  private nextTower = 1;
  private occupants = new Map<string, string>();
  private placeRejects = 0;
  private upgradeRejects = 0;
  private roster: readonly string[] | null = null;

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
      if (actor.hp <= 0 || actor.def.id === 'none' || !this.inLineup(actor)) continue;
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
    return [...this.actors.values()].filter((a) => a.def.team === team && a.hp > 0 && a.def.id !== 'none' && this.inLineup(a)).length;
  }

  health(actorId: string): number {
    const live = this.actors.get(actorId);
    return live && live.def.id !== 'none' ? Math.max(0, live.hp) : 0;
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

  gold(): number {
    return this.coins;
  }

  slots(): readonly TargetingSlotDef[] {
    return this.catalog.slots ?? [];
  }

  occupant(slotId: string): string | null {
    return this.occupants.get(slotId) ?? null;
  }

  previewSlot(x: number, y: number): string | null {
    let best: TargetingSlotDef | null = null;
    let bestD = Infinity;
    for (const slot of this.slots()) {
      const d = Math.hypot(slot.x - x, slot.y - y);
      if (d <= slot.radius && d < bestD) {
        bestD = d;
        best = slot;
      }
    }
    return best?.id ?? null;
  }

  placeAt(x: number, y: number): boolean {
    if (!this.active() || this.current !== 'playing') return false;
    const slotId = this.previewSlot(x, y);
    const cost = this.catalog.placeCost ?? 0;
    if (!slotId || this.occupants.has(slotId) || this.coins < cost) {
      this.placeRejects += 1;
      this.last = 'place-rejected';
      return false;
    }
    const slot = this.slots().find((entry) => entry.id === slotId);
    const tier0 = this.catalog.upgrades?.[0];
    if (!slot) {
      this.placeRejects += 1;
      this.last = 'place-rejected';
      return false;
    }
    const id = `tower-${this.nextTower}`;
    this.nextTower += 1;
    const def: TargetingActorDef = {
      id,
      x: slot.x,
      y: slot.y,
      range: tier0?.range ?? 180,
      damage: tier0?.damage ?? 1,
      cooldownMs: 280,
      team: 'player',
      health: 3,
    };
    this.actors.set(id, { def, x: slot.x, y: slot.y, hp: def.health, readyAt: 0, tier: 0 });
    this.occupants.set(slotId, id);
    this.coins -= cost;
    this.last = `placed-${id}`;
    return true;
  }

  upgrade(towerId: string): boolean {
    if (!this.active() || this.current !== 'playing') return false;
    const live = this.actors.get(towerId);
    const next = this.catalog.upgrades?.[live ? live.tier + 1 : -1];
    if (!live || live.def.team !== 'player' || !next || this.coins < next.cost) {
      this.upgradeRejects += 1;
      this.last = 'upgrade-rejected';
      return false;
    }
    this.coins -= next.cost;
    live.tier += 1;
    live.def = { ...live.def, range: next.range, damage: next.damage };
    this.last = `upgraded-${towerId}`;
    return true;
  }

  towerDamage(towerId: string): number {
    return this.actors.get(towerId)?.def.damage ?? 0;
  }

  towerTier(towerId: string): number {
    return this.actors.get(towerId)?.tier ?? 0;
  }

  placedCount(): number {
    return this.occupants.size;
  }

  placementRejections(): number {
    return this.placeRejects;
  }

  upgradeRejections(): number {
    return this.upgradeRejects;
  }

  setLineup(ids: readonly string[]): void {
    this.roster = [...ids];
  }

  lineup(): readonly string[] {
    if (this.roster !== null) return this.roster;
    return [...this.actors.values()].filter((a) => a.def.team === 'player' && a.def.id !== 'none').map((a) => a.def.id);
  }

  private rebuild(): void {
    this.actors = new Map(
      this.catalog.actors.map((def) => [def.id, { def, x: def.x, y: def.y, hp: def.health, readyAt: 0, tier: 0 }]),
    );
    this.coins = this.catalog.startingGold ?? 0;
    this.nextTower = 1;
    this.occupants = new Map();
    this.placeRejects = 0;
    this.upgradeRejects = 0;
    this.roster = null;
    for (const def of this.catalog.actors) {
      if (def.team !== 'player' || def.id === 'none') continue;
      const slot = this.slots().find((entry) => Math.hypot(entry.x - def.x, entry.y - def.y) <= entry.radius);
      if (slot) this.occupants.set(slot.id, def.id);
    }
  }

  private inRange(attacker: LiveActor, target: LiveActor): boolean {
    return Math.hypot(attacker.x - target.x, attacker.y - target.y) <= attacker.def.range;
  }

  private inLineup(actor: LiveActor): boolean {
    if (this.roster === null || actor.def.team !== 'player') return true;
    return this.roster.includes(actor.def.id);
  }

  private pickTarget(attackerId: string): string | null {
    const attacker = this.actors.get(attackerId);
    if (!attacker || attacker.hp <= 0 || !this.inLineup(attacker)) return null;
    let best: LiveActor | null = null;
    let bestD = Infinity;
    for (const other of this.actors.values()) {
      if (other.def.id === attackerId || other.def.id === 'none' || other.hp <= 0) continue;
      if (other.def.team === attacker.def.team) continue;
      if (!this.inLineup(other)) continue;
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
