/**
 * Combat / encounter orchestration (capability program Phase 4).
 *
 * The layer above weapons/projectiles: validated `EncounterDefinition`s drive
 * phases, waves, enemy spawn scheduling, declarative bullet patterns and boss
 * phase transitions. Deterministic and renderer-neutral; a `@sw2d/runtime`
 * bridge materialises spawns and fires patterns through Phase 3's projectile
 * runtime.
 */

export const ENCOUNTERS_CAPABILITY_ID = 'combat.encounters';

/** Where a spawn group places its members. Distribution is deterministic (even spacing). */
export type SpawnPoint =
  | { readonly kind: 'point'; readonly x: number; readonly y: number }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: 'edge'; readonly edge: 'top' | 'bottom' | 'left' | 'right' };

/** A declarative bullet pattern. Produces fire directions; the projectile itself comes from a Phase 3 weapon. */
export type FirePattern =
  | { readonly kind: 'aimed' }
  | { readonly kind: 'fixed'; readonly angleDeg: number }
  | { readonly kind: 'fan'; readonly count: number; readonly spreadDeg: number; readonly aimed?: boolean }
  | { readonly kind: 'ring'; readonly count: number; readonly rotationDeg?: number }
  | { readonly kind: 'spiral'; readonly count: number; readonly rotationStepDeg: number }
  | { readonly kind: 'sweep'; readonly count: number; readonly fromDeg: number; readonly toDeg: number };

export interface EmitterDefinition {
  readonly id: string;
  /** Phase 3 weapon id supplying the projectile spec (speed, lifetime, damage, team). */
  readonly weaponId: string;
  readonly pattern: FirePattern;
  /** Simulation ms between emissions. */
  readonly everyMs: number;
  readonly startDelayMs?: number;
  /** Stop after this many emissions. Omit to run for the whole phase. */
  readonly maxEmissions?: number;
}

export interface SpawnGroupDefinition {
  /** Archetype key the game resolves to a sprite + base health. */
  readonly archetype: string;
  readonly count: number;
  readonly at: SpawnPoint;
  /** Stagger between members of this group. */
  readonly intervalMs?: number;
  readonly startDelayMs?: number;
  /** Overrides the archetype's base health. */
  readonly health?: number;
  /** Emitters each spawned member carries (bullet-hell enemies that shoot). */
  readonly emitterIds?: readonly string[];
}

/** Bounded conditions for completing a phase. */
export type EncounterCondition =
  | { readonly kind: 'elapsed'; readonly ms: number }
  | { readonly kind: 'spawns-cleared' }
  | { readonly kind: 'entity-health-below'; readonly entityId: string; readonly fraction: number }
  | { readonly kind: 'flag'; readonly flag: string; readonly value?: boolean };

export interface EncounterPhaseDefinition {
  readonly id: string;
  readonly spawns?: readonly SpawnGroupDefinition[];
  /** Phase-level emitters (a boss body firing). Origin supplied by the bridge via `bossOrigin`. */
  readonly emitters?: readonly EmitterDefinition[];
  readonly completeWhen: EncounterCondition;
  /** On entering this phase, make the boss invulnerable for this long. */
  readonly onEnterInvulnMs?: number;
  /** On entering this phase, set a world flag. */
  readonly onEnterFlag?: { readonly flag: string; readonly value: boolean };
}

export interface EncounterDefinition {
  readonly id: string;
  readonly phases: readonly EncounterPhaseDefinition[];
  /** A persistent boss entity id the phases' health conditions reference. */
  readonly bossEntityId?: string;
}

export interface EncounterCatalog {
  readonly schemaVersion: number;
  readonly encounters: readonly EncounterDefinition[];
}

// --- Runtime output --------------------------------------------------

export interface EncounterSpawnRequest {
  /** Deterministic id; also the handle for `reportDeath`. */
  readonly requestId: string;
  readonly archetype: string;
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly emitterIds: readonly string[];
  readonly phaseId: string;
}

export interface EncounterFireRequest {
  readonly emitterId: string;
  readonly weaponId: string;
  /** The spawned entity firing, or null for a phase-level (boss) emitter. */
  readonly sourceRequestId: string | null;
  readonly originX: number;
  readonly originY: number;
  readonly dirs: readonly (readonly [number, number])[];
}

export interface EncounterTick {
  readonly spawns: readonly EncounterSpawnRequest[];
  readonly fires: readonly EncounterFireRequest[];
  /** Phase id newly entered this tick, or null. */
  readonly enteredPhaseId: string | null;
  readonly completed: boolean;
}

export interface EncounterState {
  readonly encounterId: string | null;
  readonly phaseId: string | null;
  readonly phaseIndex: number;
  readonly elapsedInPhaseMs: number;
  readonly liveSpawnCount: number;
  readonly completed: boolean;
}

/** State the service reads back from the game each `update()`. */
export interface EncounterUpdateContext {
  /** Unit direction from a source point toward the player (for `aimed` / `fan` aimed). */
  aimAt(sourceX: number, sourceY: number): readonly [number, number];
  /** 0..1 health fraction of an entity, for `entity-health-below`. */
  healthFraction(entityId: string): number;
  /** World-flag lookup for `flag` conditions. */
  flag(name: string): boolean;
  /** Current origin of a live spawned entity, for entity-carried emitters. Null if gone. */
  originOf(requestId: string): readonly [number, number] | null;
  /** Origin for phase-level emitters. */
  bossOrigin(): readonly [number, number];
  /** Play area size, for `edge` spawn points. */
  viewport(): { readonly width: number; readonly height: number };
}

export interface EncounterService {
  lookup(id: string): EncounterDefinition | undefined;
  definitionIds(): readonly string[];
  start(encounterId: string): void;
  stop(): void;
  update(deltaMs: number, context: EncounterUpdateContext): EncounterTick;
  /** Report that a spawned entity died. Drives `spawns-cleared`. */
  reportDeath(requestId: string): void;
  state(): EncounterState;
}

// --- Pure pattern expansion ----------------------------------------

function fromDeg(deg: number): readonly [number, number] {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

function angleOf(dir: readonly [number, number]): number {
  return (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
}

/**
 * Expand a fire pattern into a deterministic set of unit directions.
 * `emissionIndex` advances the rotating patterns (spiral, sweep).
 */
export function expandFirePattern(
  pattern: FirePattern,
  aimDir: readonly [number, number],
  emissionIndex: number,
): readonly (readonly [number, number])[] {
  switch (pattern.kind) {
    case 'aimed':
      return [aimDir];
    case 'fixed':
      return [fromDeg(pattern.angleDeg)];
    case 'fan': {
      const centre = pattern.aimed ? angleOf(aimDir) : 0;
      const n = Math.max(1, pattern.count);
      if (n === 1) return [fromDeg(centre)];
      const step = pattern.spreadDeg / (n - 1);
      return Array.from({ length: n }, (_, i) => fromDeg(centre - pattern.spreadDeg / 2 + i * step));
    }
    case 'ring': {
      const n = Math.max(1, pattern.count);
      const base = pattern.rotationDeg ?? 0;
      return Array.from({ length: n }, (_, i) => fromDeg(base + (360 / n) * i));
    }
    case 'spiral': {
      const n = Math.max(1, pattern.count);
      const base = pattern.rotationStepDeg * emissionIndex;
      return Array.from({ length: n }, (_, i) => fromDeg(base + (360 / n) * i));
    }
    case 'sweep': {
      const n = Math.max(2, pattern.count);
      const t = (emissionIndex % n) / (n - 1);
      return [fromDeg(pattern.fromDeg + (pattern.toDeg - pattern.fromDeg) * t)];
    }
  }
}
