/**
 * Attack range, target selection and autonomous strikes (Category-C Wave 37).
 *
 * Renderer-neutral combat targeting. Three bounded modes:
 *   - `tower` — attackers auto-pick nearest in-range targets and strike.
 *   - `auto`  — two sides auto-strike until one HP pool is gone.
 *   - `range` — a player strike is valid only inside authored range.
 *
 * Composes with combat.health. Not a full AI / pathfinding pack.
 */

export const TARGETING_CAPABILITY_ID = 'combat.targeting';

export type TargetingMode = 'tower' | 'auto' | 'range';
export type TargetingOutcome = 'playing' | 'complete' | 'failed';

export interface TargetingActorDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly range: number;
  readonly damage: number;
  readonly cooldownMs: number;
  readonly team: 'player' | 'enemy';
  readonly health: number;
}

export interface TargetingCatalog {
  readonly schemaVersion: number;
  readonly mode: TargetingMode;
  readonly actors: readonly TargetingActorDef[];
}

export interface TargetingService {
  mode(): TargetingMode;
  active(): boolean;
  setPos(id: string, x: number, y: number): void;
  tick(deltaMs: number, nowMs: number): void;
  canStrike(attackerId: string, targetId: string): boolean;
  pick(attackerId: string): string | null;
  strike(attackerId: string, targetId: string, nowMs: number): boolean;
  alive(team: 'player' | 'enemy'): number;
  lastResult(): string | null;
  outcome(): TargetingOutcome;
  reset(): void;
}
