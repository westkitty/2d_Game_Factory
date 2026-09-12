/**
 * Melee strike / knockback / hit-stun pack (Category-C capability program, Wave 6).
 *
 * Renderer-neutral close combat. Damage goes through `combat.health` so this
 * pack never becomes a second health authority. Overlay-matching constants
 * live in generated `content/melee.json`.
 *
 * Bounded modes: skirmish (one elite foe) and arena (several fodder). Empty
 * catalogs (no foes) stay inert. Deliberately not folded into `sw2d.combat`:
 * that pack is entity-keyed health and explicitly is not melee collision.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  MeleeCatalog,
  MeleeFoeState,
  MeleeMode,
  MeleeOutcome,
  MeleeService,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateMeleeIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { CombatService } from '../combat/combatPack.ts';

interface LiveFoe {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  stunnedUntilMs: number;
}

function assertUniqueIds(catalog: MeleeCatalog): void {
  const seen = new Set<string>();
  const claim = (id: string): void => {
    if (seen.has(id)) throw new DuplicateMeleeIdError(id);
    seen.add(id);
  };
  claim(catalog.player.id);
  for (const foe of catalog.foes) claim(foe.id);
}

const EMPTY_CATALOG: MeleeCatalog = {
  schemaVersion: 1,
  mode: 'skirmish',
  player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
  foes: [],
  strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
  contact: { range: 34, damage: 1, cooldownMs: 650 },
};

class MeleeServiceImpl implements MeleeService {
  private playerX: number;
  private playerY: number;
  private foeStates: LiveFoe[];
  private lastStrikeMs = -1_000_000;
  private lastContactMs = -1_000_000;
  private last: string | null = null;
  private current: MeleeOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly combat: CombatService,
    private readonly catalog: MeleeCatalog,
  ) {
    assertUniqueIds(catalog);
    this.playerX = catalog.player.x;
    this.playerY = catalog.player.y;
    this.foeStates = [];
    this.registerFighters();
  }

  mode(): MeleeMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.foes.length > 0;
  }

  setPlayer(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
  }

  player() {
    return {
      x: this.playerX,
      y: this.playerY,
      health: this.playerHealth(),
      radius: this.catalog.player.radius,
    };
  }

  foes(): readonly MeleeFoeState[] {
    return this.foeStates.map((foe) => ({
      id: foe.id,
      x: foe.x,
      y: foe.y,
      radius: foe.radius,
      health: this.combat.has(foe.id) ? this.combat.get(foe.id).current : 0,
      alive: this.combat.has(foe.id) && this.combat.get(foe.id).current > 0,
      stunnedUntilMs: foe.stunnedUntilMs,
    }));
  }

  foesAlive(): number {
    return this.foeStates.filter((foe) => this.combat.has(foe.id) && this.combat.get(foe.id).current > 0).length;
  }

  playerHealth(): number {
    return this.combat.has(this.catalog.player.id) ? this.combat.get(this.catalog.player.id).current : 0;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): MeleeOutcome {
    return this.current;
  }

  reset(): void {
    this.playerX = this.catalog.player.x;
    this.playerY = this.catalog.player.y;
    this.lastStrikeMs = -1_000_000;
    this.lastContactMs = -1_000_000;
    this.last = null;
    this.current = 'playing';
    this.unregisterFighters();
    this.registerFighters();
  }

  strike(nowMs: number): 'hit' | 'miss' | 'cooldown' {
    if (!this.active() || this.current !== 'playing') return 'miss';
    if (nowMs - this.lastStrikeMs < this.catalog.strike.cooldownMs) {
      this.last = 'cooldown';
      return 'cooldown';
    }
    this.lastStrikeMs = nowMs;
    const target = this.nearestLiving(this.catalog.strike.range);
    if (!target) {
      this.last = 'miss';
      this.events.emit('melee:missed', { attackerId: this.catalog.player.id });
      return 'miss';
    }
    this.hitFoe(target, this.catalog.strike.damage, nowMs, this.catalog.strike.knockback, this.catalog.strike.stunMs);
    this.last = 'hit';
    this.events.emit('melee:struck', { attackerId: this.catalog.player.id, foeId: target.id });
    this.refreshOutcome();
    return 'hit';
  }

  tick(deltaMs: number, nowMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    for (const foe of this.foeStates) {
      if (!(this.combat.has(foe.id) && this.combat.get(foe.id).current > 0)) continue;
      foe.x += foe.vx * (dt / 1000);
      foe.y += foe.vy * (dt / 1000);
      const decay = Math.exp(-dt / 120);
      foe.vx *= decay;
      foe.vy *= decay;
      if (Math.hypot(foe.vx, foe.vy) < 4) {
        foe.vx = 0;
        foe.vy = 0;
      }
    }
    const contact = this.nearestLiving(this.catalog.contact.range);
    if (contact && nowMs - this.lastContactMs >= this.catalog.contact.cooldownMs) {
      this.lastContactMs = nowMs;
      this.combat.damage(this.catalog.player.id, this.catalog.contact.damage, nowMs);
      this.combat.setInvulnerableFor(this.catalog.player.id, this.catalog.contact.cooldownMs, nowMs);
      this.last = 'contact';
      this.events.emit('melee:contact', { foeId: contact.id, health: this.playerHealth() });
    }
    this.refreshOutcome();
  }

  private nearestLiving(maxDistance: number): LiveFoe | null {
    let best: LiveFoe | null = null;
    let bestDistance = maxDistance;
    for (const foe of this.foeStates) {
      if (!(this.combat.has(foe.id) && this.combat.get(foe.id).current > 0)) continue;
      const distance = Math.hypot(this.playerX - foe.x, this.playerY - foe.y);
      if (distance < bestDistance) {
        best = foe;
        bestDistance = distance;
      }
    }
    return best;
  }

  private hitFoe(foe: LiveFoe, amount: number, nowMs: number, knockback: number, stunMs: number): void {
    this.combat.damage(foe.id, amount, nowMs);
    const dx = foe.x - this.playerX;
    const dy = foe.y - this.playerY;
    const dist = Math.hypot(dx, dy) || 1;
    foe.x += (dx / dist) * knockback;
    foe.y += (dy / dist) * knockback;
    foe.vx += (dx / dist) * knockback * 8;
    foe.vy += (dy / dist) * knockback * 8;
    foe.stunnedUntilMs = nowMs + stunMs;
  }

  private refreshOutcome(): void {
    if (this.playerHealth() <= 0) {
      this.current = 'failed';
      this.events.emit('melee:downed', {});
      return;
    }
    if (this.foesAlive() === 0) {
      this.current = 'complete';
      this.events.emit('melee:cleared', { mode: this.catalog.mode });
    }
  }

  private registerFighters(): void {
    this.combat.register(this.catalog.player.id, this.catalog.player.health);
    this.foeStates = this.catalog.foes.map((foe) => {
      this.combat.register(foe.id, foe.health);
      return { id: foe.id, x: foe.x, y: foe.y, radius: foe.radius, vx: 0, vy: 0, stunnedUntilMs: 0 };
    });
  }

  private unregisterFighters(): void {
    this.combat.remove(this.catalog.player.id);
    for (const foe of this.foeStates) this.combat.remove(foe.id);
    this.foeStates = [];
  }
}

export const meleePack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.melee,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.melee],
  dependencies: [CAPABILITY_IDS.combat],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.melee?.value as MeleeCatalog | undefined) ?? EMPTY_CATALOG;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const service = new MeleeServiceImpl(context.events, combat, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.melee, service);
    return {
      id: PACK_IDS.melee,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { MeleeService };
