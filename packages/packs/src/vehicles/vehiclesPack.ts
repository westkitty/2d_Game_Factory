import type {
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
  VehicleCatalog,
  VehicleDefinition,
  VehicleIntent,
  VehicleService,
  VehicleSpawn,
  VehicleState,
} from '@sw2d/contracts';
import { UnknownVehicleError, VEHICLE_PROFILE_DEFAULTS } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Vehicles pack: reusable vehicle handling (capability program Phase 10),
 * publishing `vehicle.motion`. Pure simulation-time math over `VehicleIntent`
 * plus a bounded tuning definition - no Phaser, no wall-clock. One reusable
 * update with four bounded profiles (car / kart / boat / flight).
 *
 * `race.state` is a separate pack; this one never counts a lap.
 */

const ZERO_STATE: VehicleState = {
  x: 0,
  y: 0,
  heading: 0,
  forwardSpeed: 0,
  lateralSpeed: 0,
  speed: 0,
  boosting: false,
  boostCooldownRemainingMs: 0,
  drifting: false,
  altitude: 0,
};

class VehicleServiceImpl implements VehicleService {
  readonly #defs = new Map<string, VehicleDefinition>();
  #active: VehicleDefinition | null = null;
  #spawn: VehicleSpawn = { x: 0, y: 0, heading: 0 };
  #x = 0;
  #y = 0;
  #heading = 0;
  #fwd = 0;
  #lat = 0;
  #altitude = 0;
  #boostMs = 0;
  #cooldownMs = 0;

  constructor(catalog: VehicleCatalog | undefined) {
    for (const def of catalog?.vehicles ?? []) {
      if (this.#defs.has(def.id)) throw new Error(`Duplicate vehicle id "${def.id}" in content/vehicles.json.`);
      this.#defs.set(def.id, def);
    }
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  load(vehicleId: string, spawn: VehicleSpawn): void {
    const def = this.#defs.get(vehicleId);
    if (!def) throw new UnknownVehicleError(vehicleId);
    this.#active = { ...VEHICLE_PROFILE_DEFAULTS[def.profile], ...def };
    this.#spawn = spawn;
    this.reset();
  }

  reset(): void {
    this.#x = this.#spawn.x;
    this.#y = this.#spawn.y;
    this.#heading = this.#spawn.heading;
    this.#fwd = 0;
    this.#lat = 0;
    this.#altitude = this.#active?.minAltitude ?? 0;
    this.#boostMs = 0;
    this.#cooldownMs = 0;
  }

  update(deltaMs: number, intent: VehicleIntent, surfaceTag?: string): VehicleState {
    const def = this.#active;
    if (!def || deltaMs <= 0) return this.state();
    const dt = deltaMs / 1000;
    const mod = (surfaceTag && def.surfaceModifiers?.[surfaceTag]) || {};
    const traction = def.traction * (mod.traction ?? 1);
    const drag = Math.min(1, def.drag * (mod.drag ?? 1));
    const maxFwd = def.maxForwardSpeed * (mod.maxSpeed ?? 1);
    const steerMul = mod.steering ?? 1;

    // --- boost state (simulation time) ---
    if (this.#cooldownMs > 0) this.#cooldownMs = Math.max(0, this.#cooldownMs - deltaMs);
    if (this.#boostMs > 0) this.#boostMs = Math.max(0, this.#boostMs - deltaMs);
    if (intent.boostPressed && this.#boostMs === 0 && this.#cooldownMs === 0) {
      this.#boostMs = def.boostDurationMs;
      this.#cooldownMs = def.boostCooldownMs;
    }
    const boosting = this.#boostMs > 0;

    // --- longitudinal: accelerate / brake / reverse ---
    let accel = 0;
    if (intent.throttle > 0) accel += def.acceleration * intent.throttle;
    if (boosting) accel += def.boostForce;
    if (intent.brake > 0) {
      if (this.#fwd > 1) accel -= def.braking * intent.brake;
      else accel -= def.reverseAcceleration * intent.brake;
    }
    this.#fwd += accel * dt;
    // Drag pulls both components toward zero each step.
    const dragKeep = Math.pow(drag, dt);
    this.#fwd *= dragKeep;
    this.#lat *= dragKeep;
    this.#fwd = Math.max(-def.maxReverseSpeed, Math.min(maxFwd, this.#fwd));

    // --- steering: heading change, faded with speed by speedSensitiveSteering ---
    const speedFrac = maxFwd > 0 ? Math.min(1, Math.abs(this.#fwd) / maxFwd) : 0;
    const steerScale = 1 - def.speedSensitiveSteering * 0.5 * speedFrac;
    const dir = this.#fwd >= 0 ? 1 : -1;
    const drifting = intent.secondaryPressed && Math.abs(this.#fwd) > 20 && def.driftFactor > 0;
    this.#heading += intent.steering * def.steeringRate * steerScale * steerMul * dt * dir;

    // --- grip: how much of the turn also swings the velocity vector, and how ---
    // --- hard the sideways slide is suppressed (looser while drifting) ---
    const gripNow = drifting ? Math.max(0, def.lateralGrip * (1 - def.driftFactor)) : def.lateralGrip;
    // steering injects lateral velocity (the slide); grip + traction bleed it off
    this.#lat += intent.steering * this.#fwd * (1 - gripNow) * (1 - traction * 0.4) * 0.6 * dt;
    this.#lat *= Math.max(0, 1 - gripNow * dt * 12);

    // --- flight altitude ---
    if (def.profile === 'flight' && def.altitudeRate) {
      const climb = intent.throttle > 0 && intent.boostHeld ? 1 : intent.brake > 0 ? -1 : 0;
      this.#altitude = Math.max(def.minAltitude ?? 0, Math.min(def.maxAltitude ?? 0, this.#altitude + climb * def.altitudeRate * dt));
    }

    // --- integrate position along heading + lateral ---
    const cos = Math.cos(this.#heading);
    const sin = Math.sin(this.#heading);
    this.#x += (cos * this.#fwd + -sin * this.#lat) * dt;
    this.#y += (sin * this.#fwd + cos * this.#lat) * dt;

    return this.state();
  }

  state(): VehicleState {
    if (!this.#active) return ZERO_STATE;
    return {
      x: this.#x,
      y: this.#y,
      heading: this.#heading,
      forwardSpeed: this.#fwd,
      lateralSpeed: this.#lat,
      speed: Math.hypot(this.#fwd, this.#lat),
      boosting: this.#boostMs > 0,
      boostCooldownRemainingMs: this.#cooldownMs,
      drifting: this.#boostMs > 0 ? false : this.#lat !== 0 && Math.abs(this.#lat) > Math.abs(this.#fwd) * 0.2,
      altitude: this.#altitude,
    };
  }
}

export const vehiclesPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.vehicles,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.vehicles],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content.data['vehicles']?.value as VehicleCatalog | undefined;
    const service = new VehicleServiceImpl(catalog);
    const first = service.definitionIds()[0];
    if (first) service.load(first, { x: 0, y: 0, heading: 0 });
    const handle = context.capabilities.provide(CAPABILITY_IDS.vehicles, service);
    return {
      id: PACK_IDS.vehicles,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { VehicleService } from '@sw2d/contracts';
