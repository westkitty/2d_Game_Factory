import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Combat pack: a reusable entity-keyed health/damage capability.
 *
 * This is deliberately not a combat system - no weapons, projectiles, melee
 * collision, knockback physics or status effects. Those interpret this
 * capability; they are not part of it (MASTER_PROJECT.md §9.7 lists the
 * fuller family - this is the foundational health/damage core it composes
 * from).
 */

export interface HealthState {
  readonly current: number;
  readonly max: number;
  /** Timestamp (caller-supplied `nowMs`, never read from the wall clock) before which damage is rejected. */
  readonly invulnerableUntilMs: number;
}

export class UnknownCombatEntityError extends Error {
  constructor(entityId: string) {
    super(`No combat entity registered with id "${entityId}".`);
    this.name = 'UnknownCombatEntityError';
  }
}

export class DuplicateCombatEntityError extends Error {
  constructor(entityId: string) {
    super(`Combat entity "${entityId}" is already registered.`);
    this.name = 'DuplicateCombatEntityError';
  }
}

export interface CombatService {
  register(entityId: string, maxHealth: number): void;
  has(entityId: string): boolean;
  get(entityId: string): HealthState;
  /** Bounded (clamped to [0, max]) and deterministic: no RNG, no wall-clock reads. */
  damage(entityId: string, amount: number, nowMs: number): HealthState;
  heal(entityId: string, amount: number): HealthState;
  /** Damage is rejected (state unchanged, no event) while `nowMs < invulnerableUntilMs`. */
  setInvulnerableFor(entityId: string, durationMs: number, nowMs: number): void;
  /** Idempotent: removing an unregistered id is a no-op, so teardown never needs an existence check. */
  remove(entityId: string): void;
  list(): readonly string[];
}

function requireFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite number >= 0, got ${value}.`);
  }
}

class CombatServiceImpl implements CombatService {
  readonly #entities = new Map<string, HealthState>();
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  register(entityId: string, maxHealth: number): void {
    if (this.#entities.has(entityId)) throw new DuplicateCombatEntityError(entityId);
    requireFinitePositive(maxHealth, 'maxHealth');
    if (maxHealth <= 0) throw new RangeError(`maxHealth must be > 0, got ${maxHealth}.`);
    this.#entities.set(entityId, { current: maxHealth, max: maxHealth, invulnerableUntilMs: 0 });
  }

  has(entityId: string): boolean {
    return this.#entities.has(entityId);
  }

  get(entityId: string): HealthState {
    const state = this.#entities.get(entityId);
    if (!state) throw new UnknownCombatEntityError(entityId);
    return state;
  }

  damage(entityId: string, amount: number, nowMs: number): HealthState {
    const state = this.get(entityId);
    requireFinitePositive(amount, 'amount');
    if (nowMs < state.invulnerableUntilMs) return state; // rejected: no mutation, no event

    const wasAlive = state.current > 0;
    const current = Math.max(0, state.current - amount);
    const next: HealthState = { ...state, current };
    this.#entities.set(entityId, next);

    if (amount > 0) this.#events.emit('combat:entityDamaged', { entityId, amount, current });
    if (wasAlive && current === 0) this.#events.emit('combat:entityDied', { entityId });
    return next;
  }

  heal(entityId: string, amount: number): HealthState {
    const state = this.get(entityId);
    requireFinitePositive(amount, 'amount');
    const current = Math.min(state.max, state.current + amount);
    const next: HealthState = { ...state, current };
    this.#entities.set(entityId, next);
    return next;
  }

  setInvulnerableFor(entityId: string, durationMs: number, nowMs: number): void {
    const state = this.get(entityId);
    requireFinitePositive(durationMs, 'durationMs');
    this.#entities.set(entityId, { ...state, invulnerableUntilMs: nowMs + durationMs });
  }

  remove(entityId: string): void {
    this.#entities.delete(entityId);
  }

  list(): readonly string[] {
    return [...this.#entities.keys()].sort();
  }
}

export const combatPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.combat,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.combat],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new CombatServiceImpl(context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.combat, service);

    return {
      id: PACK_IDS.combat,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
