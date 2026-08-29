import Phaser from 'phaser';
import type {
  ChestInstance,
  ChestOpenResult,
  ChestsService,
  GenerationManifest,
  GenerationService,
  InstalledSystemPack,
  ItemsService,
  LockpickResult,
  LockpickingService,
  NormalizedLevel,
} from '@sw2d/contracts';
import {
  CHESTS_CAPABILITY_ID,
  GENERATION_CAPABILITY_ID,
  ITEMS_CAPABILITY_ID,
  LOCKPICKING_CAPABILITY_ID,
} from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - dungeon-crawler (see ../PROOF_CONTRACT.md).
 *
 * The dungeon is a deterministic seeded room graph produced by the reusable
 * `sw2d.generation` capability's `room-graph` generator - not a bespoke
 * dungeon-only algorithm.
 *
 * Phase 13 extends this shell to compose with `sw2d.dungeon-chests` and `sw2d.items`:
 * - Spawns 4 deterministic chest instances across generated rooms:
 *   - Wooden unlocked chest (rolls common loot; second open returns already_open)
 *   - Silver key-locked chest (needs silver_key; consumes key upon open)
 *   - Gold pick-locked chest (lockpicking session: bad torque causes damage, sweet spot unlocks)
 *   - Mimic trap chest (opening triggers trap)
 * - Exposes full snapshot evidence while preserving Phase 7 generation oracles.
 */

function startToExitReachable(
  manifest: GenerationManifest,
  level: NormalizedLevel,
): { reachable: boolean; edgesValid: boolean } {
  const nodes = new Set(manifest.graph.nodes);
  const edgesValid = manifest.graph.edges.every((e) => nodes.has(e.from) && nodes.has(e.to));
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    const l = adj.get(a);
    if (l) l.push(b);
    else adj.set(a, [b]);
  };
  for (const e of manifest.graph.edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }
  const seen = new Set<string>(['r0']);
  const stack = ['r0'];
  while (stack.length) {
    const n = stack.pop()!;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  const hasExit = level.objects.some((o) => o.class === 'Exit');
  return { reachable: hasExit && seen.size === manifest.graph.nodes.length, edgesValid };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [GENERATION_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const generation = context.capabilities.require<GenerationService>(GENERATION_CAPABILITY_ID);
    const chests = context.capabilities.get<ChestsService>(CHESTS_CAPABILITY_ID);
    const lockpicking = context.capabilities.get<LockpickingService>(LOCKPICKING_CAPABILITY_ID);
    const items = context.capabilities.get<ItemsService>(ITEMS_CAPABILITY_ID);

    const generatorId = generation.availableGenerators().includes('main')
      ? 'main'
      : generation.availableGenerators()[0]!;

    const run = generation.generate(generatorId);
    const level: NormalizedLevel = run.output;
    const initialManifest = run.manifest;

    const playerKey = context.assets.resolve('player');
    const wallKey = context.assets.resolve('platform');
    const enemyKey = context.assets.resolve('enemy');

    const walls = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = walls.create(
        solid.x + solid.width / 2,
        solid.y + solid.height / 2,
        wallKey,
      ) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }
    for (const o of level.objects) {
      if (o.class === 'Enemy') scene.add.sprite(o.x, o.y, enemyKey).setAlpha(0.8);
    }

    const spawn = level.objects.find((o) => o.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? 160, spawn?.y ?? 120, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    scene.physics.add.collider(player, walls);

    // Spawn 4 deterministic chests across generated room nodes
    const spawnedChests: ChestInstance[] = [];
    if (chests) {
      const nodeIds = initialManifest.graph.nodes;
      if (nodeIds[0]) {
        spawnedChests.push(chests.spawnChest('chest-wood-0', 'chest-wooden', { x: 100, y: 100 }));
      }
      if (nodeIds[1]) {
        spawnedChests.push(chests.spawnChest('chest-silver-1', 'chest-silver', { x: 200, y: 100 }));
      }
      if (nodeIds[2]) {
        spawnedChests.push(chests.spawnChest('chest-gold-2', 'chest-gold', { x: 300, y: 100 }));
      }
      if (nodeIds[3]) {
        spawnedChests.push(chests.spawnChest('chest-trap-3', 'chest-trap', { x: 400, y: 100 }));
      }
    }

    // Track chest events
    let trapTriggeredCount = 0;
    context.events.on('loot:trapTriggered', () => {
      trapTriggeredCount++;
    });

    let woodenFirstResult: ChestOpenResult | null = null;
    let woodenSecondResult: ChestOpenResult | null = null;
    let silverFirstResult: ChestOpenResult | null = null;
    let silverSecondResult: ChestOpenResult | null = null;
    let silverKeyConsumed = false;
    let lockpickBadAttempt: LockpickResult | null = null;
    let lockpickSuccess: LockpickResult | null = null;
    let goldOpenResult: ChestOpenResult | null = null;
    let trapOpenResult: ChestOpenResult | null = null;

    function runChestJourney(): void {
      if (!chests || !lockpicking || !items) return;

      // 1. Wooden: open once -> opened; second open -> already_open
      woodenFirstResult = chests.openChest('chest-wood-0');
      woodenSecondResult = chests.openChest('chest-wood-0');

      // 2. Silver: attempt without key -> locked_needs_key
      silverFirstResult = chests.openChest('chest-silver-1');
      // Grant key through ItemsService
      items.grant('silver_key', 1);
      const countBefore = items.count('silver_key');
      silverSecondResult = chests.openChest('chest-silver-1');
      const countAfter = items.count('silver_key');
      silverKeyConsumed = countBefore === 1 && countAfter === 0;

      // 3. Gold: lockpick attempt with damage then sweet spot
      const session = lockpicking.startSession('expert', initialManifest.seed, 'chest-gold-2');
      // Intentionally bad angle (+45 deg error > tolerance 6)
      lockpickBadAttempt = lockpicking.tryTurn(session, {
        pickAngle: session.sweetSpotAngle + 45,
        wrenchRotation: 90,
      });
      // Correct sweet spot angle
      lockpickSuccess = lockpicking.tryTurn(session, {
        pickAngle: session.sweetSpotAngle,
        wrenchRotation: 90,
      });
      if (lockpickSuccess.isUnlocked) {
        chests.unlockChest('chest-gold-2');
      }
      goldOpenResult = chests.openChest('chest-gold-2');

      // 4. Trap: open mimic chest
      trapOpenResult = chests.openChest('chest-trap-3');
    }

    const startPos = { x: player.x, y: player.y };
    let travelled = 0;
    let regenMatchesInitial: boolean | null = null;
    let altDiffers: boolean | null = null;
    let altValid: boolean | null = null;

    const graphKey = (m: GenerationManifest): string =>
      `${m.graph.nodes.join('|')}#${m.graph.edges.map((e) => `${e.from}-${e.viaDoor}-${e.to}`).join('|')}#${m.chosenTemplates.join(',')}`;

    const route = startToExitReachable(initialManifest, level);

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      generatorId,
      seed: initialManifest.seed,
      kind: initialManifest.kind,
      roomCount: initialManifest.graph.nodes.length,
      hasStartNode: initialManifest.graph.nodes.includes('r0'),
      hasExitObject: level.objects.some((o) => o.class === 'Exit'),
      enemyCount: level.objects.filter((o) => o.class === 'Enemy').length,
      edgesValid: route.edgesValid,
      startToExitReachable: route.reachable,
      valid: run.validation.valid,
      errors: run.validation.errors,
      travelled: Math.round(travelled),
      regenMatchesInitial,
      altDiffers,
      altValid,
      // Phase 13 chest properties
      chestsSpawnedCount: spawnedChests.length,
      woodenFirstResult,
      woodenSecondResult,
      silverFirstResult,
      silverSecondResult,
      silverKeyConsumed,
      lockpickBadAttempt,
      lockpickSuccess,
      goldOpenResult,
      trapOpenResult,
      trapTriggeredCount,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = topDownController.read(context.input);
        player.setVelocityX(intent.moveX * 200);
        player.setVelocityY(intent.moveY * 200);
        travelled = Math.max(travelled, Math.hypot(player.x - startPos.x, player.y - startPos.y));

        if (context.input.consumePress('INTERACT')) {
          const again = generation.generate(generatorId, { seed: initialManifest.seed });
          regenMatchesInitial =
            graphKey(again.manifest) === graphKey(initialManifest) && again.validation.valid;
        }

        if (context.input.consumePress('SECONDARY_ACTION')) {
          const alt = generation.generate(generatorId, {
            seed: (initialManifest.seed ^ 0x27d4eb2f) >>> 0,
          });
          altDiffers = graphKey(alt.manifest) !== graphKey(initialManifest);
          altValid = alt.validation.valid;
        }

        if (context.input.consumePress('PRIMARY_ACTION')) {
          runChestJourney();
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          player.destroy();
          walls.clear(true, true);
          walls.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
