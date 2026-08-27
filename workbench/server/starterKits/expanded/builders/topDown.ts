import { defineExpandedKit } from './common.ts';

export type TopDownStarterVariant =
  | 'top-down-adventure'
  | 'action-adventure'
  | 'survivor-like'
  | 'dungeon-crawler'
  | 'action-roguelite'
  | 'stealth-game'
  | 'heist-game'
  | 'arena-combat'
  | 'boss-rush';

function shellSource(variant: TopDownStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { ActorPresentation, addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const LEVEL_DOCUMENT = 'levels/main';
const MOVE_SPEED = 220;
const PLAYER_HEIGHT = 44;

interface Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  health: number;
  maxHealth: number;
  alive: boolean;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-top-down-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const player = scene.physics.add.sprite(spawn?.x ?? 120, spawn?.y ?? 270, context.assets.resolve('player'));
    player.setScale(PLAYER_HEIGHT / player.height);
    player.body.setAllowGravity(false);
    player.setCollideWorldBounds(true);
    const presentation = new ActorPresentation(player, { idleBob: false, lean: false, squash: true, shadow: false });

    const enemies: Enemy[] = [];
    const decorative: Phaser.GameObjects.GameObject[] = [];
    let objectiveSprite: Phaser.GameObjects.Sprite | null = null;
    let exitSprite: Phaser.GameObjects.Sprite | null = null;
    let upgradeSprite: Phaser.GameObjects.Sprite | null = null;
    let objectiveCollected = false;
    let upgradeCollected = false;
    let alarm = false;
    let guardSeesPlayer = false;
    let outcome: 'playing' | 'victory' | 'failed' = 'playing';
    let playerHealth = 5;
    let attackDamage = 1;
    let elapsedMs = 0;
    let lastHitMs = -1000;
    let autoAttackMs = 0;
    let survivorSpawnMs = 0;
    let spawnedTotal = 0;
    let bossPhase = 0;
    let runResets = 0;
    let lastAction = 'spawn';

    const status = scene.add.text(18, 16, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#111827aa',
      padding: { x: 8, y: 5 },
    }).setScrollFactor(0).setDepth(50);

    function spawnEnemy(x: number, y: number, health = 2): Enemy {
      const sprite = scene.physics.add.sprite(x, y, context.assets.resolve('enemy'));
      sprite.setDisplaySize(34, 34);
      sprite.body.setAllowGravity(false);
      const enemy: Enemy = { sprite, health, maxHealth: health, alive: true };
      enemies.push(enemy);
      spawnedTotal += 1;
      return enemy;
    }

    function livingEnemies(): Enemy[] {
      return enemies.filter((enemy) => enemy.alive);
    }

    function nearestEnemy(maxDistance = Infinity): Enemy | null {
      let best: Enemy | null = null;
      let bestDistance = maxDistance;
      for (const enemy of livingEnemies()) {
        const distance = Phaser.Math.Distance.Between(player.x, player.y, enemy.sprite.x, enemy.sprite.y);
        if (distance < bestDistance) {
          best = enemy;
          bestDistance = distance;
        }
      }
      return best;
    }

    function damageEnemy(enemy: Enemy, amount: number): void {
      if (!enemy.alive) return;
      enemy.health -= amount;
      enemy.sprite.setTint(0xffffff);
      scene.time.delayedCall(80, () => enemy.sprite.active && enemy.sprite.clearTint());
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.sprite.setVisible(false);
        (enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    }

    function attack(): void {
      const target = nearestEnemy(VARIANT === 'boss-rush' ? 280 : 145);
      if (!target) return;
      damageEnemy(target, attackDamage);
      presentation.squash(0.12);
      lastAction = 'attack';
    }

    function placeObjective(x: number, y: number): void {
      objectiveSprite = scene.add.sprite(x, y, context.assets.resolve('pickup')).setDisplaySize(26, 26);
      decorative.push(objectiveSprite);
    }

    function placeExit(x: number, y: number): void {
      exitSprite = scene.add.sprite(x, y, context.assets.resolve('exit')).setDisplaySize(34, 60);
      decorative.push(exitSprite);
    }

    function collectNearby(): void {
      if (objectiveSprite && objectiveSprite.visible && Phaser.Math.Distance.Between(player.x, player.y, objectiveSprite.x, objectiveSprite.y) < 42) {
        objectiveCollected = true;
        objectiveSprite.setVisible(false);
        lastAction = 'objective';
        if (VARIANT === 'heist-game') alarm = true;
      }
      if (upgradeSprite && upgradeSprite.visible && Phaser.Math.Distance.Between(player.x, player.y, upgradeSprite.x, upgradeSprite.y) < 42) {
        upgradeCollected = true;
        attackDamage = 2;
        upgradeSprite.setVisible(false);
        lastAction = 'upgrade';
        if (VARIANT === 'action-roguelite') outcome = 'victory';
      }
      if (exitSprite && Phaser.Math.Distance.Between(player.x, player.y, exitSprite.x, exitSprite.y) < 48) {
        const enemiesClear = livingEnemies().length === 0;
        if (VARIANT === 'top-down-adventure' && objectiveCollected) outcome = 'victory';
        if ((VARIANT === 'action-adventure' || VARIANT === 'dungeon-crawler') && objectiveCollected && enemiesClear) outcome = 'victory';
        if (VARIANT === 'stealth-game' && objectiveCollected && !alarm) outcome = 'victory';
        if (VARIANT === 'heist-game' && objectiveCollected) outcome = 'victory';
      }
    }

    function resetRun(): void {
      for (const enemy of enemies) enemy.sprite.destroy();
      enemies.length = 0;
      objectiveSprite?.destroy();
      exitSprite?.destroy();
      upgradeSprite?.destroy();
      objectiveSprite = null;
      exitSprite = null;
      upgradeSprite = null;
      objectiveCollected = false;
      upgradeCollected = false;
      alarm = false;
      guardSeesPlayer = false;
      outcome = 'playing';
      playerHealth = 5;
      attackDamage = 1;
      elapsedMs = 0;
      autoAttackMs = 0;
      survivorSpawnMs = 0;
      spawnedTotal = 0;
      bossPhase = 0;
      player.setPosition(spawn?.x ?? 120, spawn?.y ?? 270);
      configureVariant();
      runResets += 1;
    }

    function configureVariant(): void {
      if (VARIANT === 'top-down-adventure') {
        placeObjective(650, 170);
        placeExit(850, 420);
      } else if (VARIANT === 'action-adventure') {
        spawnEnemy(470, 270, 3);
        placeObjective(690, 170);
        placeExit(850, 420);
      } else if (VARIANT === 'dungeon-crawler') {
        spawnEnemy(440, 210, 2);
        spawnEnemy(560, 330, 2);
        placeObjective(720, 270);
        placeExit(860, 270);
      } else if (VARIANT === 'arena-combat') {
        spawnEnemy(420, 160, 2);
        spawnEnemy(560, 270, 2);
        spawnEnemy(420, 380, 2);
      } else if (VARIANT === 'action-roguelite') {
        spawnEnemy(420, 190, 2);
        spawnEnemy(540, 350, 2);
      } else if (VARIANT === 'stealth-game' || VARIANT === 'heist-game') {
        spawnEnemy(520, 270, 99);
        placeObjective(790, 140);
        placeExit(110, 90);
      } else if (VARIANT === 'boss-rush') {
        bossPhase = 1;
        spawnEnemy(700, 270, 6);
      }
    }
    configureVariant();

    function updateGuard(): void {
      if (VARIANT !== 'stealth-game' && VARIANT !== 'heist-game') return;
      const guard = enemies[0];
      if (!guard) return;
      guardSeesPlayer = Math.abs(player.y - guard.sprite.y) < 58 && Math.abs(player.x - guard.sprite.x) < 175;
      guard.sprite.setAlpha(guardSeesPlayer ? 1 : 0.72);
      if (guardSeesPlayer) {
        alarm = true;
        if (VARIANT === 'stealth-game') outcome = 'failed';
      }
    }

    function updateEnemyPressure(deltaMs: number): void {
      if (VARIANT === 'survivor-like') {
        survivorSpawnMs += deltaMs;
        if (spawnedTotal < 6 && survivorSpawnMs >= 1400) {
          survivorSpawnMs = 0;
          const angle = (spawnedTotal * Math.PI * 2) / 6;
          spawnEnemy(width / 2 + Math.cos(angle) * 230, height / 2 + Math.sin(angle) * 180, 2);
        }
      }
      for (const enemy of livingEnemies()) {
        if (VARIANT === 'stealth-game' || VARIANT === 'heist-game') continue;
        if (VARIANT !== 'survivor-like' && VARIANT !== 'boss-rush') continue;
        const dx = player.x - enemy.sprite.x;
        const dy = player.y - enemy.sprite.y;
        const distance = Math.hypot(dx, dy) || 1;
        const speed = VARIANT === 'boss-rush' ? 22 : 48;
        enemy.sprite.setPosition(enemy.sprite.x + (dx / distance) * speed * deltaMs / 1000, enemy.sprite.y + (dy / distance) * speed * deltaMs / 1000);
      }
    }

    function contactDamage(): void {
      if (elapsedMs - lastHitMs < 650) return;
      const target = nearestEnemy(34);
      if (!target || VARIANT === 'stealth-game' || VARIANT === 'heist-game') return;
      playerHealth -= 1;
      lastHitMs = elapsedMs;
      presentation.flash();
      if (playerHealth <= 0) outcome = 'failed';
    }

    function updateSpecialStates(deltaMs: number): void {
      if (VARIANT === 'survivor-like') {
        autoAttackMs -= deltaMs;
        if (autoAttackMs <= 0) {
          const target = nearestEnemy(210);
          if (target) damageEnemy(target, attackDamage);
          autoAttackMs = 450;
        }
        if (!upgradeSprite && elapsedMs >= 7000) {
          upgradeSprite = scene.add.sprite(width / 2, height / 2, context.assets.resolve('pickup')).setDisplaySize(26, 26);
          decorative.push(upgradeSprite);
        }
        if (elapsedMs >= 15000 && playerHealth > 0) outcome = 'victory';
      }

      if (VARIANT === 'action-roguelite' && livingEnemies().length === 0 && !upgradeSprite) {
        upgradeSprite = scene.add.sprite(width / 2, height / 2, context.assets.resolve('pickup')).setDisplaySize(26, 26);
        decorative.push(upgradeSprite);
      }

      if (VARIANT === 'arena-combat' && livingEnemies().length === 0) outcome = 'victory';

      if (VARIANT === 'boss-rush') {
        const boss = livingEnemies()[0];
        if (!boss && bossPhase === 1) {
          bossPhase = 2;
          const next = spawnEnemy(720, 220, 8);
          next.sprite.setTint(0xff8877);
        } else if (!boss && bossPhase === 2) {
          bossPhase = 3;
          outcome = 'victory';
        }
      }
    }

    function renderStatus(): void {
      status.setText(
        VARIANT + ' | HP ' + playerHealth + ' | enemies ' + livingEnemies().length +
        (objectiveCollected ? ' | objective ✓' : '') +
        (alarm ? ' | ALARM' : '') +
        (upgradeCollected ? ' | upgrade ✓' : '') +
        (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''),
      );
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'top-down-action',
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerTextureKey: player.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      objectiveCollected,
      upgradeCollected,
      attackDamage,
      alarm,
      guardSeesPlayer,
      outcome,
      playerHealth,
      enemiesRemaining: livingEnemies().length,
      spawnedTotal,
      bossPhase,
      bossHealth: livingEnemies()[0]?.health ?? 0,
      runResets,
      lastAction,
      elapsedMs: Math.round(elapsedMs),
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;
        const intent = topDownController.read(context.input);
        if (outcome === 'playing') {
          player.setVelocity(intent.moveX * MOVE_SPEED, intent.moveY * MOVE_SPEED);
          if (intent.primaryPressed && VARIANT !== 'stealth-game' && VARIANT !== 'heist-game') attack();
          if (intent.interactPressed || intent.primaryPressed) collectNearby();
          collectNearby();
          updateGuard();
          updateEnemyPressure(deltaMs);
          contactDamage();
          updateSpecialStates(deltaMs);
        } else {
          player.setVelocity(0, 0);
          if (VARIANT === 'action-roguelite' && intent.secondaryPressed) resetRun();
        }
        presentation.update(deltaMs, true);
        renderStatus();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        presentation.dispose();
        try {
          background?.destroy();
          player.destroy();
          status.destroy();
          for (const enemy of enemies) enemy.sprite.destroy();
          for (const object of decorative) object.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

export function topDownStarterKit(variant: TopDownStarterVariant) {
  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-top-down-starter',
    shellSource: shellSource(variant),
    level: {
      entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 120, y: 270, width: 0, height: 0, properties: [] }],
    },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
