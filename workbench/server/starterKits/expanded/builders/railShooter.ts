import { defineExpandedKit } from './common.ts';

function shellSource(): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

type Target = {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly stage: number;
  alive: boolean;
};

const STAGE_DELAY_MS = 550;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-rail-shooter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(
      scene,
      context.assets.has('background') ? context.assets.resolve('background') : null,
      width,
      height,
    );
    const player = scene.add.sprite(120, height / 2, context.assets.resolve('player')).setDisplaySize(42, 42);
    const particleTextureKey = context.assets.has('particle')
      ? context.assets.resolve('particle')
      : context.assets.resolve('enemy');

    const layouts = [
      [{ x: 350, y: 175 }, { x: 420, y: 350 }],
      [{ x: 585, y: 135 }, { x: 655, y: 330 }],
      [{ x: 800, y: 245 }],
    ] as const;
    const targets: Target[] = [];
    for (let stage = 0; stage < layouts.length; stage++) {
      for (const point of layouts[stage]!) {
        const sprite = scene.add.sprite(point.x, point.y, context.assets.resolve('enemy')).setDisplaySize(38, 38);
        sprite.setVisible(stage === 0);
        targets.push({ sprite, stage, alive: true });
      }
    }

    let currentStage = 0;
    let cursorIndex = 0;
    let transitionMs = 0;
    let routeProgress = 0;
    let shotsFired = 0;
    let hits = 0;
    let score = 0;
    let lastAction = 'stage-ready';
    let outcome: 'playing' | 'victory' = 'playing';
    const cursor = scene.add.sprite(350, 175, context.assets.resolve('checkpoint')).setDisplaySize(50, 50).setAlpha(0.72);
    const particles: Phaser.GameObjects.Sprite[] = [];
    const status = scene.add.text(18, 16, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#111827aa',
      padding: { x: 8, y: 5 },
    }).setDepth(50);

    function activeTargets(): Target[] {
      return targets.filter((target) => target.alive && target.stage === currentStage && target.sprite.visible);
    }

    function remainingTargets(): number {
      return targets.filter((target) => target.alive).length;
    }

    function syncCursor(): void {
      const available = activeTargets();
      if (available.length === 0) {
        cursor.setVisible(false);
        return;
      }
      cursorIndex = Phaser.Math.Wrap(cursorIndex, 0, available.length);
      const target = available[cursorIndex] ?? available[0]!;
      cursor.setVisible(true).setPosition(target.sprite.x, target.sprite.y);
    }

    function burst(x: number, y: number): void {
      const particle = scene.add.sprite(x, y, particleTextureKey).setDisplaySize(14, 14).setDepth(30);
      particles.push(particle);
      scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 1.8,
        duration: 150,
        onComplete: () => particle.destroy(),
      });
    }

    function revealStage(stage: number): void {
      currentStage = stage;
      cursorIndex = 0;
      for (const target of targets) target.sprite.setVisible(target.alive && target.stage === currentStage);
      routeProgress = currentStage;
      lastAction = 'stage-ready';
      syncCursor();
    }

    function finishOrAdvance(): void {
      if (activeTargets().length > 0) return;
      cursor.setVisible(false);
      if (currentStage >= layouts.length - 1) {
        routeProgress = layouts.length;
        outcome = 'victory';
        lastAction = 'route-complete';
        return;
      }
      transitionMs = STAGE_DELAY_MS;
      routeProgress = currentStage + 0.5;
      lastAction = 'route-advance';
    }

    function fire(): void {
      if (outcome !== 'playing' || transitionMs > 0) return;
      const available = activeTargets();
      if (available.length === 0) return;
      cursorIndex = Phaser.Math.Wrap(cursorIndex, 0, available.length);
      const target = available[cursorIndex] ?? available[0]!;
      shotsFired += 1;
      hits += 1;
      score += 10;
      target.alive = false;
      target.sprite.setVisible(false);
      burst(target.sprite.x, target.sprite.y);
      lastAction = 'hit';
      if (activeTargets().length === 0) finishOrAdvance();
      else {
        cursorIndex = Phaser.Math.Clamp(cursorIndex, 0, activeTargets().length - 1);
        syncCursor();
      }
    }

    function render(): void {
      status.setText(
        'rail-shooter | stage ' + (currentStage + 1) + '/' + layouts.length +
        ' | targets ' + remainingTargets() + ' | score ' + score +
        (transitionMs > 0 ? ' | moving...' : '') +
        (outcome !== 'playing' ? ' | VICTORY' : ''),
      );
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: 'rail-shooter',
      family: 'shooter',
      playerTextureKey: player.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      currentStage,
      activeTargets: activeTargets().length,
      enemiesRemaining: remainingTargets(),
      cursorIndex,
      transitionMs: Math.round(transitionMs),
      routeProgress,
      shotsFired,
      hits,
      score,
      lastAction,
      outcome,
    }));

    let disposed = false;
    render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return;

        if (transitionMs > 0) {
          transitionMs = Math.max(0, transitionMs - deltaMs);
          if (transitionMs === 0) revealStage(currentStage + 1);
          render();
          return;
        }

        const intent = gridController.read(context.input);
        const available = activeTargets();
        if (available.length > 0) {
          if (intent.step === 'left' || intent.step === 'up') cursorIndex = Phaser.Math.Wrap(cursorIndex - 1, 0, available.length);
          if (intent.step === 'right' || intent.step === 'down') cursorIndex = Phaser.Math.Wrap(cursorIndex + 1, 0, available.length);
          syncCursor();
        }
        if (intent.confirmPressed || context.input.justPressed('PRIMARY_ACTION')) fire();
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy();
          player.destroy();
          cursor.destroy();
          status.destroy();
          for (const target of targets) target.sprite.destroy();
          for (const particle of particles) if (particle.active) particle.destroy();
        } catch {
          /* scene teardown */
        }
      },
    };
  },
};
`;
}

export function railShooterStarterKit() {
  return defineExpandedKit({
    presetId: 'rail-shooter',
    shellPackId: 'game.expanded-rail-shooter',
    shellSource: shellSource(),
    level: {
      entities: [
        { id: 1, class: 'PlayerSpawn', name: 'Start', x: 120, y: 270, width: 0, height: 0, properties: [] },
      ],
    },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
