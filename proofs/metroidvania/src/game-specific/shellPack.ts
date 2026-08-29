import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, WorldEntranceDefinition, WorldGraphService, WorldNodeDefinition } from '@sw2d/contracts';
import { WORLD_GRAPH_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS, type WorldService } from '@sw2d/packs';
import { createRoomTransitionRuntime, createWorldMapOverlay, platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - metroidvania (see ../PROOF_CONTRACT.md).
 *
 * Three real rooms driven entirely by the reusable `sw2d.world-graph`
 * capability + `content/world-graph.json`. This file owns NO graph state and
 * NO scene routing: the `createRoomTransitionRuntime` bridge tears one room
 * down and builds the next; the shell only draws the current room's ground
 * and doors, forwards a door INTERACT as a transition request, and pulls a
 * lever that sets the world flag the treasury connection is gated on.
 */

const DOOR_KEYS = { lever: 'lever' } as const;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [WORLD_GRAPH_CAPABILITY_ID, CAPABILITY_IDS.world],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const graph = context.capabilities.require<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const playerKey = context.assets.resolve('player');
    const platformKey = context.assets.resolve('platform');
    const doorKey = context.assets.resolve('exit');
    const leverKey = context.assets.resolve('checkpoint');

    const player = scene.physics.add.sprite(0, 0, playerKey);
    player.setCollideWorldBounds(true);
    player.setGravityY(1100);

    let ground = scene.physics.add.staticGroup();
    let doorSprites: { id: string; sprite: Phaser.GameObjects.Sprite; x: number; y: number; w: number; h: number }[] = [];
    let collider: Phaser.Physics.Arcade.Collider | null = null;
    let lastBlocked: string | null = null;

    function levelFor(node: WorldNodeDefinition): NormalizedLevel {
      return context.content.data[node.level]!.value as NormalizedLevel;
    }

    function buildRoom(level: NormalizedLevel, entrance: WorldEntranceDefinition): void {
      ground = scene.physics.add.staticGroup();
      for (const solid of level.solids) {
        const b = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
        b.setDisplaySize(solid.width, solid.height);
        b.refreshBody();
      }
      doorSprites = [];
      for (const o of level.objects) {
        if (o.class !== 'Interactable') continue;
        const id = String(o.properties.interactionId ?? '');
        const key = id === DOOR_KEYS.lever ? leverKey : doorKey;
        doorSprites.push({ id, sprite: scene.add.sprite(o.x + o.width / 2, o.y + o.height / 2, key), x: o.x, y: o.y, w: o.width, h: o.height });
      }
      collider = scene.physics.add.collider(player, ground);
      player.setPosition(entrance.x, entrance.y);
      player.setVelocity(0, 0);
    }

    function teardownRoom(): void {
      collider?.destroy();
      collider = null;
      for (const d of doorSprites) d.sprite.destroy();
      doorSprites = [];
      try {
        ground.clear(true, true);
        ground.destroy(true);
      } catch {
        /* already torn down */
      }
    }

    const rooms = createRoomTransitionRuntime(context, { teardownRoom, buildRoom });

    // initial room
    const startNode = graph.currentNode();
    const startEntrance = startNode.entrances.find((e) => e.id === 'start') ?? startNode.entrances[0]!;
    buildRoom(levelFor(startNode), startEntrance);

    const mapHost = scene.game.canvas.parentElement;
    const worldMap = mapHost instanceof HTMLElement ? createWorldMapOverlay(mapHost, graph) : null;

    const overlappingDoor = (): string | null => {
      for (const d of doorSprites) {
        if (player.x >= d.x - 8 && player.x <= d.x + d.w + 8 && player.y >= d.y - 44 && player.y <= d.y + d.h) return d.id;
      }
      return null;
    };

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      currentNode: graph.currentNode().id,
      discovered: graph.discoveredNodes(),
      visited: graph.visitedNodes(),
      treasuryUnlocked: world.hasFlag('treasury-unlocked'),
      transitions: rooms.transitions,
      transitioning: rooms.transitioning,
      roomDoorSprites: doorSprites.length,
      overlappingDoor: overlappingDoor(),
      lastBlocked,
      mapOpen: worldMap?.isOpen ?? false,
      mapDiscoveredCount: graph.mapState().nodes.filter((n) => n.discovered).length,
      canReachTreasury: graph.canTraverse('east-treasury').allowed,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        rooms.tick();
        const intent = platformController.read(context.input);
        if (!rooms.transitioning && !(worldMap?.isOpen ?? false)) {
          player.setVelocityX(intent.moveAxis * 220);
          if (intent.jumpPressed && player.body.blocked.down) player.setVelocityY(-430);
        } else {
          player.setVelocityX(0);
        }

        if (context.input.consumePress('SECONDARY_ACTION')) worldMap?.toggle();

        if (context.input.consumePress('INTERACT') && !rooms.transitioning) {
          const door = overlappingDoor();
          if (door === DOOR_KEYS.lever) {
            world.setFlag('treasury-unlocked', true);
          } else if (door) {
            const result = rooms.requestTransition(door);
            lastBlocked = result.ok ? null : (result.reason ?? 'blocked');
            worldMap?.refresh();
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        rooms.dispose();
        worldMap?.dispose();
        teardownRoom();
        try {
          player.destroy();
        } catch {
          /* already torn down */
        }
      },
    };
  },
};
