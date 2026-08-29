import type Phaser from 'phaser';
import type {
  ClimbingConfig,
  ClimbingIntent,
  ClimbingMovementResolution,
  ClimbingService,
  ClimbingState,
} from '@sw2d/contracts';

export interface LedgePoint {
  readonly x: number;
  readonly y: number;
}

export interface ClimbingRuntimeOptions {
  readonly body: Phaser.Physics.Arcade.Body;
  readonly service: ClimbingService;
  readonly getLedges?: () => readonly LedgePoint[];
}

export interface ClimbingRuntime {
  readonly service: ClimbingService;
  update(deltaMs: number, intent: ClimbingIntent): ClimbingMovementResolution;
  setLadderOverlapping(overlapping: boolean): void;
  registerLedge(x: number, y: number): void;
  clearLedges(): void;
  state(): ClimbingState;
  config(): ClimbingConfig;
}

export function createClimbingRuntime(options: ClimbingRuntimeOptions): ClimbingRuntime {
  const { body, service, getLedges } = options;
  let isOverlappingLadder = false;
  const registeredLedges: LedgePoint[] = [];

  return {
    get service(): ClimbingService {
      return service;
    },

    setLadderOverlapping(overlapping: boolean): void {
      isOverlappingLadder = overlapping;
    },

    registerLedge(x: number, y: number): void {
      registeredLedges.push({ x, y });
    },

    clearLedges(): void {
      registeredLedges.length = 0;
    },

    state(): ClimbingState {
      return service.state();
    },

    config(): ClimbingConfig {
      return service.config();
    },

    update(deltaMs: number, intent: ClimbingIntent): ClimbingMovementResolution {
      const onGround = Boolean(body.blocked.down || body.touching.down || body.wasTouching?.down);
      const touchingWallLeft = Boolean(body.blocked.left || body.touching.left || body.wasTouching?.left);
      const touchingWallRight = Boolean(body.blocked.right || body.touching.right || body.wasTouching?.right);

      // Find nearest ledge relative to player top-center
      const playerX = body.center.x;
      const playerTopY = body.y;
      const allLedges = getLedges ? [...registeredLedges, ...getLedges()] : registeredLedges;

      let nearestLedgeRel: { x: number; y: number } | null = null;
      let minDistance = Infinity;

      for (const ledge of allLedges) {
        const relX = ledge.x - playerX;
        const relY = ledge.y - playerTopY;
        const dist = Math.hypot(relX, relY);
        if (dist < minDistance) {
          minDistance = dist;
          nearestLedgeRel = { x: relX, y: relY };
        }
      }

      const resolution = service.update(deltaMs, body.velocity.y, intent, {
        onGround,
        touchingWallLeft,
        touchingWallRight,
        onLadder: isOverlappingLadder,
        nearbyLedge: nearestLedgeRel,
      });

      if (typeof (body as { setAllowGravity?: (allow: boolean) => void }).setAllowGravity === 'function') {
        if (
          resolution.state.mode === 'ledge-hang' ||
          resolution.state.mode === 'ladder-climb' ||
          resolution.state.mode === 'wall-stick'
        ) {
          (body as { setAllowGravity: (allow: boolean) => void }).setAllowGravity(false);
        } else {
          (body as { setAllowGravity: (allow: boolean) => void }).setAllowGravity(true);
        }
      }

      if (resolution.velocityX !== undefined) {
        body.setVelocityX(resolution.velocityX);
      }
      if (resolution.velocityY !== undefined) {
        body.setVelocityY(resolution.velocityY);
      }

      return resolution;
    },
  };
}
