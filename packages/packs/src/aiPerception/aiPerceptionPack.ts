import type { GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import {
  calculatePursuitPressure,
  resolveVisibilityMultiplier,
  validatePursuitDefinition,
  validateSensorDefinition,
  type AgentPerceptionStatus,
  type NoiseEvent,
  type PerceptionCatalog,
  type PerceptionSensorDefinition,
  type PerceptionService,
  type PerceptionWorldQueries,
  type PursuitDefinition,
  type PursuitService,
  type PursuitState,
  type TargetPerceptionState,
  type TargetVisibilityState,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const MAX_NOISE_EVENTS = 50;

interface RegisteredTarget {
  readonly id: string;
  readonly tags?: readonly string[] | undefined;
  readonly team?: string | undefined;
  visibility: number;
}

export class PerceptionServiceImpl implements PerceptionService {
  readonly #sensors = new Map<string, PerceptionSensorDefinition>();
  readonly #sensorTargets = new Map<string, Map<string, TargetPerceptionState>>();
  readonly #sensorTimeSinceUpdate = new Map<string, number>();
  readonly #sensorStatus = new Map<string, AgentPerceptionStatus>();
  readonly #targets = new Map<string, RegisteredTarget>();
  #noiseEvents: NoiseEvent[] = [];
  #simTimeMs = 0;

  registerSensor(definition: PerceptionSensorDefinition): void {
    validateSensorDefinition(definition);
    this.#sensors.set(definition.id, definition);
    if (!this.#sensorTargets.has(definition.id)) {
      this.#sensorTargets.set(definition.id, new Map());
    }
    this.#sensorTimeSinceUpdate.set(definition.id, 0);
    this.#sensorStatus.set(definition.id, 'calm');
  }

  unregisterSensor(sensorId: string): void {
    this.#sensors.delete(sensorId);
    this.#sensorTargets.delete(sensorId);
    this.#sensorTimeSinceUpdate.delete(sensorId);
    this.#sensorStatus.delete(sensorId);
  }

  sensor(sensorId: string): PerceptionSensorDefinition | undefined {
    return this.#sensors.get(sensorId);
  }

  sensorIds(): readonly string[] {
    return Array.from(this.#sensors.keys());
  }

  registerTarget(target: { id: string; tags?: readonly string[]; team?: string }): void {
    this.#targets.set(target.id, {
      id: target.id,
      tags: target.tags,
      team: target.team,
      visibility: 1,
    });
  }

  unregisterTarget(targetId: string): void {
    this.#targets.delete(targetId);
    for (const targetMap of this.#sensorTargets.values()) {
      targetMap.delete(targetId);
    }
  }

  setTargetVisibility(targetId: string, visibility: TargetVisibilityState | number): void {
    const t = this.#targets.get(targetId);
    if (t) {
      t.visibility = resolveVisibilityMultiplier(visibility);
    }
  }

  targetVisibility(targetId: string): number {
    return this.#targets.get(targetId)?.visibility ?? 1;
  }

  addNoise(noise: Omit<NoiseEvent, 'createdAtSimulationMs'> & { createdAtSimulationMs?: number }): void {
    if (noise.radius <= 0 || noise.intensity < 0 || noise.lifetimeMs <= 0) return;
    const event: NoiseEvent = {
      ...noise,
      createdAtSimulationMs: noise.createdAtSimulationMs ?? this.#simTimeMs,
    };
    this.#noiseEvents.push(event);
    if (this.#noiseEvents.length > MAX_NOISE_EVENTS) {
      this.#noiseEvents.shift();
    }
  }

  activeNoises(): readonly NoiseEvent[] {
    return this.#noiseEvents;
  }

  targetState(sensorId: string, targetId: string): TargetPerceptionState | undefined {
    return this.#sensorTargets.get(sensorId)?.get(targetId);
  }

  sensorStatus(sensorId: string): AgentPerceptionStatus {
    return this.#sensorStatus.get(sensorId) ?? 'calm';
  }

  update(deltaMs: number, queries: PerceptionWorldQueries): void {
    if (deltaMs <= 0) return;
    this.#simTimeMs += deltaMs;

    // 1. Expire noise events
    this.#noiseEvents = this.#noiseEvents.filter(
      (n) => this.#simTimeMs - n.createdAtSimulationMs <= n.lifetimeMs,
    );

    // 2. Update each sensor
    for (const [sensorId, sensor] of this.#sensors) {
      const accumulated = (this.#sensorTimeSinceUpdate.get(sensorId) ?? 0) + deltaMs;
      if (accumulated < sensor.updateIntervalMs) {
        this.#sensorTimeSinceUpdate.set(sensorId, accumulated);
        continue;
      }

      const dtSeconds = accumulated / 1000;
      this.#sensorTimeSinceUpdate.set(sensorId, 0);

      const sensorTransform = queries.getSensorTransform(sensorId);
      if (!sensorTransform) {
        continue;
      }

      const sx = sensorTransform.x;
      const sy = sensorTransform.y;
      const fLen = Math.hypot(sensorTransform.facingX, sensorTransform.facingY);
      const fx = fLen > 0 ? sensorTransform.facingX / fLen : 1;
      const fy = fLen > 0 ? sensorTransform.facingY / fLen : 0;

      const halfFovRad = ((sensor.fieldOfViewDegrees * Math.PI) / 180) / 2;
      const cosHalfFov = Math.cos(halfFovRad);
      const rangeSq = sensor.visionRange * sensor.visionRange;

      let sensorTargetMap = this.#sensorTargets.get(sensorId);
      if (!sensorTargetMap) {
        sensorTargetMap = new Map();
        this.#sensorTargets.set(sensorId, sensorTargetMap);
      }

      let highestAwareness = 0;
      let hasInvestigatingNoise = false;
      let investigateX: number | undefined;
      let investigateY: number | undefined;

      // Hearing check for this sensor
      if (sensor.hearingRange > 0) {
        const effectiveHearing = sensor.hearingRange * sensor.hearingMultiplier;
        for (const noise of this.#noiseEvents) {
          const dist = Math.hypot(noise.x - sx, noise.y - sy);
          if (dist <= effectiveHearing && dist <= noise.radius) {
            hasInvestigatingNoise = true;
            investigateX = noise.x;
            investigateY = noise.y;
          }
        }
      }

      for (const [targetId, target] of this.#targets) {
        // Tag/team filtering
        if (sensor.targetTags && sensor.targetTags.length > 0) {
          const match = target.tags && target.tags.some((tag) => sensor.targetTags!.includes(tag));
          if (!match) continue;
        }
        if (sensor.targetTeams && sensor.targetTeams.length > 0) {
          if (!target.team || !sensor.targetTeams.includes(target.team)) continue;
        }

        const targetTransform = queries.getTargetTransform(targetId);
        if (!targetTransform) {
          sensorTargetMap.delete(targetId);
          continue;
        }

        const tx = targetTransform.x;
        const ty = targetTransform.y;
        const dx = tx - sx;
        const dy = ty - sy;
        const distSq = dx * dx + dy * dy;

        let visible = false;
        if (distSq <= rangeSq && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const dirX = dx / dist;
          const dirY = dy / dist;
          const dot = dirX * fx + dirY * fy;

          if (dot >= cosHalfFov) {
            const occluded = queries.isOccluded ? queries.isOccluded(sx, sy, tx, ty) : false;
            if (!occluded) {
              const visMult = target.visibility;
              if (visMult > 0) {
                visible = true;
              }
            }
          }
        }

        const prev = sensorTargetMap.get(targetId);
        let awareness = prev?.awareness ?? 0;
        let lastKnownX = prev?.lastKnownX;
        let lastKnownY = prev?.lastKnownY;
        let lastSeen = prev?.lastSeenSimulationMs;
        let lastHeard = prev?.lastHeardSimulationMs;

        if (hasInvestigatingNoise) {
          lastHeard = this.#simTimeMs;
        }

        if (visible) {
          const visMult = target.visibility;
          awareness += sensor.awarenessGainPerSecond * visMult * dtSeconds;
          if (awareness > 1) awareness = 1;
          lastKnownX = tx;
          lastKnownY = ty;
          lastSeen = this.#simTimeMs;
        } else {
          // Memory retention check
          if (lastSeen !== undefined && this.#simTimeMs - lastSeen > sensor.memoryMs) {
            lastKnownX = undefined;
            lastKnownY = undefined;
          }
          awareness -= sensor.awarenessDecayPerSecond * dtSeconds;
          if (awareness < 0) awareness = 0;
        }

        if (awareness > highestAwareness) {
          highestAwareness = awareness;
        }

        sensorTargetMap.set(targetId, {
          targetId,
          currentlyVisible: visible,
          awareness,
          lastKnownX,
          lastKnownY,
          lastSeenSimulationMs: lastSeen,
          lastHeardSimulationMs: lastHeard,
          investigationX: investigateX,
          investigationY: investigateY,
        });
      }

      // Determine overall sensor status
      let status: AgentPerceptionStatus = 'calm';
      if (highestAwareness >= 1) {
        status = 'pursuit';
      } else if (highestAwareness >= 0.5) {
        status = 'alert';
      } else if (highestAwareness > 0.05) {
        status = 'suspicious';
      } else if (hasInvestigatingNoise) {
        status = 'investigating';
      } else {
        status = 'calm';
      }
      this.#sensorStatus.set(sensorId, status);
    }
  }

  dispose(): void {
    this.#sensors.clear();
    this.#sensorTargets.clear();
    this.#sensorTimeSinceUpdate.clear();
    this.#sensorStatus.clear();
    this.#targets.clear();
    this.#noiseEvents = [];
  }
}

export class PursuitServiceImpl implements PursuitService {
  readonly #pursuits = new Map<string, PursuitDefinition>();
  readonly #states = new Map<string, PursuitState>();

  registerPursuit(definition: PursuitDefinition): void {
    validatePursuitDefinition(definition);
    this.#pursuits.set(definition.pursuerId, definition);
    this.#states.set(definition.pursuerId, {
      pursuerId: definition.pursuerId,
      targetId: definition.targetId,
      pressure: 0,
      distance: definition.safeDistance,
      isDanger: false,
      isCaptured: false,
      graceRemainingMs: definition.graceMs,
    });
  }

  unregisterPursuit(pursuerId: string): void {
    this.#pursuits.delete(pursuerId);
    this.#states.delete(pursuerId);
  }

  pursuitState(pursuerId: string): PursuitState | undefined {
    return this.#states.get(pursuerId);
  }

  update(deltaMs: number, distanceResolver?: (pursuerId: string, targetId: string) => number): void {
    for (const [pursuerId, def] of this.#pursuits) {
      const prev = this.#states.get(pursuerId);
      let graceRemaining = prev?.graceRemainingMs ?? def.graceMs;
      if (graceRemaining > 0 && deltaMs > 0) {
        graceRemaining = Math.max(0, graceRemaining - deltaMs);
      }

      const distance = distanceResolver ? distanceResolver(pursuerId, def.targetId) : def.safeDistance;
      const pressure = calculatePursuitPressure(distance, def.safeDistance, def.dangerDistance);
      const isDanger = distance <= def.dangerDistance;
      const isCaptured = distance <= def.captureDistance && graceRemaining <= 0;

      this.#states.set(pursuerId, {
        pursuerId,
        targetId: def.targetId,
        pressure,
        distance,
        isDanger,
        isCaptured,
        graceRemainingMs: graceRemaining,
      });
    }
  }

  dispose(): void {
    this.#pursuits.clear();
    this.#states.clear();
  }
}

export const aiPerceptionPack: SystemPackDefinition = {
  id: PACK_IDS.aiPerception,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.aiPerception, CAPABILITY_IDS.aiPursuit],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const perception = new PerceptionServiceImpl();
    const pursuit = new PursuitServiceImpl();

    // Auto-load perception catalog if available in content
    const catalog = context.content?.data?.perception?.value as PerceptionCatalog | undefined;
    if (catalog?.sensors) {
      for (const sensor of catalog.sensors) {
        perception.registerSensor(sensor);
      }
    }
    if (catalog?.pursuits) {
      for (const p of catalog.pursuits) {
        pursuit.registerPursuit(p);
      }
    }

    const perceptionHandle = context.capabilities.provide(CAPABILITY_IDS.aiPerception, perception);
    const pursuitHandle = context.capabilities.provide(CAPABILITY_IDS.aiPursuit, pursuit);

    return {
      id: PACK_IDS.aiPerception,
      dispose(): void {
        perceptionHandle.dispose();
        pursuitHandle.dispose();
        perception.dispose();
        pursuit.dispose();
      },
    };
  },
};
