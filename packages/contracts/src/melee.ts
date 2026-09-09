/**
 * Melee strike / knockback / hit-stun (Category-C capability program, Wave 6).
 *
 * Renderer-neutral close combat. Composes with `combat.health` rather than
 * forking a second health authority. Not combo strings, not directional
 * attack trees, not a targeting UI.
 *
 * Two bounded modes (not two engines):
 *   - `skirmish` — one elite foe (action-adventure).
 *   - `arena`    — several fodder foes (arena-combat).
 */

export const MELEE_CAPABILITY_ID = 'combat.melee';

export type MeleeMode = 'skirmish' | 'arena';
export type MeleeOutcome = 'playing' | 'complete' | 'failed';

export interface MeleeFighterDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly health: number;
}

export interface MeleeStrikeDef {
  readonly range: number;
  readonly damage: number;
  readonly cooldownMs: number;
  readonly knockback: number;
  readonly stunMs: number;
}

export interface MeleeContactDef {
  readonly range: number;
  readonly damage: number;
  readonly cooldownMs: number;
}

/** The validated `content/melee.json` document. */
export interface MeleeCatalog {
  readonly schemaVersion: number;
  readonly mode: MeleeMode;
  readonly player: MeleeFighterDef;
  readonly foes: readonly MeleeFighterDef[];
  readonly strike: MeleeStrikeDef;
  readonly contact: MeleeContactDef;
}

export interface MeleeFoeState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly health: number;
  readonly alive: boolean;
  readonly stunnedUntilMs: number;
}

export interface MeleeService {
  mode(): MeleeMode;
  /** False when the catalog has no foes (inert empty document). */
  active(): boolean;
  setPlayer(x: number, y: number): void;
  strike(nowMs: number): 'hit' | 'miss' | 'cooldown';
  tick(deltaMs: number, nowMs: number): void;
  player(): { readonly x: number; readonly y: number; readonly health: number; readonly radius: number };
  foes(): readonly MeleeFoeState[];
  foesAlive(): number;
  playerHealth(): number;
  lastResult(): string | null;
  outcome(): MeleeOutcome;
  reset(): void;
}

export class DuplicateMeleeIdError extends Error {
  constructor(id: string) {
    super(`Duplicate melee id "${id}" in content/melee.json.`);
    this.name = 'DuplicateMeleeIdError';
  }
}
