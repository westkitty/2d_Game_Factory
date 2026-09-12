/**
 * Melee strike / knockback / hit-stun / combos / directional attacks
 * (Category-C capability program, Wave 6; combos, facing arc, foe pursuit,
 * player hit-stun and the targeting affordance added by the Final Product
 * Completion program, Wave 2 - matrix L04).
 *
 * Renderer-neutral close combat. Composes with `combat.health` rather than
 * forking a second health authority.
 *
 * Two bounded modes (not two engines):
 *   - `skirmish` — one elite foe (action-adventure).
 *   - `arena`    — several fodder foes (arena-combat).
 *
 * Combo grammar: consecutive landed strikes inside `combo.windowMs` advance
 * the chain through `combo.steps` (each step its own damage / knockback /
 * stun); the window closing, a whiff, or taking a hit resets the chain.
 * Directional attacks: a strike only reaches foes inside the `arcDeg` cone
 * centred on the facing the shell reports through `setFacing`. Foes with a
 * `speed` pursue the player and stop while stunned. The service exposes the
 * current `target()` (nearest foe in range and arc) so a shell can draw a
 * targeting affordance without recomputing geometry.
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
  /** Pursuit speed toward the player in px/s (0 / omitted = stationary). */
  readonly speed?: number;
}

export interface MeleeComboStepDef {
  readonly damage: number;
  readonly knockback: number;
  readonly stunMs: number;
}

export interface MeleeComboDef {
  /** Ordered chain; step 0 is the opener. */
  readonly steps: readonly MeleeComboStepDef[];
  /** A follow-up must land within this many ms of the previous hit. */
  readonly windowMs: number;
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
  /** Player hit-stun after a contact hit: no strikes, combo reset. Default 0. */
  readonly stunMs?: number;
}

/** The validated `content/melee.json` document. */
export interface MeleeCatalog {
  readonly schemaVersion: number;
  readonly mode: MeleeMode;
  readonly player: MeleeFighterDef;
  readonly foes: readonly MeleeFighterDef[];
  readonly strike: MeleeStrikeDef;
  readonly contact: MeleeContactDef;
  /** Optional combo chain; absent = every strike is the plain `strike`. */
  readonly combo?: MeleeComboDef;
  /** Attack cone in degrees centred on facing; absent / 360 = all around. */
  readonly arcDeg?: number;
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

export type MeleeStrikeResult = 'hit' | 'miss' | 'cooldown' | 'stunned';

export interface MeleeService {
  mode(): MeleeMode;
  /** False when the catalog has no foes (inert empty document). */
  active(): boolean;
  setPlayer(x: number, y: number): void;
  /** Unit facing the next strike is aimed along (defaults to +x). */
  setFacing(dx: number, dy: number): void;
  facing(): { readonly x: number; readonly y: number };
  strike(nowMs: number): MeleeStrikeResult;
  tick(deltaMs: number, nowMs: number): void;
  /** Nearest living foe inside strike range and the facing arc, or null. */
  target(): MeleeFoeState | null;
  /** 0 = no chain in progress; 1..steps = the number of hits landed in the current chain. */
  comboStep(): number;
  /** ms left to land the next follow-up, 0 when no chain is open. */
  comboWindowLeftMs(nowMs: number): number;
  /** Highest combo reached this run (HUD / proof). */
  bestCombo(): number;
  /** True while the player is hit-stunned (cannot strike). */
  playerStunned(nowMs: number): boolean;
  arcDeg(): number;
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
