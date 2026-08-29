import Phaser from 'phaser';
import type { InstalledSystemPack, PuzzleRulesService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { bindCollectiblePickups, bindStarterWeapon, platformController, resolveSceneLevel, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: platform controller family.
 *
 * Copied verbatim by `sw2d new` for any preset whose primary controller
 * family is `platform` - this is the "bounded shared template per real
 * controller family" MASTER_PROJECT.md section 8 asks for, the same pattern
 * `starter/src/game-specific/placeholderMoverPack.ts` and `tiledLevelPack.ts`
 * already prove: the runtime is never edited, only this game-specific file
 * reads `platformController` intent and decides how the body moves.
 *
 * Edit this file freely - it lives in `src/game-specific/`, the part of a
 * generated game normal game work touches.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

/**
 * `content/tuning.json`, read for real.
 *
 * Phase 9 / Gate B found that every generated game validated this document and
 * then never read a single value from it - the numbers below were hard-coded
 * in the update loop instead, so editing `content/tuning.json` changed
 * nothing. That made the generated README's "content/tuning.json (tuning
 * values)" claim untrue. The fallbacks are the same numbers the generator
 * writes, so a game with a hand-trimmed tuning document still runs.
 */
interface PlayerTuning {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

function readPlayerTuning(context: SceneContext): PlayerTuning {
  const tuning = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<PlayerTuning> } | undefined;
  return {
    moveSpeed: tuning?.player?.moveSpeed ?? 220,
    jumpVelocity: tuning?.player?.jumpVelocity ?? 430,
    gravity: tuning?.player?.gravity ?? 1100,
  };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    // Procedural generation (capability program Phase 7): a deterministic
    // seeded NormalizedLevel when sw2d.generation is installed, else the
    // hand-authored content/levels/main.json.
    const { level, manifest: generationManifest } = resolveSceneLevel(context, LEVEL_DOCUMENT);
    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const { width, height } = context.definition.viewport;
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.4;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    scene.physics.add.collider(player, ground);

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items; then every Collectible whose itemId names a
    // catalog entry grants that item and applies its effects through the
    // reusable service - no per-pickup code here.
    const pickups = bindCollectiblePickups(context, player, level);
    // Weapons (capability program Phase 3). Inert unless sw2d.weapons is installed.
    const weapon = bindStarterWeapon(context);
    // Data-driven puzzle rules (capability program Phase 6). Inert unless
    // sw2d.puzzle-rules is installed; then SECONDARY_ACTION toggles the next
    // switch and CANCEL undoes, all through the reusable service - the
    // switch/goal ruleset and solved-detection are content/puzzles.json, not
    // code here.
    const puzzle = context.capabilities.get<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
    let nowMs = 0;
    let facing = 1;

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
      weapon: weapon.snapshot(),
      ...(puzzle ? { puzzle: puzzle.snapshot(), solved: puzzle.isSolved() } : {}),
      ...(generationManifest ? { generation: generationManifest } : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * tuning.moveSpeed);
        if (intent.moveAxis !== 0) {
          player.setFlipX(intent.moveAxis < 0);
          facing = intent.moveAxis < 0 ? -1 : 1;
        }
        weapon.update(deltaMs, nowMs);
        if (intent.primaryPressed) weapon.fire(nowMs, facing, 0, { x: player.x, y: player.y });
        if (puzzle) {
          if (context.input.consumePress('SECONDARY_ACTION')) {
            const snap = puzzle.snapshot() as { switches?: readonly string[]; on?: readonly string[] };
            const nextSwitch = (snap.switches ?? []).find((id) => !(snap.on ?? []).includes(id));
            if (nextSwitch !== undefined) puzzle.apply({ kind: 'toggle', id: nextSwitch });
          }
          if (context.input.consumePress('CANCEL')) puzzle.undo();
        }
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(-tuning.jumpVelocity);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        weapon.dispose();
        // A restart's batched stop+start can already have torn down this
        // scene's physics world by the time this runs - see
        // placeholderMoverPack.ts's own comment for the full story. Each
        // step is independently guarded for the same reason.
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
