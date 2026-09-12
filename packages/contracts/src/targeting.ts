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

export interface TargetingSlotDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface TargetingUpgradeTier {
  readonly cost: number;
  readonly range: number;
  readonly damage: number;
}

export interface TargetingCatalog {
  readonly schemaVersion: number;
  readonly mode: TargetingMode;
  readonly actors: readonly TargetingActorDef[];
  readonly startingGold?: number;
  readonly placeCost?: number;
  readonly slots?: readonly TargetingSlotDef[];
  readonly upgrades?: readonly TargetingUpgradeTier[];
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
  /** Remaining health of one actor (0 when dead or unknown). The pack is the one health owner for its actors; consumers must read it here rather than mirror it. */
  health(actorId: string): number;
  lastResult(): string | null;
  outcome(): TargetingOutcome;
  reset(): void;
  gold(): number;
  slots(): readonly TargetingSlotDef[];
  occupant(slotId: string): string | null;
  previewSlot(x: number, y: number): string | null;
  placeAt(x: number, y: number): boolean;
  upgrade(towerId: string): boolean;
  towerDamage(towerId: string): number;
  towerTier(towerId: string): number;
  placedCount(): number;
  placementRejections(): number;
  upgradeRejections(): number;
}
