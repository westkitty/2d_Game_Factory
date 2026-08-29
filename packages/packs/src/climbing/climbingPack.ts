import type {
  ClimbingConfig,
  ClimbingEnvironmentQuery,
  ClimbingIntent,
  ClimbingMode,
  ClimbingMovementResolution,
  ClimbingService,
  ClimbingState,
  InstalledSystemPack,
  GameContext,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { validateClimbingConfig } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

export const DEFAULT_CLIMBING_CONFIG: ClimbingConfig = {
  wallSlideMaxSpeed: 80,
  wallFriction: 0.1,
  wallJumpVelocityX: 220,
  wallJumpVelocityY: 280,
  wallStickMs: 100,
  ledgeGrabToleranceX: 16,
  ledgeGrabToleranceY: 16,
  ladderClimbSpeed: 120,
  enableLedgeClimb: true,
};

export class ClimbingServiceImpl implements ClimbingService {
  readonly #config: ClimbingConfig;
  #mode: ClimbingMode = 'ground';
  #wallSide: -1 | 1 | 0 = 0;
  #wallStickRemainingMs = 0;
  #canWallJump = false;
  #ledgeX?: number | undefined = undefined;
  #ledgeY?: number | undefined = undefined;
  #ledgeCooldownMs = 0;

  constructor(config: ClimbingConfig = DEFAULT_CLIMBING_CONFIG) {
    validateClimbingConfig(config);
    this.#config = Object.freeze({ ...config });
  }

  config(): ClimbingConfig {
    return this.#config;
  }

  state(): ClimbingState {
    return {
      mode: this.#mode,
      wallSide: this.#wallSide,
      wallStickRemainingMs: this.#wallStickRemainingMs,
      canWallJump: this.#canWallJump,
      ledgeX: this.#ledgeX,
      ledgeY: this.#ledgeY,
    };
  }

  reset(): void {
    this.#mode = 'ground';
    this.#wallSide = 0;
    this.#wallStickRemainingMs = 0;
    this.#canWallJump = false;
    this.#ledgeX = undefined;
    this.#ledgeY = undefined;
    this.#ledgeCooldownMs = 0;
  }

  update(
    deltaMs: number,
    currentVelocityY: number,
    intent: ClimbingIntent,
    environment: ClimbingEnvironmentQuery,
  ): ClimbingMovementResolution {
    if (this.#ledgeCooldownMs > 0) {
      this.#ledgeCooldownMs -= deltaMs;
    }

    // 1. Ground state
    if (environment.onGround) {
      this.#mode = 'ground';
      this.#wallSide = 0;
      this.#wallStickRemainingMs = 0;
      this.#canWallJump = false;
      this.#ledgeX = undefined;
      this.#ledgeY = undefined;
      return { state: this.state() };
    }

    if (this.#mode === 'ground') {
      this.#mode = 'air';
    }

    // 2. Ladder climbing state
    if (environment.onLadder && (intent.climbAxis !== 0 || this.#mode === 'ladder-climb')) {
      this.#mode = 'ladder-climb';
      this.#wallSide = 0;
      this.#wallStickRemainingMs = 0;
      this.#canWallJump = false;
      this.#ledgeX = undefined;
      this.#ledgeY = undefined;
      const velocityY = -intent.climbAxis * this.#config.ladderClimbSpeed;
      return { velocityX: 0, velocityY, state: this.state() };
    }

    // 3. Ledge interaction
    if (
      this.#ledgeCooldownMs <= 0 &&
      environment.nearbyLedge &&
      (this.#mode === 'air' || this.#mode === 'wall-slide' || this.#mode === 'wall-stick' || this.#mode === 'ledge-hang')
    ) {
      const dx = Math.abs(environment.nearbyLedge.x);
      const dy = Math.abs(environment.nearbyLedge.y);
      if (dx <= this.#config.ledgeGrabToleranceX && dy <= this.#config.ledgeGrabToleranceY) {
        this.#wallSide = 0;
        this.#wallStickRemainingMs = 0;
        this.#canWallJump = true;
        this.#ledgeX = environment.nearbyLedge.x;
        this.#ledgeY = environment.nearbyLedge.y;

        if (this.#mode === 'ledge-hang') {
          // Jump or climb up
          if (intent.jumpPressed || (this.#config.enableLedgeClimb && intent.climbAxis > 0)) {
            this.#mode = 'air';
            this.#canWallJump = false;
            this.#ledgeX = undefined;
            this.#ledgeY = undefined;
            this.#ledgeCooldownMs = 400;
            const boostX = intent.moveAxis !== 0 ? intent.moveAxis * 100 : 100;
            return {
              velocityX: boostX,
              velocityY: -this.#config.wallJumpVelocityY,
              state: this.state(),
            };
          }
          // Drop down
          if (intent.climbAxis < 0) {
            this.#mode = 'air';
            this.#canWallJump = false;
            this.#ledgeX = undefined;
            this.#ledgeY = undefined;
            this.#ledgeCooldownMs = 300;
            return { velocityY: 60, state: this.state() };
          }
          // Hold ledge
          return { velocityX: 0, velocityY: 0, state: this.state() };
        }

        // Enter ledge hang
        this.#mode = 'ledge-hang';
        return { velocityX: 0, velocityY: 0, state: this.state() };
      }
    }

    // 4. Wall interaction (wall-stick, wall-slide, wall-jump)
    const wallSide: -1 | 1 | 0 = environment.touchingWallLeft ? -1 : environment.touchingWallRight ? 1 : 0;
    if (wallSide !== 0) {
      this.#wallSide = wallSide;
      this.#ledgeX = undefined;
      this.#ledgeY = undefined;

      // Wall jump triggered
      if (intent.jumpPressed) {
        this.#mode = 'air';
        this.#wallStickRemainingMs = 0;
        this.#canWallJump = false;
        const jumpVx = -wallSide * this.#config.wallJumpVelocityX;
        const jumpVy = -this.#config.wallJumpVelocityY;
        return { velocityX: jumpVx, velocityY: jumpVy, state: this.state() };
      }

      const pressingTowardWall = (wallSide === -1 && intent.moveAxis < 0) || (wallSide === 1 && intent.moveAxis > 0);

      // Handle wall stick
      if (this.#mode === 'wall-stick') {
        this.#wallStickRemainingMs -= deltaMs;
        if (this.#wallStickRemainingMs <= 0) {
          this.#mode = 'wall-slide';
          this.#wallStickRemainingMs = 0;
        } else {
          this.#canWallJump = true;
          return { velocityX: 0, velocityY: 0, state: this.state() };
        }
      }

      if (pressingTowardWall || this.#mode === 'wall-slide') {
        this.#canWallJump = true;

        if (currentVelocityY >= 0) {
          if (this.#mode === 'air' && this.#config.wallStickMs > 0) {
            this.#mode = 'wall-stick';
            this.#wallStickRemainingMs = this.#config.wallStickMs;
            return { velocityX: 0, velocityY: 0, state: this.state() };
          }

          // Wall slide: clamp downward falling speed and apply friction
          this.#mode = 'wall-slide';
          let vy = currentVelocityY;
          if (vy > 0) {
            vy = Math.min(vy * (1 - this.#config.wallFriction), this.#config.wallSlideMaxSpeed);
          }
          return { velocityY: vy, state: this.state() };
        } else {
          this.#mode = 'air';
          return { state: this.state() };
        }
      }
    }

    // 5. Airborne free fall
    this.#mode = 'air';
    this.#wallSide = 0;
    this.#wallStickRemainingMs = 0;
    this.#canWallJump = false;
    this.#ledgeX = undefined;
    this.#ledgeY = undefined;
    return { state: this.state() };
  }
}

export const climbingPack: SystemPackDefinition = {
  id: PACK_IDS.climbing,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.climbing],
  dependencies: [],

  install(context: GameContext, _config?: unknown): InstalledSystemPack {
    const rawClimbing = context.content?.data?.['climbing']?.value as ClimbingConfig | undefined;
    const config = rawClimbing ?? DEFAULT_CLIMBING_CONFIG;
    const service = new ClimbingServiceImpl(config);

    const handle = context.capabilities.provide<ClimbingService>(CAPABILITY_IDS.climbing, service);

    return {
      id: PACK_IDS.climbing,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
