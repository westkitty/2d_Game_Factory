import { defineExpandedKit } from './common.ts';

function shellSource(): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import type { SceneContext, ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const PADDLE_SPEED = 340;
const MAX_BALL_X_SPEED = 220;
const MIN_BALL_X_SPEED = 105;

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

    let paddleX = width / 2;
    const paddleY = height - 55;
    let ballX = width / 2;
    let ballY = height / 2;
    let ballVx = 180;
    let ballVy = -180;
    let score = 0;
    let lives = 3;
    let bricksRemaining = 0;
    let paddleReturns = 0;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let lastAction = 'spawn';

    const paddle = scene.add.sprite(paddleX, paddleY, context.assets.resolve('player')).setDisplaySize(150, 22);
    const ball = scene.add.sprite(ballX, ballY, context.assets.resolve('pickup')).setDisplaySize(18, 18);
    const bricks: Phaser.GameObjects.Sprite[] = [];
    const particles: Phaser.GameObjects.Sprite[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const brick = scene.add
          .sprite(260 + col * 82, 105 + row * 38, context.assets.resolve('enemy'))
          .setDisplaySize(70, 24);
        bricks.push(brick);
        bricksRemaining += 1;
      }
    }

    const status = scene.add.text(18, 15, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#111827aa',
      padding: { x: 7, y: 4 },
    }).setDepth(100);

    function resetBall(): void {
      ballX = width / 2;
      ballY = height / 2;
      ballVx = lives % 2 === 0 ? -180 : 180;
      ballVy = -180;
      ball.setPosition(ballX, ballY);
    }

    function returnFromPaddle(move: number): void {
      const contactOffset = Phaser.Math.Clamp((ballX - paddleX) / 65, -1, 1);
      const previousSign = ballVx >= 0 ? 1 : -1;
      let nextVx = Phaser.Math.Clamp(ballVx + contactOffset * 72 + move * 24, -MAX_BALL_X_SPEED, MAX_BALL_X_SPEED);
      if (Math.abs(nextVx) < MIN_BALL_X_SPEED) {
        const sign = Math.abs(contactOffset) > 0.08 ? Math.sign(contactOffset) : previousSign;
        nextVx = (sign || 1) * MIN_BALL_X_SPEED;
      }
      ballVx = nextVx;
      ballVy = -Math.abs(ballVy);
      ballY = paddleY - 24;
      paddleReturns += 1;
      lastAction = 'paddle-return';
    }

    function brickBurst(): void {
      const particle = scene.add
        .sprite(ballX, ballY, context.assets.resolve('particle'))
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

    function hitBrick(): void {
      for (const brick of bricks) {
        if (!brick.visible) continue;
        if (Math.abs(ballX - brick.x) >= 42 || Math.abs(ballY - brick.y) >= 22) continue;
        brick.setVisible(false);
        bricksRemaining -= 1;
        score += 10;
        ballVy *= -1;
        lastAction = 'brick';
        brickBurst();
        if (bricksRemaining === 0) {
          outcome = 'complete';
          ballVx = 0;
          ballVy = 0;
        }
        break;
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
        paddleX = Phaser.Math.Clamp(paddleX + move * PADDLE_SPEED * deltaMs / 1000, 85, width - 85);
        paddle.setX(paddleX);

        ballX += ballVx * deltaMs / 1000;
        ballY += ballVy * deltaMs / 1000;
        if (ballX < 12) { ballX = 12; ballVx = Math.abs(ballVx); }
        if (ballX > width - 12) { ballX = width - 12; ballVx = -Math.abs(ballVx); }
        if (ballY < 50) { ballY = 50; ballVy = Math.abs(ballVy); }

        if (
          ballVy > 0 &&
          ballY > paddleY - 25 &&
          ballY < paddleY + 12 &&
          Math.abs(ballX - paddleX) < 86
        ) {
          returnFromPaddle(move);
        }

        hitBrick();

        if (outcome === 'playing' && ballY > height + 20) {
          lives -= 1;
          lastAction = 'drain';
          if (lives <= 0) {
            outcome = 'failed';
            ballVx = 0;
            ballVy = 0;
          } else {
            resetBall();
          }
        }

        ball.setPosition(ballX, ballY);
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
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
