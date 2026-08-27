import { defineExpandedKit } from './common.ts';

function shellSource(): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const CELL = 62;
const ORIGIN_X = 170;
const ORIGIN_Y = 135;
const COLS = 5;
const ROWS = 5;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-maze',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const objects: Phaser.GameObjects.GameObject[] = [];
    const mazeWalls = new Set(['1,1', '2,1', '3,1', '1,3', '2,3', '3,3', '3,2']);
    const toPixel = (col: number, row: number): [number, number] => [ORIGIN_X + col * CELL, ORIGIN_Y + row * CELL];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!mazeWalls.has(col + ',' + row)) continue;
        const wall = scene.add.sprite(...toPixel(col, row), context.assets.resolve('platform')).setDisplaySize(52, 52).setAlpha(0.78);
        objects.push(wall);
      }
    }

    const pickup = scene.add.sprite(...toPixel(0, 4), context.assets.resolve('pickup')).setDisplaySize(34, 34);
    const exit = scene.add.sprite(...toPixel(4, 4), context.assets.resolve('exit')).setDisplaySize(44, 56).setAlpha(0.95);
    const avatar = scene.add.sprite(...toPixel(0, 0), context.assets.resolve('player')).setDisplaySize(40, 40).setDepth(10);
    const status = scene.add.text(18, 15, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#111827aa',
      padding: { x: 7, y: 4 },
    }).setDepth(100);
    objects.push(pickup, exit, avatar, status);

    let mazeCell = { col: 0, row: 0 };
    let mazeHasPickup = false;
    let lastAction = 'spawn';
    let outcome: 'playing' | 'complete' = 'playing';

    function move(step: 'up' | 'down' | 'left' | 'right' | null): void {
      if (!step || outcome !== 'playing') return;
      const next = { ...mazeCell };
      if (step === 'left') next.col -= 1;
      if (step === 'right') next.col += 1;
      if (step === 'up') next.row -= 1;
      if (step === 'down') next.row += 1;

      const valid =
        next.col >= 0 && next.col < COLS &&
        next.row >= 0 && next.row < ROWS &&
        !mazeWalls.has(next.col + ',' + next.row);
      if (!valid) {
        lastAction = 'wall';
        return;
      }

      mazeCell = next;
      avatar.setPosition(...toPixel(mazeCell.col, mazeCell.row));
      lastAction = 'move';
      if (mazeCell.col === 0 && mazeCell.row === 4 && !mazeHasPickup) {
        mazeHasPickup = true;
        pickup.setVisible(false);
        lastAction = 'pickup';
      }
      if (mazeCell.col === 4 && mazeCell.row === 4) {
        outcome = 'complete';
        lastAction = 'exit';
      }
    }

    function render(): void {
      status.setText('maze-game | ' + mazeCell.col + ',' + mazeCell.row + (mazeHasPickup ? ' | pickup' : '') + (outcome === 'complete' ? ' | COMPLETE' : ''));
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: 'maze-game',
      family: 'puzzle-arcade',
      playerTextureKey: avatar.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      mazeCell,
      mazeHasPickup,
      lastAction,
      outcome,
    }));

    let disposed = false;
    render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(): void {
        if (disposed || outcome !== 'playing') return;
        move(gridController.read(context.input).step);
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy();
          for (const object of objects) object.destroy();
        } catch {
          /* scene teardown */
        }
      },
    };
  },
};
`;
}

export function mazeStarterKit() {
  return defineExpandedKit({
    presetId: 'maze-game',
    shellPackId: 'game.expanded-maze',
    shellSource: shellSource(),
    level: {
      entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 170, y: 135, width: 0, height: 0, properties: [] }],
    },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
