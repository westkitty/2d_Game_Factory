import { defineExpandedKit } from './common.ts';

export type ShooterStarterVariant =
  | 'horizontal-shmup'
  | 'vertical-shmup'
  | 'bullet-hell'
  | 'asteroids-shooter'
  | 'gallery-shooter'
  | 'run-and-gun'
  | 'rail-shooter';

function shellSource(variant: ShooterStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import {
  ProjectilePool,
  gridController,
  platformController,
  topDownController,
  vehicleController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { ActorPresentation, addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const PLAYER_HEIGHT = 42;
const PLAYER_BULLET_SPEED = 470;
const HIT_COOLDOWN_MS = 500;

interface Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  health: number;
  alive: boolean;
  vx: number;
  vy: number;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-shooter-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const player = scene.physics.add.sprite(120, VARIANT === 'vertical-shmup' ? 440 : 270, context.assets.resolve('player'));
    player.setScale(PLAYER_HEIGHT / player.height);
    player.body.setAllowGravity(VARIANT === 'run-and-gun');
    player.setCollideWorldBounds(true);
    if (VARIANT === 'run-and-gun') player.setGravityY(1100);
    const presentation = new ActorPresentation(player, { idleBob: false, lean: VARIANT === 'run-and-gun', squash: true, shadow: VARIANT === 'run-and-gun' });

    const ground = VARIANT === 'run-and-gun' ? scene.physics.add.staticGroup() : null;
    if (ground) {
      const floor = ground.create(width / 2, 510, context.assets.resolve('platform')) as Phaser.Physics.Arcade.Sprite;
      floor.setDisplaySize(width, 40);
      floor.refreshBody();
      scene.physics.add.collider(player, ground);
    }

    const playerBullets = new ProjectilePool({ scene, textureKey: context.assets.resolve('pickup'), displaySize: 8, lifetimeMs: 1800, worldWidth: width, worldHeight: height });
    const enemyBullets = new ProjectilePool({ scene, textureKey: context.assets.resolve('hazard'), displaySize: 9, lifetimeMs: 2600, worldWidth: width, worldHeight: height });
    const enemies: Enemy[] = [];
    const decorations: Phaser.GameObjects.GameObject[] = [];

    let playerHealth = 5;
    let lastHitMs = -1000;
    let elapsedMs = 0;
    let fireCooldownMs = 0;
    let enemyFireMs = 0;
    let patternBursts = 0;
    let score = 0;
    let outcome: 'playing' | 'victory' | 'failed' = 'playing';
    let heading = 0;
    let shipSpeed = 0;
    let cursorIndex = 0;
    let routeProgress = 0;
    let shotsFired = 0;
    let hits = 0;

    const status = scene.add.text(18, 16, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '15px', color: '#ffffff', backgroundColor: '#111827aa', padding: { x: 8, y: 5 },
    }).setDepth(50).setScrollFactor(0);

    function spawnEnemy(x: number, y: number, health = 2, vx = 0, vy = 0): Enemy {
      const sprite = scene.physics.add.sprite(x, y, context.assets.resolve('enemy'));
      sprite.setDisplaySize(34, 34);
      sprite.body.setAllowGravity(false);
      const enemy: Enemy = { sprite, health, alive: true, vx, vy };
      enemies.push(enemy);
      return enemy;
    }

    function liveEnemies(): Enemy[] { return enemies.filter((enemy) => enemy.alive); }

    function damageEnemy(enemy: Enemy, amount = 1): void {
      if (!enemy.alive) return;
      enemy.health -= amount;
      enemy.sprite.setTint(0xffffff);
      scene.time.delayedCall(70, () => enemy.sprite.active && enemy.sprite.clearTint());
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.sprite.setVisible(false);
        (enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
        score += 10;
        hits += 1;
      }
    }

    function hurtPlayer(): void {
      if (elapsedMs - lastHitMs < HIT_COOLDOWN_MS || outcome !== 'playing') return;
      playerHealth -= 1;
      lastHitMs = elapsedMs;
      presentation.flash();
      if (playerHealth <= 0) outcome = 'failed';
    }

    function wirePlayerShot(projectile: Phaser.Physics.Arcade.Sprite): void {
      for (const enemy of enemies) {
        scene.physics.add.overlap(projectile, enemy.sprite, () => {
          if (!enemy.alive || !projectile.active) return;
          playerBullets.remove(projectile);
          damageEnemy(enemy);
        });
      }
    }

    function firePlayer(dx: number, dy: number): void {
      if (fireCooldownMs > 0 || outcome !== 'playing') return;
      const magnitude = Math.hypot(dx, dy) || 1;
      const projectile = playerBullets.spawn(player.x, player.y, dx / magnitude * PLAYER_BULLET_SPEED, dy / magnitude * PLAYER_BULLET_SPEED);
      wirePlayerShot(projectile);
      fireCooldownMs = 140;
      shotsFired += 1;
      presentation.squash(0.1);
    }

    function fireEnemyBullet(x: number, y: number, dx: number, dy: number, speed = 180): void {
      const magnitude = Math.hypot(dx, dy) || 1;
      const bullet = enemyBullets.spawn(x, y, dx / magnitude * speed, dy / magnitude * speed);
      scene.physics.add.overlap(player, bullet, () => {
        if (!bullet.active) return;
        enemyBullets.remove(bullet);
        hurtPlayer();
      });
    }

    function configure(): void {
      if (VARIANT === 'horizontal-shmup') {
        spawnEnemy(500, 170, 2); spawnEnemy(660, 300, 2); spawnEnemy(810, 220, 2);
      } else if (VARIANT === 'vertical-shmup') {
        spawnEnemy(280, 120, 2); spawnEnemy(480, 90, 2); spawnEnemy(700, 140, 2);
      } else if (VARIANT === 'bullet-hell') {
        const boss = spawnEnemy(760, 270, 10);
        boss.sprite.setDisplaySize(72, 72);
      } else if (VARIANT === 'asteroids-shooter') {
        spawnEnemy(420, 160, 2, 22, 14); spawnEnemy(660, 340, 2, -18, 20); spawnEnemy(800, 170, 2, -26, -12);
      } else if (VARIANT === 'gallery-shooter' || VARIANT === 'rail-shooter') {
        spawnEnemy(360, 170, 1); spawnEnemy(520, 270, 1); spawnEnemy(680, 150, 1); spawnEnemy(760, 360, 1); spawnEnemy(420, 380, 1);
      } else if (VARIANT === 'run-and-gun') {
        spawnEnemy(420, 466, 2); spawnEnemy(650, 466, 2); spawnEnemy(810, 466, 2);
        const exit = scene.add.sprite(905, 450, context.assets.resolve('exit')).setDisplaySize(30, 60);
        decorations.push(exit);
      }
    }
    configure();

    const cursor = (VARIANT === 'gallery-shooter' || VARIANT === 'rail-shooter')
      ? scene.add.sprite(enemies[0]?.sprite.x ?? 480, enemies[0]?.sprite.y ?? 270, context.assets.resolve('checkpoint')).setDisplaySize(48, 48).setAlpha(0.7)
      : null;
    if (cursor) decorations.push(cursor);

    function cursorFire(): void {
      const targets = liveEnemies();
      if (targets.length === 0) return;
      cursorIndex = Phaser.Math.Wrap(cursorIndex, 0, targets.length);
      const target = targets[cursorIndex] ?? targets[0]!;
      damageEnemy(target, 1);
      shotsFired += 1;
      if (VARIANT === 'rail-shooter') routeProgress += 1;
    }

    function updateBulletPatterns(deltaMs: number): void {
      if (VARIANT !== 'bullet-hell' || outcome !== 'playing') return;
      const boss = liveEnemies()[0];
      if (!boss) return;
      enemyFireMs -= deltaMs;
      if (enemyFireMs <= 0) {
        const spokes = 12;
        const offset = (patternBursts % 2) * Math.PI / spokes;
        for (let i = 0; i < spokes; i++) {
          const angle = offset + i * Math.PI * 2 / spokes;
          fireEnemyBullet(boss.sprite.x, boss.sprite.y, Math.cos(angle), Math.sin(angle), 165);
        }
        patternBursts += 1;
        enemyFireMs = 430;
      }
    }

    function updateEnemyFire(deltaMs: number): void {
      if (VARIANT !== 'horizontal-shmup' && VARIANT !== 'vertical-shmup') return;
      enemyFireMs -= deltaMs;
      if (enemyFireMs > 0) return;
      for (const enemy of liveEnemies()) fireEnemyBullet(enemy.sprite.x, enemy.sprite.y, player.x - enemy.sprite.x, player.y - enemy.sprite.y, 150);
      enemyFireMs = 1200;
    }

    function updateAsteroids(deltaMs: number): void {
      if (VARIANT !== 'asteroids-shooter') return;
      for (const enemy of liveEnemies()) {
        enemy.sprite.x = Phaser.Math.Wrap(enemy.sprite.x + enemy.vx * deltaMs / 1000, 20, width - 20);
        enemy.sprite.y = Phaser.Math.Wrap(enemy.sprite.y + enemy.vy * deltaMs / 1000, 20, height - 20);
        if (Phaser.Math.Distance.Between(player.x, player.y, enemy.sprite.x, enemy.sprite.y) < 34) hurtPlayer();
      }
    }

    function updateOutcome(): void {
      if (outcome !== 'playing') return;
      if (liveEnemies().length === 0) outcome = 'victory';
      if (VARIANT === 'gallery-shooter' && elapsedMs >= 12000 && liveEnemies().length > 0) outcome = 'failed';
    }

    function renderStatus(): void {
      status.setText(VARIANT + ' | HP ' + playerHealth + ' | targets ' + liveEnemies().length + ' | score ' + score + (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''));
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'shooter',
      x: Math.round(player.x), y: Math.round(player.y),
      playerTextureKey: player.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      playerHealth,
      enemiesRemaining: liveEnemies().length,
      score,
      shotsFired,
      hits,
      patternBursts,
      enemyBulletsSpawned: enemyBullets.spawnedTotal,
      playerBulletsSpawned: playerBullets.spawnedTotal,
      heading,
      shipSpeed: Math.round(shipSpeed),
      cursorIndex,
      routeProgress,
      outcome,
      elapsedMs: Math.round(elapsedMs),
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;
        fireCooldownMs = Math.max(0, fireCooldownMs - deltaMs);

        if (outcome === 'playing') {
          if (VARIANT === 'run-and-gun') {
            const intent = platformController.read(context.input);
            player.setVelocityX(intent.moveAxis * 220);
            if (intent.jumpPressed && player.body.blocked.down) player.setVelocityY(-430);
            if (context.input.justPressed('PRIMARY_ACTION')) firePlayer(1, 0);
            if (player.x > 870 && liveEnemies().length === 0) outcome = 'victory';
          } else if (VARIANT === 'asteroids-shooter') {
            const intent = vehicleController.read(context.input);
            heading += intent.steering * 2.7 * deltaMs / 1000;
            shipSpeed += (intent.throttle * 120 - intent.brake * 160) * deltaMs / 1000;
            shipSpeed *= Math.pow(0.985, deltaMs / 16.667);
            shipSpeed = Phaser.Math.Clamp(shipSpeed, -45, intent.boostHeld ? 260 : 190);
            player.x = Phaser.Math.Wrap(player.x + Math.cos(heading) * shipSpeed * deltaMs / 1000, 16, width - 16);
            player.y = Phaser.Math.Wrap(player.y + Math.sin(heading) * shipSpeed * deltaMs / 1000, 16, height - 16);
            player.setRotation(heading);
            if (intent.secondaryPressed || context.input.justPressed('PRIMARY_ACTION')) firePlayer(Math.cos(heading), Math.sin(heading));
            updateAsteroids(deltaMs);
          } else if (VARIANT === 'gallery-shooter' || VARIANT === 'rail-shooter') {
            const intent = gridController.read(context.input);
            const targets = liveEnemies();
            if (targets.length > 0) {
              if (intent.step === 'left' || intent.step === 'up') cursorIndex = Phaser.Math.Wrap(cursorIndex - 1, 0, targets.length);
              if (intent.step === 'right' || intent.step === 'down') cursorIndex = Phaser.Math.Wrap(cursorIndex + 1, 0, targets.length);
              const target = targets[cursorIndex] ?? targets[0]!;
              cursor?.setPosition(target.sprite.x, target.sprite.y);
            }
            if (intent.confirmPressed || context.input.justPressed('PRIMARY_ACTION')) cursorFire();
            if (VARIANT === 'rail-shooter') routeProgress += deltaMs / 1000;
          } else {
            const intent = topDownController.read(context.input);
            player.setVelocity(intent.moveX * 210, intent.moveY * 210);
            if (intent.primaryPressed) {
              if (VARIANT === 'vertical-shmup') firePlayer(0, -1);
              else if (intent.aimMagnitude > 0) firePlayer(intent.aimX, intent.aimY);
              else firePlayer(1, 0);
            }
            updateBulletPatterns(deltaMs);
            updateEnemyFire(deltaMs);
          }
          updateOutcome();
        } else if (VARIANT !== 'run-and-gun') {
          player.setVelocity(0, 0);
        }

        playerBullets.update(deltaMs);
        enemyBullets.update(deltaMs);
        presentation.update(deltaMs, VARIANT !== 'run-and-gun' || player.body.blocked.down);
        renderStatus();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        presentation.dispose();
        playerBullets.dispose();
        enemyBullets.dispose();
        try {
          background?.destroy(); player.destroy(); status.destroy();
          for (const enemy of enemies) enemy.sprite.destroy();
          for (const object of decorations) object.destroy();
          ground?.clear(true, true); ground?.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

export function shooterStarterKit(variant: ShooterStarterVariant) {
  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-shooter-starter',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 120, y: 270, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
