import type {
  AgentPerceptionStatus,
  NoiseEvent,
  PerceptionService,
  PerceptionWorldQueries,
  PursuitService,
  PursuitState,
  TargetVisibilityState,
} from '@sw2d/contracts';

export interface PerceptionRuntimeEntityTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
  readonly angle?: number;
  readonly flipX?: boolean;
  readonly facingX?: number;
  readonly facingY?: number;
}

export interface PerceptionRuntimeOptions {
  readonly perception: PerceptionService;
  readonly pursuit?: PursuitService;
  readonly getSensorTransform: (sensorId: string) => PerceptionRuntimeEntityTransform | null | undefined;
  readonly getTargetTransform: (targetId: string) => { readonly x: number; readonly y: number } | null | undefined;
  readonly isOccluded?: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
  readonly distanceResolver?: (pursuerId: string, targetId: string) => number;
}

export interface PerceptionRuntime {
  update(deltaMs: number): void;
  addNoise(noise: Omit<NoiseEvent, 'createdAtSimulationMs'>): void;
  setTargetVisibility(targetId: string, visibility: TargetVisibilityState | number): void;
  sensorStatus(sensorId: string): AgentPerceptionStatus;
  pursuitState(pursuerId: string): PursuitState | undefined;
  dispose(): void;
}

export function createPerceptionRuntime(options: PerceptionRuntimeOptions): PerceptionRuntime {
  const { perception, pursuit, getSensorTransform, getTargetTransform, isOccluded, distanceResolver } = options;

  let disposed = false;

  const queries: PerceptionWorldQueries = {
    getSensorTransform(sensorId: string) {
      const raw = getSensorTransform(sensorId);
      if (!raw) return undefined;

      let fx = raw.facingX ?? 1;
      let fy = raw.facingY ?? 0;

      if (raw.facingX === undefined && raw.facingY === undefined) {
        if (typeof raw.rotation === 'number') {
          fx = Math.cos(raw.rotation);
          fy = Math.sin(raw.rotation);
        } else if (typeof raw.angle === 'number') {
          const rad = (raw.angle * Math.PI) / 180;
          fx = Math.cos(rad);
          fy = Math.sin(rad);
        } else if (typeof raw.flipX === 'boolean') {
          fx = raw.flipX ? -1 : 1;
          fy = 0;
        }
      }

      return {
        x: raw.x,
        y: raw.y,
        facingX: fx,
        facingY: fy,
      };
    },

    getTargetTransform(targetId: string) {
      const raw = getTargetTransform(targetId);
      if (!raw) return undefined;
      return { x: raw.x, y: raw.y };
    },

    isOccluded(fromX: number, fromY: number, toX: number, toY: number) {
      if (isOccluded) {
        return isOccluded(fromX, fromY, toX, toY);
      }
      return false;
    },
  };

  return {
    update(deltaMs: number): void {
      if (disposed) return;
      perception.update(deltaMs, queries);
      if (pursuit) {
        pursuit.update(deltaMs, distanceResolver);
      }
    },

    addNoise(noise: Omit<NoiseEvent, 'createdAtSimulationMs'>): void {
      if (disposed) return;
      perception.addNoise(noise);
    },

    setTargetVisibility(targetId: string, visibility: TargetVisibilityState | number): void {
      if (disposed) return;
      perception.setTargetVisibility(targetId, visibility);
    },

    sensorStatus(sensorId: string): AgentPerceptionStatus {
      return perception.sensorStatus(sensorId);
    },

    pursuitState(pursuerId: string): PursuitState | undefined {
      return pursuit?.pursuitState(pursuerId);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
    },
  };
}
