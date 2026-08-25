import { describe, expect, it } from 'vitest';
import { validateBySchemaId } from '@sw2d/schemas';
import type { ArcadeService } from '../src/arcade/arcadePack.ts';
import { ARCADE_CONFIG_SCHEMA_ID, arcadePack } from '../src/arcade/arcadePack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('arcadePack', () => {
  it('installs with defaults (3 lives, 800ms combo window)', () => {
    const context = createFakeGameContext();
    const installed = arcadePack.install(context, {});
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    expect(arcade.score()).toBe(0);
    expect(arcade.lives()).toBe(3);
    expect(arcade.round()).toBe(1);
    expect(installed.id).toBe('sw2d.arcade');
  });

  it('honours startingLives config and clamps loseLife at 0', () => {
    const context = createFakeGameContext();
    arcadePack.install(context, { startingLives: 1 });
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    expect(arcade.loseLife()).toBe(0);
    expect(arcade.loseLife()).toBe(0);
  });

  it('addScore accumulates and emits arcade:scoreChanged', () => {
    const context = createFakeGameContext();
    arcadePack.install(context, {});
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    const changes: unknown[] = [];
    context.events.on('arcade:scoreChanged', (payload) => changes.push(payload));

    expect(arcade.addScore(100)).toBe(100);
    expect(arcade.addScore(50)).toBe(150);
    expect(changes).toEqual([
      { score: 100, delta: 100 },
      { score: 150, delta: 50 },
    ]);
  });

  it('registerHit builds combo within the window and resets outside it - deterministic given nowMs', () => {
    const context = createFakeGameContext();
    arcadePack.install(context, { comboWindowMs: 500 });
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    expect(arcade.registerHit(0)).toBe(1);
    expect(arcade.registerHit(400)).toBe(2); // within 500ms
    expect(arcade.registerHit(1200)).toBe(1); // outside the window: resets
  });

  it('resetCombo clears combo and the hit-timing memory', () => {
    const context = createFakeGameContext();
    arcadePack.install(context, { comboWindowMs: 500 });
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');
    arcade.registerHit(0);
    arcade.registerHit(100);
    expect(arcade.combo()).toBe(2);

    arcade.resetCombo();
    expect(arcade.combo()).toBe(0);
    expect(arcade.registerHit(150)).toBe(1); // treated as a fresh hit
  });

  it('nextRound increments deterministically', () => {
    const context = createFakeGameContext();
    arcadePack.install(context, {});
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    expect(arcade.nextRound()).toBe(2);
    expect(arcade.nextRound()).toBe(3);
  });

  it('elapsedMs accumulates only through update(deltaMs) - deterministic, no wall-clock read', () => {
    const context = createFakeGameContext();
    const installed = arcadePack.install(context, {});
    const arcade = context.capabilities.require<ArcadeService>('arcade.score');

    expect(arcade.elapsedMs()).toBe(0);
    installed.update?.(16.6667);
    installed.update?.(16.6667);
    expect(arcade.elapsedMs()).toBeCloseTo(33.3334, 4);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = arcadePack.install(context, {});

    installed.dispose();

    expect(context.capabilities.has('arcade.score')).toBe(false);
  });

  describe('config schema', () => {
    it('rejects a non-positive comboWindowMs', () => {
      const result = validateBySchemaId(ARCADE_CONFIG_SCHEMA_ID, 'test-config', { comboWindowMs: 0 });
      expect(result.valid).toBe(false);
    });

    it('accepts a well-formed config', () => {
      const result = validateBySchemaId(ARCADE_CONFIG_SCHEMA_ID, 'test-config', {
        startingLives: 5,
        comboWindowMs: 600,
      });
      expect(result.valid).toBe(true);
    });
  });
});
