/**
 * Capture-zone / territory ownership (Category-C Wave 32).
 *
 * Renderer-neutral occupancy over time. Two bounded modes:
 *   - `stand`   — one occupant (the player) holds circles to own them.
 *   - `occupy`  — a commanded unit holds circles to own them.
 *
 * Not box-select and not strategy.turns.
 */

export const TERRITORY_CAPABILITY_ID = 'strategy.zones';

export type TerritoryMode = 'stand' | 'occupy';
export type TerritoryOutcome = 'playing' | 'complete';

export interface TerritoryZoneDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly holdMs: number;
}

export interface TerritoryOccupant {
  readonly faction: string;
  readonly x: number;
  readonly y: number;
}

export interface TerritoryCatalog {
  readonly schemaVersion: number;
  readonly mode: TerritoryMode;
  readonly zones: readonly TerritoryZoneDef[];
  readonly factions?: readonly string[];
  readonly victoryScore?: number;
}

export interface TerritoryService {
  mode(): TerritoryMode;
  active(): boolean;
  setOccupant(x: number, y: number): void;
  setOccupants(occupants: readonly TerritoryOccupant[]): void;
  tick(deltaMs: number): void;
  owned(): readonly string[];
  owner(zoneId: string): string | null;
  holding(): string | null;
  contested(): readonly string[];
  progress(zoneId: string): number;
  score(faction: string): number;
  lastResult(): string | null;
  outcome(): TerritoryOutcome;
  reset(): void;
}
