import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, PuzzleRulesService, PuzzleSnapshot } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - puzzle-platformer (see ../PROOF_CONTRACT.md).
 *
 * A platforming shell whose switch/goal puzzle is defined entirely through
 * the same data architecture the sokoban proof uses: the switch set, the
 * link (`a` also toggles the decoy `d`), and the completion rule (the press
 * order must end `a,b,c`) all live in the validated `content/puzzles.json`
 * document, resolved by the reusable `sw2d.puzzle-rules` capability. This
 * file owns no puzzle state and no completion logic: it walks the player,
 * detects which level switch the player overlaps, and forwards a bounded
 * `toggle` op. INTERACT toggles, CANCEL undoes, SECONDARY_ACTION resets.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

interface SwitchZone {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SwitchSnap extends PuzzleSnapshot {
  readonly on: readonly string[];
  readonly pressOrder: readonly string[];
  readonly switches: readonly string[];
}

function readMoveSpeed(context: SceneContext): number {
  const tuning = context.content.data[TUNING_DOCUMENT]?.value as { player?: { moveSpeed?: number; jumpVelocity?: number; gravity?: number } } | undefined;
  return tuning?.player?.moveSpeed ?? 220;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [PUZZLE_RULES_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const moveSpeed = readMoveSpeed(context);
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const puzzle = context.capabilities.require<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');
    const switchKey = context.assets.resolve('checkpoint');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((o) => o.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? 40, spawn?.y ?? 440, playerKey);
    player.setCollideWorldBounds(true);
    player.setGravityY(1100);
    scene.physics.add.collider(player, ground);

    const zones: SwitchZone[] = (level?.objects ?? [])
      .filter((o) => o.class === 'Interactable' && typeof o.properties.interactionId === 'string')
      .map((o) => ({ id: String(o.properties.interactionId), x: o.x, y: o.y, width: o.width, height: o.height }));

    const zoneSprites = new Map<string, Phaser.GameObjects.Sprite>();
    for (const z of zones) {
      zoneSprites.set(z.id, scene.add.sprite(z.x + z.width / 2, z.y + z.height / 2, switchKey));
    }

    const snap = (): SwitchSnap => puzzle.snapshot() as SwitchSnap;

    const overlapping = (): string | null => {
      for (const z of zones) {
        if (player.x >= z.x && player.x <= z.x + z.width && player.y >= z.y - 40 && player.y <= z.y + z.height) return z.id;
      }
      return null;
    };

    let toggles = 0;

    const debugHandle = context.debug.contribute('game.platform-shell', () => {
      const s = snap();
      return {
        puzzle: s,
        solved: puzzle.isSolved(),
        playerX: Math.round(player.x),
        overlapping: overlapping(),
        toggles,
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * moveSpeed);
        if (intent.jumpPressed && player.body.blocked.down) player.setVelocityY(-430);

        if (context.input.consumePress('INTERACT')) {
          const id = overlapping();
          if (id !== null) {
            puzzle.apply({ kind: 'toggle', id });
            toggles += 1;
          }
        }
        if (context.input.consumePress('CANCEL')) puzzle.undo();
        if (context.input.consumePress('SECONDARY_ACTION')) puzzle.reset();

        const on = new Set(snap().on);
        for (const [id, sprite] of zoneSprites) sprite.setAlpha(on.has(id) ? 1 : 0.35);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          player.destroy();
          for (const s of zoneSprites.values()) s.destroy();
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
