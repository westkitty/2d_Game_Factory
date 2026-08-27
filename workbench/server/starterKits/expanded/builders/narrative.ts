import { defineExpandedKit } from './common.ts';

export type NarrativeStarterVariant =
  | 'exploration-game'
  | 'visual-novel'
  | 'point-and-click'
  | 'interactive-fiction-hybrid'
  | 'investigation-game'
  | 'museum-exhibit'
  | 'escape-room';

function shellSource(variant: NarrativeStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, topDownController, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const WORLD_VARIANTS = new Set(['exploration-game', 'investigation-game', 'museum-exhibit']);

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-narrative-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const worldMode = WORLD_VARIANTS.has(VARIANT);
    const player = scene.physics.add.sprite(worldMode ? 120 : width * 0.5, worldMode ? 270 : 155, context.assets.resolve('player'));
    player.setScale((worldMode ? 44 : 96) / player.height);
    player.body.setAllowGravity(false);
    player.setCollideWorldBounds(true);

    const title = scene.add.text(width * 0.5, worldMode ? 24 : 270, '', { fontFamily: 'ui-monospace, monospace', fontSize: '20px', color: '#ffffff', align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5, 0).setDepth(50);
    const hint = scene.add.text(width * 0.5, worldMode ? 490 : 440, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#9fd7ff', align: 'center', wordWrap: { width: 820 } }).setOrigin(0.5).setDepth(50);

    const markers: Phaser.GameObjects.Sprite[] = [];
    const points = worldMode
      ? [{ x: 330, y: 150 }, { x: 560, y: 340 }, { x: 760, y: 180 }]
      : [{ x: 280, y: 360 }, { x: 480, y: 360 }, { x: 680, y: 360 }];
    for (const point of points) markers.push(scene.add.sprite(point.x, point.y, context.assets.resolve('pickup')).setDisplaySize(28, 28));
    const exit = scene.add.sprite(worldMode ? 875 : 760, worldMode ? 420 : 360, context.assets.resolve('exit')).setDisplaySize(34, 58);

    let dialogueStep = 0;
    let selectedChoice = 0;
    let branch: string | null = null;
    let ending: string | null = null;
    let discovered = [false, false, false];
    let clueCount = 0;
    let deductionMade = false;
    let cursorIndex = 0;
    let puzzleOne = false;
    let puzzleTwo = false;
    let inventory = 0;
    let verbState = 0;
    let outcome: 'playing' | 'complete' = 'playing';
    let lastAction = 'spawn';

    const cursor = !worldMode ? scene.add.sprite(points[0]!.x, points[0]!.y, context.assets.resolve('checkpoint')).setDisplaySize(48, 48).setAlpha(0.65) : null;

    function near(point: { x: number; y: number }, radius = 48): boolean { return Phaser.Math.Distance.Between(player.x, player.y, point.x, point.y) <= radius; }

    function worldInteract(interactPressed: boolean, secondaryPressed: boolean): void {
      if (interactPressed) {
        points.forEach((point, index) => {
          if (!discovered[index] && near(point)) {
            discovered[index] = true;
            markers[index]?.setAlpha(0.3);
            clueCount += 1;
            lastAction = VARIANT === 'museum-exhibit' ? 'view-exhibit' : VARIANT === 'investigation-game' ? 'collect-clue' : 'discover';
          }
        });
      }
      if (VARIANT === 'investigation-game' && clueCount >= 3 && secondaryPressed) {
        deductionMade = true;
        lastAction = 'deduction';
      }
      if (near({ x: exit.x, y: exit.y }, 55)) {
        const ready = VARIANT === 'investigation-game' ? deductionMade : discovered.filter(Boolean).length >= 2;
        if (ready) outcome = 'complete';
      }
    }

    function visualNovel(intent: ReturnType<typeof uiSimulationController.read>): void {
      if (ending) return;
      if (dialogueStep < 2 && intent.confirmPressed) { dialogueStep += 1; lastAction = 'advance'; return; }
      if (dialogueStep === 2) {
        if (intent.navigateLeftPressed || intent.navigateUpPressed) selectedChoice = 0;
        if (intent.navigateRightPressed || intent.navigateDownPressed) selectedChoice = 1;
        if (intent.confirmPressed) {
          branch = selectedChoice === 0 ? 'help-the-stranger' : 'keep-the-secret';
          dialogueStep = 3;
          lastAction = 'choice';
        }
      } else if (dialogueStep === 3 && intent.confirmPressed) {
        ending = branch === 'help-the-stranger' ? 'dawn-ending' : 'midnight-ending';
        outcome = 'complete';
        lastAction = 'ending';
      }
    }

    function interactiveFiction(intent: ReturnType<typeof uiSimulationController.read>): void {
      if (outcome === 'complete') return;
      if (intent.navigateLeftPressed || intent.navigateUpPressed) selectedChoice = Math.max(0, selectedChoice - 1);
      if (intent.navigateRightPressed || intent.navigateDownPressed) selectedChoice = Math.min(2, selectedChoice + 1);
      if (intent.confirmPressed) {
        if (verbState === 0) { inventory |= 1 << selectedChoice; verbState = 1; lastAction = 'verb'; }
        else { branch = (inventory & 1) ? 'opened' : 'waited'; ending = branch + '-ending'; outcome = 'complete'; lastAction = 'outcome'; }
      }
    }

    function cursorPuzzle(confirmPressed: boolean): void {
      if (!confirmPressed) return;
      if (VARIANT === 'point-and-click') {
        if (cursorIndex < 2) { if (!discovered[cursorIndex]) { discovered[cursorIndex] = true; inventory += 1; markers[cursorIndex]?.setAlpha(0.3); } lastAction = 'inspect'; }
        else if (inventory >= 2) { outcome = 'complete'; lastAction = 'exit'; }
      } else if (VARIANT === 'escape-room') {
        if (cursorIndex === 0) { puzzleOne = true; lastAction = 'puzzle-one'; }
        else if (cursorIndex === 1 && puzzleOne) { puzzleTwo = true; lastAction = 'puzzle-two'; }
        else if (cursorIndex === 2 && puzzleOne && puzzleTwo) { outcome = 'complete'; lastAction = 'escape'; }
      }
    }

    function render(): void {
      if (VARIANT === 'visual-novel') {
        const text = dialogueStep === 0 ? 'A stranger arrives at the old station.' : dialogueStep === 1 ? 'They ask you to choose what happens next.' : dialogueStep === 2 ? (selectedChoice === 0 ? '[ Help the stranger ]   Keep the secret' : 'Help the stranger   [ Keep the secret ]') : dialogueStep === 3 ? 'Your choice changes the final scene.' : String(ending);
        title.setText(text);
        hint.setText('CONFIRM advances · arrows choose');
      } else if (VARIANT === 'interactive-fiction-hybrid') {
        title.setText('Verb ' + verbState + ' · option ' + (selectedChoice + 1) + (ending ? ' · ' + ending : ''));
        hint.setText('Arrows choose a verb/object · CONFIRM acts');
      } else if (VARIANT === 'point-and-click') {
        title.setText('Hotspot ' + (cursorIndex + 1) + ' · clues ' + inventory + '/2' + (outcome === 'complete' ? ' · COMPLETE' : ''));
        hint.setText('Arrows move cursor · CONFIRM inspects/uses');
      } else if (VARIANT === 'escape-room') {
        title.setText('Lock A ' + (puzzleOne ? '✓' : '○') + ' · Lock B ' + (puzzleTwo ? '✓' : '○') + (outcome === 'complete' ? ' · ESCAPED' : ''));
        hint.setText('Solve hotspot 1, then 2, then use the exit');
      } else {
        title.setText(VARIANT + ' · progress ' + discovered.filter(Boolean).length + '/3' + (deductionMade ? ' · deduction ✓' : '') + (outcome === 'complete' ? ' · COMPLETE' : ''));
        hint.setText(VARIANT === 'investigation-game' ? 'Move · INTERACT at clues · SECONDARY to deduce · reach exit' : 'Move · INTERACT at points · reach exit');
      }
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'narrative-exploration',
      x: Math.round(player.x), y: Math.round(player.y),
      playerTextureKey: player.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      dialogueStep,
      selectedChoice,
      branch,
      ending,
      discovered,
      clueCount,
      deductionMade,
      cursorIndex,
      puzzleOne,
      puzzleTwo,
      inventory,
      verbState,
      outcome,
      lastAction,
    }));

    let disposed = false;
    render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(): void {
        if (disposed) return;
        if (worldMode) {
          const intent = topDownController.read(context.input);
          player.setVelocity(intent.moveX * 210, intent.moveY * 210);
          const secondaryPressed = context.input.justPressed('SECONDARY_ACTION');
          worldInteract(intent.interactPressed || intent.primaryPressed, secondaryPressed);
        } else if (VARIANT === 'visual-novel') {
          visualNovel(uiSimulationController.read(context.input));
        } else if (VARIANT === 'interactive-fiction-hybrid') {
          interactiveFiction(uiSimulationController.read(context.input));
        } else {
          const intent = gridController.read(context.input);
          if (intent.step === 'left' || intent.step === 'up') cursorIndex = Phaser.Math.Wrap(cursorIndex - 1, 0, 3);
          if (intent.step === 'right' || intent.step === 'down') cursorIndex = Phaser.Math.Wrap(cursorIndex + 1, 0, 3);
          cursor?.setPosition(points[cursorIndex]!.x, points[cursorIndex]!.y);
          cursorPuzzle(intent.confirmPressed || context.input.justPressed('PRIMARY_ACTION'));
        }
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy(); player.destroy(); title.destroy(); hint.destroy(); exit.destroy(); cursor?.destroy();
          for (const marker of markers) marker.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

export function narrativeStarterKit(variant: NarrativeStarterVariant) {
  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-narrative-starter',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 120, y: 270, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
