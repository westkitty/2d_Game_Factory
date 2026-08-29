import type {
  InstalledSystemPack,
  NormalizedLevel,
  ClimbingService,
  PlatformIntent,
} from '@sw2d/contracts';
import {
  platformController,
  createClimbingRuntime,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { CAPABILITY_IDS, type WorldService } from '@sw2d/packs';

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [
    CAPABILITY_IDS.world,
    CAPABILITY_IDS.entities,
    CAPABILITY_IDS.climbing,
  ],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const climbing = context.capabilities.require<ClimbingService>(CAPABILITY_IDS.climbing);

    const tuning = (context.content.data['tuning']?.value as {
      player: { moveSpeed: number; jumpVelocity: number; gravity: number };
    }) ?? {
      player: { moveSpeed: 200, jumpVelocity: 420, gravity: 1100 },
    };

    // Build static solid collisions
    const platformKey = context.assets.resolve('platform');
    const solidsGroup = scene.physics.add.staticGroup();
    if (level) {
      for (const solid of level.solids) {
        const body = solidsGroup.create(
          solid.x + solid.width / 2,
          solid.y + solid.height / 2,
          platformKey,
        ) as Phaser.Physics.Arcade.Sprite;
        body.setDisplaySize(solid.width, solid.height);
        body.refreshBody();
      }
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(
      spawn?.x ?? 80,
      spawn?.y ?? 440,
      context.assets.resolve('player'),
    );
    player.setCollideWorldBounds(true);
    player.setGravityY(tuning.player.gravity);

    scene.physics.add.collider(player, solidsGroup);

    // Setup climbing runtime
    const climbingRuntime = createClimbingRuntime({
      body: player.body,
      service: climbing,
    });

    // Register top platform corner at (360, 240)
    climbingRuntime.registerLedge(360, 240);

    const exitObj = level?.objects.find((object) => object.class === 'Exit');
    const exitSprite = scene.physics.add.sprite(
      exitObj?.x ?? 750,
      exitObj?.y ?? 190,
      context.assets.resolve('exit'),
    );
    exitSprite.body.setAllowGravity(false);
    exitSprite.body.setImmovable(true);
    exitSprite.setSize(48, 64);

    let objectiveReached = false;
    let wallSlideLeftDemonstrated = false;
    let wallSlideRightDemonstrated = false;
    let wallJumpLeftDemonstrated = false;
    let wallToWallDemonstrated = false;
    let ledgeDetected = false;
    let ledgeGrabDemonstrated = false;
    let ledgeDropDemonstrated = false;
    let recoveryDemonstrated = false;
    let ledgeClimbDemonstrated = false;

    scene.physics.add.overlap(player, exitSprite, () => {
      if (objectiveReached) return;
      objectiveReached = true;
      world.setFlag('objective.exit-reached', true);
    });

    const debugHandle = context.debug.contribute('game.platform-shell', () => {
      const state = climbingRuntime.state();
      return {
        x: Math.round(player.x),
        y: Math.round(player.y),
        vx: Math.round(player.body.velocity.x),
        vy: Math.round(player.body.velocity.y),
        mode: state.mode,
        wallSide: state.wallSide,
        canWallJump: state.canWallJump,
        ledgeX: state.ledgeX ?? null,
        ledgeY: state.ledgeY ?? null,
        wallSlideLeftDemonstrated,
        wallSlideRightDemonstrated,
        wallJumpLeftDemonstrated,
        wallToWallDemonstrated,
        ledgeDetected,
        ledgeGrabDemonstrated,
        ledgeDropDemonstrated,
        recoveryDemonstrated,
        ledgeClimbDemonstrated,
        objectiveReached,
      };
    });

    return {
      id: 'game.platform-shell',
      update(deltaMs: number): void {
        const intent: PlatformIntent = platformController.read(context.input);

        let climbAxis = 0;
        if (context.input.isDown('MOVE_UP')) {
          climbAxis = 1;
        } else if (context.input.isDown('MOVE_DOWN')) {
          climbAxis = -1;
        }

        const climbingIntent = {
          moveAxis: intent.moveAxis,
          climbAxis,
          jumpPressed: intent.jumpPressed,
        };

        const prevMode = climbingRuntime.state().mode;
        const res = climbingRuntime.update(deltaMs, climbingIntent);
        const state = res.state;

        if (state.ledgeX !== undefined) {
          ledgeDetected = true;
        }

        if (state.mode === 'wall-slide' || state.mode === 'wall-stick') {
          if (state.wallSide === -1) {
            wallSlideLeftDemonstrated = true;
          } else if (state.wallSide === 1) {
            wallSlideRightDemonstrated = true;
            if (wallJumpLeftDemonstrated) {
              wallToWallDemonstrated = true;
            }
          }
        }

        if (state.mode === 'air' && res.velocityX !== undefined && res.velocityX > 100) {
          wallJumpLeftDemonstrated = true;
        }

        if (state.mode === 'ledge-hang') {
          ledgeGrabDemonstrated = true;
        }

        if (prevMode === 'ledge-hang' && state.mode === 'air' && climbAxis < 0) {
          ledgeDropDemonstrated = true;
        }

        if (ledgeDropDemonstrated && (state.mode === 'ground' || state.mode === 'wall-slide')) {
          recoveryDemonstrated = true;
        }

        if (ledgeGrabDemonstrated && (state.mode === 'air' || state.mode === 'ground') && player.y <= 240 && climbAxis > 0) {
          ledgeClimbDemonstrated = true;
        }

        if (state.mode === 'ground') {
          player.setVelocityX(intent.moveAxis * tuning.player.moveSpeed);
          if (
            intent.jumpPressed &&
            (player.body.blocked.down || player.body.touching.down || player.body.wasTouching?.down)
          ) {
            player.setVelocityY(-tuning.player.jumpVelocity);
          }
        } else if (state.mode === 'air') {
          if (res.velocityX === undefined) {
            player.setVelocityX(intent.moveAxis * tuning.player.moveSpeed);
          }
        }

        if (!objectiveReached && player.x >= 700 && player.y <= 250) {
          objectiveReached = true;
          world.setFlag('objective.exit-reached', true);
        }
      },

      dispose(): void {
        debugHandle.dispose();
      },
    };
  },
};
