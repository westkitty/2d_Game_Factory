/**
 * Reusable vehicle handling (capability program Phase 10).
 *
 * Renderer-neutral, simulation-time. The `vehicleController` (ADR-0009) stays
 * INPUT INTENT ONLY - steering / throttle / brake / boost. This service turns
 * that intent plus a bounded tuning definition into vehicle motion. Racing
 * state (checkpoints, laps, time trial) is a SEPARATE capability (racing.ts).
 *
 * One reusable system, four bounded profiles - car / kart / boat / flight -
 * not four engines.
 */

import type { VehicleIntent } from './controllers.ts';

export const VEHICLE_MOTION_CAPABILITY_ID = 'vehicle.motion';

export type VehicleProfile = 'car' | 'kart' | 'boat' | 'flight';

/** Multipliers a tagged surface applies to bounded handling attributes. All default 1. */
export interface VehicleSurfaceModifier {
  readonly traction?: number;
  readonly drag?: number;
  readonly maxSpeed?: number;
  readonly steering?: number;
}

export interface VehicleDefinition {
  readonly id: string;
  readonly profile: VehicleProfile;
  /** Units/s^2 forward. */
  readonly acceleration: number;
  readonly braking: number;
  readonly reverseAcceleration: number;
  readonly maxForwardSpeed: number;
  readonly maxReverseSpeed: number;
  /** Radians/s of heading change at full lock, before speed sensitivity. */
  readonly steeringRate: number;
  /**
   * 0 = steering is speed-independent; 1 = steering fades to ~half at max
   * speed. Bounded, not a curve.
   */
  readonly speedSensitiveSteering: number;
  /** Per-second velocity retention (0..1). Lower = more drag. */
  readonly drag: number;
  /** 0..1: how strongly lateral (sideways) velocity is suppressed each step. 1 = no slide. */
  readonly lateralGrip: number;
  /** 0..1: fraction of steering that also rotates the velocity vector (grip feel). */
  readonly traction: number;
  /** 0..1: extra lateral slip allowed while the secondary/drift action is held. */
  readonly driftFactor: number;
  readonly boostForce: number;
  readonly boostDurationMs: number;
  readonly boostCooldownMs: number;
  /** Flight profile only. */
  readonly altitudeRate?: number;
  readonly minAltitude?: number;
  readonly maxAltitude?: number;
  /** Tag -> modifier. Applied when `update` is told the current surface tag. */
  readonly surfaceModifiers?: Readonly<Record<string, VehicleSurfaceModifier>>;
}

export interface VehicleSpawn {
  readonly x: number;
  readonly y: number;
  /** Heading in radians. 0 points +x. */
  readonly heading: number;
}

export interface VehicleState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  /** Signed speed along the heading. */
  readonly forwardSpeed: number;
  /** Signed speed perpendicular to the heading (the slide). */
  readonly lateralSpeed: number;
  /** Euclidean speed. */
  readonly speed: number;
  readonly boosting: boolean;
  readonly boostCooldownRemainingMs: number;
  readonly drifting: boolean;
  /** Flight profile only; 0 for ground vehicles. */
  readonly altitude: number;
}

export interface VehicleCatalog {
  readonly schemaVersion: number;
  readonly vehicles: readonly VehicleDefinition[];
}

export interface VehicleService {
  definitionIds(): readonly string[];
  /** Make `vehicleId` the active vehicle at `spawn`. Throws for an unknown id. */
  load(vehicleId: string, spawn: VehicleSpawn): void;
  /**
   * Advance the active vehicle by `deltaMs` of simulation time under `intent`.
   * `surfaceTag` names the surface the vehicle is currently on (looked up in
   * the definition's `surfaceModifiers`). Returns the new state. Deterministic.
   */
  update(deltaMs: number, intent: VehicleIntent, surfaceTag?: string): VehicleState;
  state(): VehicleState;
  /** Reset the active vehicle to its spawn, boost cooldown cleared. */
  reset(): void;
}

export class UnknownVehicleError extends Error {
  constructor(id: string) {
    super(`No vehicle defined with id "${id}" in content/vehicles.json.`);
    this.name = 'UnknownVehicleError';
  }
}

/** Sensible profile presets, used by the generator and as `load` fallbacks. */
export const VEHICLE_PROFILE_DEFAULTS: Readonly<Record<VehicleProfile, Omit<VehicleDefinition, 'id' | 'profile'>>> = {
  car: {
    acceleration: 520,
    braking: 780,
    reverseAcceleration: 260,
    maxForwardSpeed: 340,
    maxReverseSpeed: 120,
    steeringRate: 2.6,
    speedSensitiveSteering: 0.5,
    drag: 0.7,
    lateralGrip: 0.9,
    traction: 0.85,
    driftFactor: 0.15,
    boostForce: 320,
    boostDurationMs: 900,
    boostCooldownMs: 2600,
  },
  kart: {
    acceleration: 620,
    braking: 700,
    reverseAcceleration: 240,
    maxForwardSpeed: 320,
    maxReverseSpeed: 110,
    steeringRate: 3.6,
    speedSensitiveSteering: 0.3,
    drag: 0.72,
    lateralGrip: 0.72,
    traction: 0.7,
    driftFactor: 0.55,
    boostForce: 360,
    boostDurationMs: 800,
    boostCooldownMs: 2000,
  },
  boat: {
    acceleration: 300,
    braking: 180,
    reverseAcceleration: 120,
    maxForwardSpeed: 260,
    maxReverseSpeed: 80,
    steeringRate: 1.5,
    speedSensitiveSteering: 0.2,
    drag: 0.9,
    lateralGrip: 0.35,
    traction: 0.4,
    driftFactor: 0.2,
    boostForce: 220,
    boostDurationMs: 1100,
    boostCooldownMs: 3000,
  },
  flight: {
    acceleration: 420,
    braking: 260,
    reverseAcceleration: 0,
    maxForwardSpeed: 400,
    maxReverseSpeed: 0,
    steeringRate: 2.0,
    speedSensitiveSteering: 0.1,
    drag: 0.92,
    lateralGrip: 0.55,
    traction: 0.5,
    driftFactor: 0.1,
    boostForce: 300,
    boostDurationMs: 1000,
    boostCooldownMs: 2600,
    altitudeRate: 90,
    minAltitude: 0,
    maxAltitude: 240,
  },
};
