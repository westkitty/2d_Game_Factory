import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, WorldEntranceDefinition, WorldGraphService, WorldNodeDefinition } from '@sw2d/contracts';
import { WORLD_GRAPH_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS, type WorldService } from '@sw2d/packs';
import { createRoomTransitionRuntime, createWorldMapOverlay, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - exploration-game (see ../PROOF_CONTRACT.md).
 *
 * Materially simpler than the metroidvania proof: three areas in a loop, no
 * gating. It proves the reusable `sw2d.world-graph` capability's discovery /
 * visited state, the map overlay, a persistent world flag surviving
 * transitions, and - the acceptance point - that walking A -> B -> A -> B
 * repeatedly does not accumulate room sprites or colliders.
 */

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [WORLD_GRAPH_CAPABILITY_ID, CAPABILITY_IDS.world],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const graph = context.capabilities.require<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const playerKey = context.assets.resolve('player');
    const wallKey = context.assets.resolve('platform');
    const doorKey = context.assets.resolve('exit');

    const player = scene.physics.add.sprite(0, 0, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    let walls = scene.physics.add.staticGroup();
    let doorSprites: { id: string; sprite: Phaser.GameObjects.Sprite; x: number; y: number; w: number; h: number }[] = [];
    let collider: Phaser.Physics.Arcade.Collider | null = null;

    const levelFor = (node: WorldNodeDefinition): NormalizedLevel => context.content.data[node.level]!.value as NormalizedLevel;

    function buildRoom(level: NormalizedLevel, entrance: WorldEntranceDefinition): void {
      walls = scene.physics.add.staticGroup();
      for (const s of level.solids) {
        const b = walls.create(s.x + s.width / 2, s.y + s.height / 2, wallKey) as Phaser.Physics.Arcade.Sprite;
        b.setDisplaySize(s.width, s.height);
        b.refreshBody();
      }
      doorSprites = [];
      for (const o of level.objects) {
        if (o.class !== 'Interactable') continue;
        doorSprites.push({
          id: String(o.properties.interactionId ?? ''),
          sprite: scene.add.sprite(o.x + o.width / 2, o.y + o.height / 2, doorKey),
          x: o.x,
          y: o.y,
          w: o.width,
          h: o.height,
        });
      }
      collider = scene.physics.add.collider(player, walls);
      player.setPosition(entrance.x, entrance.y);
      player.setVelocity(0, 0);
    }

    function teardownRoom(): void {
      collider?.destroy();
      collider = null;
      for (const d of doorSprites) d.sprite.destroy();
      doorSprites = [];
      try {
        walls.clear(true, true);
        walls.destroy(true);
      } catch {
        /* already torn down */
      }
    }

    const rooms = createRoomTransitionRuntime(context, { teardownRoom, buildRoom });
    const startNode = graph.currentNode();
    buildRoom(levelFor(startNode), startNode.entrances.find((e) => e.id === 'start') ?? startNode.entrances[0]!);

    world.setFlag('town-visited', true); // a persistent flag; must survive every transition

    const mapHost = scene.game.canvas.parentElement;
    const worldMap = mapHost instanceof HTMLElement ? createWorldMapOverlay(mapHost, graph) : null;

    const overlappingDoor = (): string | null => {
      for (const d of doorSprites) {
        if (player.x >= d.x - 12 && player.x <= d.x + d.w + 12 && player.y >= d.y - 12 && player.y <= d.y + d.h + 12) return d.id;
      }
      return null;
    };

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      currentNode: graph.currentNode().id,
      discovered: graph.discoveredNodes(),
      visited: graph.visitedNodes(),
      townVisitedFlag: world.hasFlag('town-visited'),
      transitions: rooms.transitions,
      roomDoorSprites: doorSprites.length,
      overlappingDoor: overlappingDoor(),
      mapOpen: worldMap?.isOpen ?? false,
      mapDiscoveredCount: graph.mapState().nodes.filter((n) => n.discovered).length,
      knownEdges: graph.mapState().edges.filter((e) => e.known).length,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        rooms.tick();
        const intent = topDownController.read(context.input);
        if (!rooms.transitioning && !(worldMap?.isOpen ?? false)) {
          player.setVelocityX(intent.moveX * 200);
          player.setVelocityY(intent.moveY * 200);
        } else {
          player.setVelocity(0, 0);
        }
        if (context.input.consumePress('SECONDARY_ACTION')) worldMap?.toggle();
        if (context.input.consumePress('INTERACT') && !rooms.transitioning) {
          const door = overlappingDoor();
          if (door) {
            rooms.requestTransition(door);
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
