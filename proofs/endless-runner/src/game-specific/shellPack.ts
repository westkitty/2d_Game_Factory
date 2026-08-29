import Phaser from 'phaser';
import type { GenerationManifest, GenerationService, InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { GENERATION_CAPABILITY_ID } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - endless-runner (see ../PROOF_CONTRACT.md).
 *
 * The level is NOT hand-authored: `sw2d.generation` (capability program
 * Phase 7) runs its `main` segment-chain generator from the seed in
 * `content/generation.json` and returns a NormalizedLevel this shell renders
 * exactly as it would a Tiled level. The shell owns no generation logic:
 *  - INTERACT re-runs the generator with the SAME effective seed and records
 *    whether the chosen-template sequence is byte-identical (reproducibility).
 *  - SECONDARY_ACTION re-runs with a DIFFERENT seed and records whether the
 *    sequence differs while the result stays valid.
 */

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [GENERATION_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const generation = context.capabilities.require<GenerationService>(GENERATION_CAPABILITY_ID);
    const generatorId = generation.availableGenerators().includes('main') ? 'main' : generation.availableGenerators()[0]!;

    const run = generation.generate(generatorId);
    const level: NormalizedLevel = run.output;
    const initialManifest: GenerationManifest = run.manifest;

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level.objects.find((o) => o.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? 40, spawn?.y ?? 420, playerKey);
    player.setCollideWorldBounds(false);
    player.setGravityY(1100);
    scene.physics.add.collider(player, ground);

    const startX = player.x;
    let maxX = player.x;
    let regenMatchesInitial: boolean | null = null;
    let altDiffers: boolean | null = null;
    let altValid: boolean | null = null;

    const seq = (m: GenerationManifest): string => m.chosenTemplates.join(',');

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      generatorId,
      seed: initialManifest.seed,
      kind: initialManifest.kind,
      chosenTemplates: initialManifest.chosenTemplates,
      segmentCount: initialManifest.chosenTemplates.length,
      valid: run.validation.valid,
      errors: run.validation.errors,
      playerX: Math.round(player.x),
      progressedX: Math.round(maxX - startX),
      solidCount: level.solids.length,
      spawnPlaced: Boolean(spawn),
      regenMatchesInitial,
      altDiffers,
      altValid,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * 240);
        if (intent.jumpPressed && player.body.blocked.down) player.setVelocityY(-430);
        maxX = Math.max(maxX, player.x);

        if (context.input.consumePress('INTERACT')) {
          // same effective seed -> identical sequence
          const again = generation.generate(generatorId, { seed: initialManifest.seed });
          regenMatchesInitial = seq(again.manifest) === seq(initialManifest) && again.validation.valid;
        }
        if (context.input.consumePress('SECONDARY_ACTION')) {
          const alt = generation.generate(generatorId, { seed: (initialManifest.seed ^ 0x5bd1e995) >>> 0 });
          altDiffers = seq(alt.manifest) !== seq(initialManifest);
          altValid = alt.validation.valid;
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          player.destroy();
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
