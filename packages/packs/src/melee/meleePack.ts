/**
 * Melee strike / knockback / hit-stun / combo / directional pack
 * (Category-C capability program, Wave 6; combo chain, facing arc, foe
 * pursuit, player hit-stun and `target()` added by the Final Product
 * Completion program, Wave 2 - matrix L04).
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
  MeleeStrikeResult,
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
  speed: number;
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
  private faceX = 1;
  private faceY = 0;
  private foeStates: LiveFoe[];
  private lastStrikeMs = -1_000_000;
  private lastContactMs = -1_000_000;
  private lastHitMs = -1_000_000;
  private chain = 0;
  private best = 0;
  private playerStunUntilMs = -1_000_000;
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

  setFacing(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    this.faceX = dx / len;
    this.faceY = dy / len;
  }

  facing(): { readonly x: number; readonly y: number } {
    return { x: this.faceX, y: this.faceY };
  }

  arcDeg(): number {
    return this.catalog.arcDeg ?? 360;
  }

  target(): MeleeFoeState | null {
    const foe = this.nearestLiving(this.catalog.strike.range, true);
    return foe ? this.foes().find((f) => f.id === foe.id) ?? null : null;
  }

  comboStep(): number {
    return this.chain;
  }

  comboWindowLeftMs(nowMs: number): number {
    if (this.chain === 0 || !this.catalog.combo) return 0;
    return Math.max(0, this.catalog.combo.windowMs - (nowMs - this.lastHitMs));
  }

  bestCombo(): number {
    return this.best;
  }

  playerStunned(nowMs: number): boolean {
    return nowMs < this.playerStunUntilMs;
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
    this.faceX = 1;
    this.faceY = 0;
    this.lastStrikeMs = -1_000_000;
    this.lastContactMs = -1_000_000;
    this.lastHitMs = -1_000_000;
    this.chain = 0;
    this.best = 0;
    this.playerStunUntilMs = -1_000_000;
    this.last = null;
    this.current = 'playing';
    this.unregisterFighters();
    this.registerFighters();
  }

  strike(nowMs: number): MeleeStrikeResult {
    if (!this.active() || this.current !== 'playing') return 'miss';
    if (this.playerStunned(nowMs)) {
      this.last = 'stunned';
      return 'stunned';
    }
    if (nowMs - this.lastStrikeMs < this.catalog.strike.cooldownMs) {
      this.last = 'cooldown';
      return 'cooldown';
    }
    this.lastStrikeMs = nowMs;
    // The combo window closing between strikes resets the chain first.
    if (this.catalog.combo && this.chain > 0 && nowMs - this.lastHitMs > this.catalog.combo.windowMs) {
      this.chain = 0;
      this.events.emit('melee:comboReset', { reason: 'window' });
    }
    const target = this.nearestLiving(this.catalog.strike.range, true);
    if (!target) {
      if (this.chain > 0) this.events.emit('melee:comboReset', { reason: 'whiff' });
      this.chain = 0;
      this.last = 'miss';
      this.events.emit('melee:missed', { attackerId: this.catalog.player.id });
      return 'miss';
    }
    const combo = this.catalog.combo;
    const step = combo && combo.steps.length > 0 ? combo.steps[Math.min(this.chain, combo.steps.length - 1)]! : null;
    const damage = step?.damage ?? this.catalog.strike.damage;
    const knockback = step?.knockback ?? this.catalog.strike.knockback;
    const stunMs = step?.stunMs ?? this.catalog.strike.stunMs;
    this.hitFoe(target, damage, nowMs, knockback, stunMs);
    this.lastHitMs = nowMs;
    if (combo && combo.steps.length > 0) {
      this.chain = this.chain >= combo.steps.length ? 1 : this.chain + 1;
      if (this.chain > this.best) this.best = this.chain;
      this.last = `hit-${this.chain}`;
      this.events.emit('melee:combo', { step: this.chain, of: combo.steps.length, foeId: target.id });
    } else {
      this.last = 'hit';
    }
    this.events.emit('melee:struck', { attackerId: this.catalog.player.id, foeId: target.id });
    this.refreshOutcome();
    return 'hit';
  }

  tick(deltaMs: number, nowMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    if (this.catalog.combo && this.chain > 0 && nowMs - this.lastHitMs > this.catalog.combo.windowMs) {
      this.chain = 0;
      this.events.emit('melee:comboReset', { reason: 'window' });
    }
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
      // Pursuit: a foe with a speed closes on the player unless stunned or
      // already in contact range.
      if (foe.speed > 0 && nowMs >= foe.stunnedUntilMs) {
        const dx = this.playerX - foe.x;
        const dy = this.playerY - foe.y;
        const dist = Math.hypot(dx, dy);
        const stopAt = this.catalog.contact.range * 0.8;
        if (dist > stopAt) {
          const step = Math.min(foe.speed * (dt / 1000), dist - stopAt);
          foe.x += (dx / dist) * step;
          foe.y += (dy / dist) * step;
        }
      }
    }
    const contact = this.nearestLiving(this.catalog.contact.range, false, nowMs);
    if (contact && nowMs - this.lastContactMs >= this.catalog.contact.cooldownMs) {
      this.lastContactMs = nowMs;
      this.combat.damage(this.catalog.player.id, this.catalog.contact.damage, nowMs);
      this.combat.setInvulnerableFor(this.catalog.player.id, this.catalog.contact.cooldownMs, nowMs);
      const stun = this.catalog.contact.stunMs ?? 0;
      if (stun > 0) this.playerStunUntilMs = nowMs + stun;
      if (this.chain > 0) this.events.emit('melee:comboReset', { reason: 'hit' });
      this.chain = 0;
      this.last = 'contact';
      this.events.emit('melee:contact', { foeId: contact.id, health: this.playerHealth() });
    }
    this.refreshOutcome();
  }

  /**
   * Nearest living foe within `maxDistance`. With `inArc` the foe must also
   * lie inside the facing cone (directional attacks); with `nowMs` a stunned
   * foe is skipped (a stunned foe cannot deal contact damage).
   */
  private nearestLiving(maxDistance: number, inArc = false, nowMs?: number): LiveFoe | null {
    let best: LiveFoe | null = null;
    let bestDistance = maxDistance;
    const halfArc = ((this.catalog.arcDeg ?? 360) / 2) * (Math.PI / 180);
    for (const foe of this.foeStates) {
      if (!(this.combat.has(foe.id) && this.combat.get(foe.id).current > 0)) continue;
      if (nowMs !== undefined && nowMs < foe.stunnedUntilMs) continue;
      const dx = foe.x - this.playerX;
      const dy = foe.y - this.playerY;
      const distance = Math.hypot(dx, dy);
      if (distance >= bestDistance) continue;
      if (inArc && halfArc < Math.PI && distance > 1e-6) {
        const cos = (dx * this.faceX + dy * this.faceY) / distance;
        if (Math.acos(Math.max(-1, Math.min(1, cos))) > halfArc) continue;
      }
      best = foe;
      bestDistance = distance;
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
      return { id: foe.id, x: foe.x, y: foe.y, radius: foe.radius, speed: foe.speed ?? 0, vx: 0, vy: 0, stunnedUntilMs: 0 };
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
  version: '0.2.0',
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
