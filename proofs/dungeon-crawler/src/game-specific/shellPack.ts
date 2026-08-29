import Phaser from 'phaser';
import type { GenerationManifest, GenerationService, InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { GENERATION_CAPABILITY_ID } from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - dungeon-crawler (see ../PROOF_CONTRACT.md).
 *
 * The dungeon is a deterministic seeded room graph produced by the reusable
 * `sw2d.generation` capability's `room-graph` generator - not a bespoke
 * dungeon-only algorithm. This shell renders the resulting NormalizedLevel
 * (walls from solids, player at the start-room PlayerSpawn) and exposes the
 * manifest graph so a proof can assert:
 *  - a start node ('r0') and an Exit object exist;
 *  - every edge references a placed node;
 *  - the exit is reachable from the start (BFS on the manifest graph);
 *  - INTERACT re-runs the same seed and the graph is byte-identical;
 *  - SECONDARY_ACTION re-runs a different seed and the graph differs, still valid.
 */

function startToExitReachable(manifest: GenerationManifest, level: NormalizedLevel): { reachable: boolean; edgesValid: boolean } {
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
  // the exit room is the last node on the critical path; if an Exit object was
  // materialized, its room is reachable when the whole graph is connected.
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
    const generatorId = generation.availableGenerators().includes('main') ? 'main' : generation.availableGenerators()[0]!;

    const run = generation.generate(generatorId);
    const level: NormalizedLevel = run.output;
    const initialManifest = run.manifest;

    const playerKey = context.assets.resolve('player');
    const wallKey = context.assets.resolve('platform');
    const enemyKey = context.assets.resolve('enemy');

    const walls = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = walls.create(solid.x + solid.width / 2, solid.y + solid.height / 2, wallKey) as Phaser.Physics.Arcade.Sprite;
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
          regenMatchesInitial = graphKey(again.manifest) === graphKey(initialManifest) && again.validation.valid;
        }
        if (context.input.consumePress('SECONDARY_ACTION')) {
          const alt = generation.generate(generatorId, { seed: (initialManifest.seed ^ 0x27d4eb2f) >>> 0 });
          altDiffers = graphKey(alt.manifest) !== graphKey(initialManifest);
          altValid = alt.validation.valid;
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
