import { describe, expect, it } from 'vitest';
import { validateBySchemaId } from '@sw2d/schemas';
import type { ProgressionService } from '../src/progression/progressionPack.ts';
import { PROGRESSION_CONFIG_SCHEMA_ID, progressionPack } from '../src/progression/progressionPack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('progressionPack', () => {
  it('installs and publishes the progression capability, defaulting to zero', () => {
    const context = createFakeGameContext();
    const installed = progressionPack.install(context, {});
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    expect(progression.currency()).toBe(0);
    expect(progression.xp()).toBe(0);
    expect(installed.id).toBe('sw2d.progression');
  });

  it('honours startingCurrency/startingXp config', () => {
    const context = createFakeGameContext();
    progressionPack.install(context, { startingCurrency: 50, startingXp: 10 });
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    expect(progression.currency()).toBe(50);
    expect(progression.xp()).toBe(10);
  });

  it('addCurrency clamps at 0 and emits progression:currencyChanged', () => {
    const context = createFakeGameContext();
    progressionPack.install(context, { startingCurrency: 10 });
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    const changes: unknown[] = [];
    context.events.on('progression:currencyChanged', (payload) => changes.push(payload));

    expect(progression.addCurrency(-5)).toBe(5);
    expect(progression.addCurrency(-100)).toBe(0);
    expect(changes).toEqual([
      { currency: 5, delta: -5 },
      { currency: 0, delta: -100 },
    ]);
  });

  it('addXp clamps at 0 without going negative', () => {
    const context = createFakeGameContext();
    progressionPack.install(context, {});
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    expect(progression.addXp(-10)).toBe(0);
    expect(progression.addXp(30)).toBe(30);
  });

  it('unlock() is idempotent and emits progression:unlockChanged only once', () => {
    const context = createFakeGameContext();
    progressionPack.install(context, {});
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    const changes: unknown[] = [];
    context.events.on('progression:unlockChanged', (payload) => changes.push(payload));

    expect(progression.isUnlocked('double-jump')).toBe(false);
    progression.unlock('double-jump');
    progression.unlock('double-jump');
    expect(progression.isUnlocked('double-jump')).toBe(true);
    expect(changes).toEqual([{ flag: 'double-jump', unlocked: true }]);
    expect(progression.unlockedFlags()).toEqual(['double-jump']);
  });

  it('tracks item counts, clamped at 0', () => {
    const context = createFakeGameContext();
    progressionPack.install(context, {});
    const progression = context.capabilities.require<ProgressionService>('progression.state');

    expect(progression.itemCount('potion')).toBe(0);
    expect(progression.addItem('potion', 3)).toBe(3);
    expect(progression.addItem('potion', -10)).toBe(0);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = progressionPack.install(context, {});

    installed.dispose();

    expect(context.capabilities.has('progression.state')).toBe(false);
  });

  describe('config schema', () => {
    it('is registered (by importing progressionPack) and accepts a valid config', () => {
      expect(PROGRESSION_CONFIG_SCHEMA_ID).toBe('urn:sw2d:schema:pack-progression-config:v1');
      const result = validateBySchemaId(PROGRESSION_CONFIG_SCHEMA_ID, 'test-config', {
        startingCurrency: 50,
        startingXp: 10,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a wrong-typed field with a located error', () => {
      const result = validateBySchemaId(PROGRESSION_CONFIG_SCHEMA_ID, 'test-config', {
        startingCurrency: 'a lot',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ instancePath: '/startingCurrency' });
    });

    it('rejects an unknown field (additionalProperties: false)', () => {
      const result = validateBySchemaId(PROGRESSION_CONFIG_SCHEMA_ID, 'test-config', {
        startingCurrency: 10,
        turboMode: true,
      });
      expect(result.valid).toBe(false);
    });

    it('accepts persist: true in config', () => {
      const result = validateBySchemaId(PROGRESSION_CONFIG_SCHEMA_ID, 'test-config', {
        persist: true,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('SaveStore persistence (Phase 13 requirement)', () => {
    class FakeSaveStore {
      readonly namespace = 'test';
      readonly store = new Map<string, unknown>();
      load<T extends { schemaVersion: number }>(slot: string, options: { currentVersion: number; createDefault: () => T }) {
        const stored = this.store.get(slot) as T | undefined;
        if (stored && stored.schemaVersion === options.currentVersion) {
          return { value: stored, outcome: 'loaded' as const };
        }
        return { value: options.createDefault(), outcome: 'default' as const };
      }
      save<T>(slot: string, value: T): void {
        this.store.set(slot, value);
      }
      clear(slot: string): void {
        this.store.delete(slot);
      }
    }

    it('default persist false does not save to SaveStore', () => {
      const saves = new FakeSaveStore();
      const context = { ...createFakeGameContext(), saves: saves as any };
      progressionPack.install(context, { startingCurrency: 10 });
      const progression = context.capabilities.require<ProgressionService>('progression.state');
      progression.addCurrency(50);
      expect(saves.store.has('progression')).toBe(false);
    });

    it('persist true saves currency, xp, unlocks, and item counts to SaveStore', () => {
      const saves = new FakeSaveStore();
      const context = { ...createFakeGameContext(), saves: saves as any };
      progressionPack.install(context, { startingCurrency: 10, persist: true });
      const progression = context.capabilities.require<ProgressionService>('progression.state');

      progression.addCurrency(25);
      progression.addXp(100);
      progression.unlock('meta-damage-boost');
      progression.addItem('meta-gem', 3);

      expect(saves.store.has('progression')).toBe(true);
      const saved = saves.store.get('progression') as any;
      expect(saved.currency).toBe(35);
      expect(saved.xp).toBe(100);
      expect(saved.unlockedFlags).toEqual(['meta-damage-boost']);
      expect(saved.itemCounts).toEqual({ 'meta-gem': 3 });
    });

    it('persist true reloads saved state on subsequent install', () => {
      const saves = new FakeSaveStore();
      const context1 = { ...createFakeGameContext(), saves: saves as any };
      const inst1 = progressionPack.install(context1, { persist: true });
      const prog1 = context1.capabilities.require<ProgressionService>('progression.state');
      prog1.addCurrency(150);
      prog1.unlock('perk-dash');
      inst1.dispose();

      const context2 = { ...createFakeGameContext(), saves: saves as any };
      progressionPack.install(context2, { persist: true });
      const prog2 = context2.capabilities.require<ProgressionService>('progression.state');

      expect(prog2.currency()).toBe(150);
      expect(prog2.isUnlocked('perk-dash')).toBe(true);
    });

    it('handles version mismatch by falling back to default', () => {
      const saves = new FakeSaveStore();
      saves.store.set('progression', { schemaVersion: 999, currency: 9999 });
      const context = { ...createFakeGameContext(), saves: saves as any };
      progressionPack.install(context, { startingCurrency: 5, persist: true });
      const progression = context.capabilities.require<ProgressionService>('progression.state');

      expect(progression.currency()).toBe(5);
    });
  });
});
