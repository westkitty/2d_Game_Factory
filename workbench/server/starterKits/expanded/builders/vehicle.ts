import { defineExpandedKit } from './common.ts';

export type VehicleStarterVariant =
  | 'top-down-racer'
  | 'kart-racer'
  | 'time-trial-racer'
  | 'endless-driving'
  | 'boat-flight-racer';

function shellSource(variant: VehicleStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { vehicleController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const BASE_ACCEL = 125;
const BRAKE_ACCEL = 190;
const TURN_RATE = 2.35;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-vehicle-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const racer = scene.add.sprite(110, height / 2, context.assets.resolve('player')).setDepth(2);
    racer.setScale(44 / racer.height);

    const checkpoints = [
      { x: 300, y: 270 },
      { x: 520, y: 270 },
      { x: 735, y: 270 },
    ];
    const checkpointSprites = checkpoints.map((point, index) =>
      scene.add.sprite(point.x, point.y, context.assets.resolve('checkpoint')).setDisplaySize(24, 90).setAlpha(index === 0 ? 0.95 : 0.55),
    );
    const finish = scene.add.sprite(895, 270, context.assets.resolve('exit')).setDisplaySize(30, 110);
    const pickup = VARIANT === 'kart-racer'
      ? scene.add.sprite(420, 210, context.assets.resolve('pickup')).setDisplaySize(26, 26)
      : null;
    const hazard = (VARIANT === 'endless-driving' || VARIANT === 'boat-flight-racer')
      ? scene.add.sprite(650, 360, context.assets.resolve('hazard')).setDisplaySize(48, 48)
      : null;
    const particleTextureKey = (VARIANT === 'kart-racer' || VARIANT === 'boat-flight-racer')
      ? (context.assets.has('particle') ? context.assets.resolve('particle') : context.assets.resolve('checkpoint'))
      : null;
    const particleMarker = particleTextureKey
      ? scene.add.sprite(racer.x, racer.y, particleTextureKey).setDisplaySize(58, 58).setAlpha(VARIANT === 'boat-flight-racer' ? 0.32 : 0).setDepth(1)
      : null;

    const status = scene.add.text(18, 16, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '15px', color: '#ffffff', backgroundColor: '#111827aa', padding: { x: 8, y: 5 },
    }).setDepth(50);

    let heading = 0;
    let speed = 0;
    let altitude = VARIANT === 'boat-flight-racer' ? 0.5 : 0;
    let elapsedMs = 0;
    let checkpointIndex = 0;
    let finishTimeMs: number | null = null;
    let targetBeaten: boolean | null = null;
    let pickupCollected = false;
    let boostRemainingMs = 0;
    let collisions = 0;
    let distanceScore = 0;
    let particleEffects = 0;
    let outcome: 'racing' | 'finished' | 'crashed' = 'racing';
    let lastCheckpointAttempt = -1;

    function near(x: number, y: number, radius = 50): boolean {
      return Phaser.Math.Distance.Between(racer.x, racer.y, x, y) <= radius;
    }

    function refreshParticleMarker(): void {
      if (!particleMarker) return;
      particleMarker.setPosition(racer.x, racer.y);
      if (VARIANT === 'kart-racer') {
        particleMarker.setAlpha(boostRemainingMs > 0 ? 0.52 : 0);
        particleMarker.setDisplaySize(boostRemainingMs > 0 ? 64 : 58, boostRemainingMs > 0 ? 64 : 58);
      } else {
        particleMarker.setAlpha(0.16 + altitude * 0.38);
        particleMarker.setDisplaySize(46 + altitude * 28, 46 + altitude * 28);
      }
    }

    function recordParticleEffect(): void {
      if (!particleMarker) return;
      particleEffects += 1;
      refreshParticleMarker();
    }

    function checkCheckpoints(): void {
      if (checkpointIndex < checkpoints.length) {
        const expected = checkpoints[checkpointIndex]!;
        if (near(expected.x, expected.y, 55)) {
          lastCheckpointAttempt = checkpointIndex;
          checkpointIndex += 1;
          checkpointSprites.forEach((sprite, index) => sprite.setAlpha(index === checkpointIndex ? 0.95 : index < checkpointIndex ? 0.25 : 0.55));
        }
      }
      if (checkpointIndex === checkpoints.length && near(finish.x, finish.y, 60) && outcome === 'racing') {
        outcome = 'finished';
        finishTimeMs = Math.round(elapsedMs);
        if (VARIANT === 'time-trial-racer') targetBeaten = finishTimeMs <= 12000;
      }
    }

    function checkPickup(): void {
      if (!pickup || pickupCollected || !near(pickup.x, pickup.y, 38)) return;
      pickupCollected = true;
      pickup.setVisible(false);
      boostRemainingMs = 3000;
      recordParticleEffect();
    }

    function checkHazard(): void {
      if (!hazard || !near(hazard.x, hazard.y, 42)) return;
      if (VARIANT === 'boat-flight-racer' && altitude > 0.65) return;
      collisions += 1;
      speed *= 0.25;
      racer.setPosition(Math.max(80, racer.x - 60), Math.max(60, racer.y - 50));
      if (VARIANT === 'boat-flight-racer') recordParticleEffect();
      if (VARIANT === 'endless-driving' && collisions >= 2) outcome = 'crashed';
    }

    function render(): void {
      status.setText(
        VARIANT + ' | speed ' + Math.round(speed) + ' | gate ' + checkpointIndex + '/' + checkpoints.length +
        (VARIANT === 'boat-flight-racer' ? ' | altitude ' + altitude.toFixed(2) : '') +
        (VARIANT === 'endless-driving' ? ' | distance ' + Math.floor(distanceScore) : '') +
        (pickupCollected ? ' | boost ✓' : '') +
        (outcome !== 'racing' ? ' | ' + outcome.toUpperCase() : ''),
      );
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'vehicle-movement',
      x: Math.round(racer.x), y: Math.round(racer.y),
      playerTextureKey: racer.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      particleTextureKey,
      particleVisible: particleMarker ? particleMarker.alpha > 0.01 : false,
      particleEffects,
      heading,
      speed: Math.round(speed),
      checkpointIndex,
      lastCheckpointAttempt,
      finishTimeMs,
      targetBeaten,
      pickupCollected,
      boostRemainingMs: Math.round(boostRemainingMs),
      altitude,
      collisions,
      distanceScore: Math.floor(distanceScore),
      outcome,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'racing') return;
        elapsedMs += deltaMs;
        const intent = vehicleController.read(context.input);

        if (VARIANT === 'endless-driving') {
          speed = Math.max(speed, 150);
          speed += intent.throttle * 35 * deltaMs / 1000;
          heading = Phaser.Math.Clamp(heading + intent.steering * 0.9 * deltaMs / 1000, -0.7, 0.7);
          racer.y = Phaser.Math.Clamp(racer.y + Math.sin(heading) * speed * deltaMs / 1000, 75, height - 75);
          distanceScore += speed * deltaMs / 1000;
          if (hazard) {
            hazard.x -= speed * deltaMs / 1000;
            if (hazard.x < -40) {
              hazard.x = width + 80;
              hazard.y = 120 + (Math.floor(distanceScore / 400) % 4) * 90;
            }
          }
        } else {
          heading += intent.steering * TURN_RATE * deltaMs / 1000;
          speed += (intent.throttle * BASE_ACCEL - intent.brake * BRAKE_ACCEL) * deltaMs / 1000;
          boostRemainingMs = Math.max(0, boostRemainingMs - deltaMs);
          const maxSpeed = boostRemainingMs > 0 || intent.boostHeld ? 270 : 190;
          speed = Phaser.Math.Clamp(speed, -55, maxSpeed);
          speed *= Math.pow(0.992, deltaMs / 16.667);
          racer.x = Phaser.Math.Clamp(racer.x + Math.cos(heading) * speed * deltaMs / 1000, 24, width - 24);
          racer.y = Phaser.Math.Clamp(racer.y + Math.sin(heading) * speed * deltaMs / 1000, 40, height - 40);
          racer.setRotation(heading);
        }

        if (VARIANT === 'boat-flight-racer') {
          if (intent.secondaryPressed) {
            altitude += 0.22;
            recordParticleEffect();
          }
          if (intent.brake > 0) altitude -= 0.35 * deltaMs / 1000;
          altitude = Phaser.Math.Clamp(altitude, 0, 1);
          racer.setScale((44 / racer.height) * (0.85 + altitude * 0.3));
        }

        checkPickup();
        checkHazard();
        if (VARIANT !== 'endless-driving') checkCheckpoints();
        refreshParticleMarker();
        render();
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy(); racer.destroy(); finish.destroy(); status.destroy(); pickup?.destroy(); hazard?.destroy(); particleMarker?.destroy();
          for (const sprite of checkpointSprites) sprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

export function vehicleStarterKit(variant: VehicleStarterVariant) {
  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-vehicle-starter',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 110, y: 270, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  });
}
