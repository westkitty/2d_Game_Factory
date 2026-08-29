/**
 * AI perception, awareness & pursuit (capability program Phase 11).
 *
 * Renderer-neutral, simulation-time contracts for sensor vision cones,
 * awareness accumulation/decay, noise events, hiding/visibility states,
 * and pursuit pressure calculation.
 */

export const PERCEPTION_CAPABILITY_ID = 'ai.perception';
export const PURSUIT_CAPABILITY_ID = 'ai.pursuit';

export interface PerceptionSensorDefinition {
  readonly id: string;
  readonly visionRange: number;
  readonly fieldOfViewDegrees: number;
  readonly targetTags?: readonly string[];
  readonly targetTeams?: readonly string[];
  readonly awarenessGainPerSecond: number;
  readonly awarenessDecayPerSecond: number;
  readonly memoryMs: number;
  readonly hearingRange: number;
  readonly hearingMultiplier: number;
  readonly updateIntervalMs: number;
  readonly visibilityMultiplierDefault?: number;
}

export type AgentPerceptionStatus = 'calm' | 'suspicious' | 'alert' | 'investigating' | 'pursuit';

export interface TargetPerceptionState {
  readonly targetId: string;
  readonly currentlyVisible: boolean;
  /** 0..1 normalized awareness. */
  readonly awareness: number;
  readonly lastKnownX?: number | undefined;
  readonly lastKnownY?: number | undefined;
  readonly lastSeenSimulationMs?: number | undefined;
  readonly lastHeardSimulationMs?: number | undefined;
  readonly investigationX?: number | undefined;
  readonly investigationY?: number | undefined;
}

export interface NoiseEvent {
  readonly id: string;
  readonly sourceId?: string;
  readonly x: number;
  readonly y: number;
  readonly intensity: number;
  readonly radius: number;
  readonly category: string;
  readonly createdAtSimulationMs: number;
  readonly lifetimeMs: number;
}

export type TargetVisibilityState = 'normal' | 'obscured' | 'hidden';

export interface PursuitDefinition {
  readonly pursuerId: string;
  readonly targetId: string;
  readonly safeDistance: number;
  readonly dangerDistance: number;
  readonly captureDistance: number;
  readonly graceMs: number;
  readonly usePathDistance?: boolean;
}

export interface PursuitState {
  readonly pursuerId: string;
  readonly targetId: string;
  /** Normalized 0..1 pressure meter. */
  readonly pressure: number;
  readonly distance: number;
  readonly isDanger: boolean;
  readonly isCaptured: boolean;
  readonly graceRemainingMs: number;
}

export interface PerceptionCatalog {
  readonly schemaVersion: number;
  readonly sensors: readonly PerceptionSensorDefinition[];
  readonly pursuits?: readonly PursuitDefinition[];
}

export class InvalidPerceptionDefinitionError extends Error {
  constructor(message: string) {
    super(`Invalid perception definition: ${message}`);
    this.name = 'InvalidPerceptionDefinitionError';
  }
}

export class InvalidPursuitDefinitionError extends Error {
  constructor(message: string) {
    super(`Invalid pursuit definition: ${message}`);
    this.name = 'InvalidPursuitDefinitionError';
  }
}

export function validateSensorDefinition(def: PerceptionSensorDefinition): void {
  if (!def.id || typeof def.id !== 'string') {
    throw new InvalidPerceptionDefinitionError('Sensor id must be a non-empty string');
  }
  if (typeof def.visionRange !== 'number' || def.visionRange <= 0) {
    throw new InvalidPerceptionDefinitionError(`visionRange must be > 0 (got ${def.visionRange})`);
  }
  if (typeof def.fieldOfViewDegrees !== 'number' || def.fieldOfViewDegrees <= 0 || def.fieldOfViewDegrees > 360) {
    throw new InvalidPerceptionDefinitionError(`fieldOfViewDegrees must be in (0, 360] (got ${def.fieldOfViewDegrees})`);
  }
  if (typeof def.awarenessGainPerSecond !== 'number' || def.awarenessGainPerSecond < 0) {
    throw new InvalidPerceptionDefinitionError(`awarenessGainPerSecond must be >= 0 (got ${def.awarenessGainPerSecond})`);
  }
  if (typeof def.awarenessDecayPerSecond !== 'number' || def.awarenessDecayPerSecond < 0) {
    throw new InvalidPerceptionDefinitionError(`awarenessDecayPerSecond must be >= 0 (got ${def.awarenessDecayPerSecond})`);
  }
  if (typeof def.memoryMs !== 'number' || def.memoryMs < 0) {
    throw new InvalidPerceptionDefinitionError(`memoryMs must be >= 0 (got ${def.memoryMs})`);
  }
  if (typeof def.hearingRange !== 'number' || def.hearingRange < 0) {
    throw new InvalidPerceptionDefinitionError(`hearingRange must be >= 0 (got ${def.hearingRange})`);
  }
  if (typeof def.hearingMultiplier !== 'number' || def.hearingMultiplier < 0) {
    throw new InvalidPerceptionDefinitionError(`hearingMultiplier must be >= 0 (got ${def.hearingMultiplier})`);
  }
  if (typeof def.updateIntervalMs !== 'number' || def.updateIntervalMs <= 0) {
    throw new InvalidPerceptionDefinitionError(`updateIntervalMs must be > 0 (got ${def.updateIntervalMs})`);
  }
}

export function validatePursuitDefinition(def: PursuitDefinition): void {
  if (!def.pursuerId || typeof def.pursuerId !== 'string') {
    throw new InvalidPursuitDefinitionError('pursuerId must be a non-empty string');
  }
  if (!def.targetId || typeof def.targetId !== 'string') {
    throw new InvalidPursuitDefinitionError('targetId must be a non-empty string');
  }
  if (typeof def.captureDistance !== 'number' || def.captureDistance < 0) {
    throw new InvalidPursuitDefinitionError(`captureDistance must be >= 0 (got ${def.captureDistance})`);
  }
  if (typeof def.dangerDistance !== 'number' || def.dangerDistance < def.captureDistance) {
    throw new InvalidPursuitDefinitionError(
      `dangerDistance must be >= captureDistance (${def.captureDistance}) (got ${def.dangerDistance})`,
    );
  }
  if (typeof def.safeDistance !== 'number' || def.safeDistance <= def.dangerDistance) {
    throw new InvalidPursuitDefinitionError(
      `safeDistance must be > dangerDistance (${def.dangerDistance}) (got ${def.safeDistance})`,
    );
  }
  if (typeof def.graceMs !== 'number' || def.graceMs < 0) {
    throw new InvalidPursuitDefinitionError(`graceMs must be >= 0 (got ${def.graceMs})`);
  }
}

export function calculatePursuitPressure(distance: number, safeDistance: number, dangerDistance: number): number {
  if (distance >= safeDistance) return 0;
  if (distance <= dangerDistance) return 1;
  const range = safeDistance - dangerDistance;
  if (range <= 0) return 1;
  return Math.max(0, Math.min(1, (safeDistance - distance) / range));
}

export function resolveVisibilityMultiplier(visibility: TargetVisibilityState | number | undefined): number {
  if (visibility === undefined) return 1;
  if (typeof visibility === 'number') return Math.max(0, Math.min(1, visibility));
  switch (visibility) {
    case 'hidden':
      return 0;
    case 'obscured':
      return 0.5;
    case 'normal':
    default:
      return 1;
  }
}

export interface PerceptionWorldQueries {
  getSensorTransform(sensorId: string): { x: number; y: number; facingX: number; facingY: number } | undefined;
  getTargetTransform(targetId: string): { x: number; y: number } | undefined;
  isOccluded?(fromX: number, fromY: number, toX: number, toY: number): boolean;
}

export interface PerceptionService {
  registerSensor(definition: PerceptionSensorDefinition): void;
  unregisterSensor(sensorId: string): void;
  sensor(sensorId: string): PerceptionSensorDefinition | undefined;
  sensorIds(): readonly string[];

  registerTarget(target: { id: string; tags?: readonly string[]; team?: string }): void;
  unregisterTarget(targetId: string): void;
  setTargetVisibility(targetId: string, visibility: TargetVisibilityState | number): void;
  targetVisibility(targetId: string): number;

  addNoise(noise: Omit<NoiseEvent, 'createdAtSimulationMs'> & { createdAtSimulationMs?: number }): void;
  activeNoises(): readonly NoiseEvent[];

  targetState(sensorId: string, targetId: string): TargetPerceptionState | undefined;
  sensorStatus(sensorId: string): AgentPerceptionStatus;

  update(deltaMs: number, queries: PerceptionWorldQueries): void;
  dispose(): void;
}

export interface PursuitService {
  registerPursuit(definition: PursuitDefinition): void;
  unregisterPursuit(pursuerId: string): void;
  pursuitState(pursuerId: string): PursuitState | undefined;
  update(deltaMs: number, distanceResolver?: (pursuerId: string, targetId: string) => number): void;
  dispose(): void;
}
