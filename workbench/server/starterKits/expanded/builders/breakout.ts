import { defineExpandedKit } from './common.ts';

function shellSource(): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { bindStarterBallPaddle, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-breakout',
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

    const table = bindStarterBallPaddle(context, { hud: false });
    const snap0 = table.snapshot();
    let paddleX = snap0.paddleX || width / 2;
    const paddleY = snap0.paddleY || height - 55;
    let ballX = snap0.ballX || width / 2;
    let ballY = snap0.ballY || height / 2;
    let score = snap0.score;
    let lives = snap0.lives || 3;
    let bricksRemaining = snap0.bricksRemaining;
    let paddleReturns = snap0.paddleReturns;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let lastAction = 'spawn';

    const paddle = scene.add.sprite(paddleX, paddleY, context.assets.resolve('player')).setDisplaySize(150, 22);
    const ball = scene.add.sprite(ballX, ballY, context.assets.resolve('pickup')).setDisplaySize(18, 18);
    const particleTextureKey = context.assets.has('particle')
      ? context.assets.resolve('particle')
      : context.assets.resolve('pickup');
    const bricks: Phaser.GameObjects.Sprite[] = [];
    const particles: Phaser.GameObjects.Sprite[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const brick = scene.add
          .sprite(260 + col * 82, 105 + row * 38, context.assets.resolve('enemy'))
          .setDisplaySize(70, 24);
        bricks.push(brick);
      }
    }
    bricksRemaining = bricks.length;

    const status = scene.add.text(18, 15, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#111827aa',
      padding: { x: 7, y: 4 },
    }).setDepth(100);

    function brickBurst(): void {
      const particle = scene.add
        .sprite(ballX, ballY, particleTextureKey)
        .setDisplaySize(14, 14)
        .setAlpha(0.95)
        .setDepth(20);
      particles.push(particle);
      scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 1.8,
        duration: 140,
        onComplete: () => particle.destroy(),
      });
    }

    function syncBricks(): void {
      const live = table.bricks();
      for (let i = 0; i < bricks.length; i++) {
        bricks[i]!.setVisible(live[i]?.alive ?? false);
      }
    }

    function render(): void {
      status.setText(
        'breakout | score ' + score + ' | bricks ' + bricksRemaining + ' | lives ' + lives +
        (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''),
      );
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: 'breakout',
      family: 'puzzle-arcade',
      playerTextureKey: paddle.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      paddleX: Math.round(paddleX),
      paddleY: Math.round(paddleY),
      ballX: Math.round(ballX),
      ballY: Math.round(ballY),
      bricksRemaining,
      lives,
      score,
      paddleReturns,
      lastAction,
      outcome,
    }));

    let disposed = false;
    render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return;

        const move = context.input.axis('MOVE_LEFT', 'MOVE_RIGHT');
        if (table.active) {
          table.setPaddleAxis(move);
          table.tick(deltaMs);
          const snap = table.snapshot();
          const previousBricks = bricksRemaining;
          paddleX = snap.paddleX;
          ballX = snap.ballX;
          ballY = snap.ballY;
          score = snap.score;
          lives = snap.lives;
          bricksRemaining = snap.bricksRemaining;
          paddleReturns = snap.paddleReturns;
          if (snap.lastResult) lastAction = snap.lastResult;
          outcome = snap.outcome as 'playing' | 'complete' | 'failed';
          if (bricksRemaining < previousBricks) brickBurst();
          syncBricks();
          paddle.setX(paddleX);
          ball.setPosition(ballX, ballY);
          render();
          return;
        }

        paddleX = Phaser.Math.Clamp(paddleX + move * 340 * deltaMs / 1000, 85, width - 85);
        paddle.setX(paddleX);
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        table.dispose();
        try {
          background?.destroy();
          paddle.destroy();
          ball.destroy();
          status.destroy();
          for (const brick of bricks) brick.destroy();
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

export function breakoutStarterKit() {
  return defineExpandedKit({
    presetId: 'breakout',
    shellPackId: 'game.expanded-breakout',
    shellSource: shellSource(),
    level: {
      entities: [
        { id: 1, class: 'PlayerSpawn', name: 'Paddle Spawn', x: 480, y: 485, width: 0, height: 0, properties: [] },
      ],
    },
    tuning: { moveSpeed: 340, jumpVelocity: 430, gravity: 1100 },
  });
}
