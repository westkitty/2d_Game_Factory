import { describe, expect, it, vi } from 'vitest';
import type { GameContext, SystemPackDefinition, SystemPackSelection } from '@sw2d/contracts';
import {
  aiPack,
  arcadePack,
  combatPack,
  narrativePack,
  progressionPack,
  puzzlePack,
  simulationPack,
  strategyPack,
  worldPack,
  type AiService,
  type ArcadeService,
  type CombatService,
  type NarrativeService,
  type ProgressionService,
  type PuzzleService,
  type SimulationService,
  type StrategyService,
  type WorldService,
} from '@sw2d/packs';
import { packConfigValidator } from '@sw2d/schemas';
import { CapabilityRegistryImpl } from '../src/core/CapabilityRegistryImpl.ts';
import { EventBusImpl } from '../src/core/EventBusImpl.ts';
import { SystemHostImpl } from '../src/core/SystemHostImpl.ts';

/**
 * The Phase 4 composition proof: the real SystemHostImpl, resolveInstallOrder
 * (exercised internally by SystemHostImpl.install()) and CapabilityRegistryImpl
 * install every Phase 4 pack family together, exactly as a game's PlayScene
 * would. No pack here is a fake - these are the actual @sw2d/packs
 * definitions.
 */

function createContext(): GameContext & { events: EventBusImpl; capabilities: CapabilityRegistryImpl } {
  const events = new EventBusImpl();
  const capabilities = new CapabilityRegistryImpl();
  return { events, capabilities } as unknown as GameContext & {
    events: EventBusImpl;
    capabilities: CapabilityRegistryImpl;
  };
}

const ALL_NINE_PACKS: readonly SystemPackDefinition<never, GameContext>[] = [
  combatPack,
  aiPack,
  worldPack,
  progressionPack,
  arcadePack,
  puzzlePack,
  simulationPack,
  narrativePack,
  strategyPack,
];

/**
 * `sw2d.puzzle` declares `configSource: 'code'`, so its config travels through
 * the composition root's `packConfig` map, never through a selection's JSON
 * `config`. Phase 9 (Gate B) made that explicit after finding that every
 * generated game selecting this pack crashed on install with `config: {}`.
 */
const PACK_CONFIG: Readonly<Record<string, unknown>> = {
  [puzzlePack.id]: {
    createInitialState: () => ({ moves: 0 }),
    isSolved: (state: { moves: number }) => state.moves >= 3,
  },
};

const ALL_NINE_SELECTIONS: readonly SystemPackSelection[] = [
  { packId: combatPack.id },
  { packId: aiPack.id }, // depends on combat - must resolve after it
  { packId: worldPack.id },
  { packId: progressionPack.id, config: { startingCurrency: 20, startingXp: 0 } },
  { packId: arcadePack.id, config: { startingLives: 3 } },
  { packId: puzzlePack.id, config: {} }, // JSON config is ignored for a code-configured pack - see PACK_CONFIG
  { packId: simulationPack.id },
  { packId: narrativePack.id },
  { packId: strategyPack.id },
];

describe('Phase 4 pack composition (real SystemHostImpl + resolveInstallOrder + CapabilityRegistryImpl)', () => {
  it('installs all nine families, publishes every capability, and every pack API operates', () => {
    const context = createContext();
    const host = new SystemHostImpl(context, ALL_NINE_PACKS, undefined, PACK_CONFIG);

    host.install(ALL_NINE_SELECTIONS);

    // Sorted by CapabilityRegistryImpl.list(). Every id is namespaced
    // `<family>.<service>` per ADR-0011.
    const expectedCapabilities = [
      'ai.state',
      'arcade.score',
      'combat.health',
      'narrative.state',
      'progression.state',
      'puzzle.state',
      'simulation.resources',
      'strategy.turns',
      'world.state',
    ];
    expect(context.capabilities.list()).toEqual(expectedCapabilities);
    expect(host.installed.map((pack) => pack.id).sort()).toEqual(
      [
        combatPack.id,
        aiPack.id,
        worldPack.id,
        progressionPack.id,
        arcadePack.id,
        puzzlePack.id,
        simulationPack.id,
        narrativePack.id,
        strategyPack.id,
      ].sort(),
    );

    // Exercise a real cross-pack interaction: AI's isAgentAlive reads combat
    // by capability id, both installed through the same real host.
    const combat = context.capabilities.require<CombatService>('combat.health');
    const ai = context.capabilities.require<AiService>('ai.state');
    combat.register('goblin', 5);
    ai.register('goblin');
    expect(ai.isAgentAlive('goblin')).toBe(true);
    combat.damage('goblin', 5, 0);
    expect(ai.isAgentAlive('goblin')).toBe(false);

    // Spot-check one API per remaining family.
    context.capabilities.require<WorldService>('world.state').setFlag('intro-seen', true);
    expect(context.capabilities.require<WorldService>('world.state').hasFlag('intro-seen')).toBe(true);

    expect(context.capabilities.require<ProgressionService>('progression.state').currency()).toBe(20);
    expect(context.capabilities.require<ArcadeService>('arcade.score').lives()).toBe(3);
    expect(context.capabilities.require<PuzzleService>('puzzle.state').isSolved()).toBe(false);
    expect(context.capabilities.require<SimulationService>('simulation.resources').resource('wood')).toBe(0);
    context.capabilities.require<NarrativeService>('narrative.state').goTo('intro');
    expect(context.capabilities.require<NarrativeService>('narrative.state').currentNode()).toBe('intro');
    context.capabilities.require<StrategyService>('strategy.turns').registerTeam('red');
    expect(context.capabilities.require<StrategyService>('strategy.turns').activeTeam()).toBeNull();

    // update(deltaMs) reaches every pack that declared one (arcade, simulation).
    host.update(16.6667);
    expect(context.capabilities.require<ArcadeService>('arcade.score').elapsedMs()).toBeCloseTo(16.6667, 4);

    host.dispose();

    expect(context.capabilities.list()).toEqual([]);
    expect(host.installed).toEqual([]);
  });

  it('installs a real dependency (ai -> combat) in a correct, deterministic order', () => {
    const context = createContext();
    const host = new SystemHostImpl(context, [combatPack, aiPack]);

    // Selection order is reversed from dependency order; resolveInstallOrder
    // must still install combat before ai regardless.
    host.install([{ packId: aiPack.id }, { packId: combatPack.id }]);

    expect(host.installed.map((pack) => pack.id)).toEqual([combatPack.id, aiPack.id]);
  });

  it('fails with a missing-dependency error when combat is not selected', () => {
    const context = createContext();
    const host = new SystemHostImpl(context, [combatPack, aiPack]);

    expect(() => host.install([{ packId: aiPack.id }])).toThrow(/combat/);
    // Nothing partially installed.
    expect(context.capabilities.list()).toEqual([]);
  });

  it('rejects a pack that declares a capability it never publishes, and rolls back', () => {
    const context = createContext();
    const liarPack: SystemPackDefinition<never, GameContext> = {
      id: 'test.declares-but-never-publishes',
      version: '0.0.0',
      provides: ['test.phantom'],
      dependencies: [],
      install: () => ({ id: 'test.declares-but-never-publishes', dispose: () => undefined }),
    };
    const host = new SystemHostImpl(context, [combatPack, liarPack]);

    expect(() =>
      host.install([{ packId: combatPack.id }, { packId: 'test.declares-but-never-publishes' }]),
    ).toThrow(/did not publish it/);

    // resolveInstallOrder would have satisfied a dependent pack's
    // `dependencies: ['test.phantom']` from that declaration, so this has to
    // fail at install rather than at the dependent pack's require().
    expect(context.capabilities.has('combat.health')).toBe(false);
    expect(host.installed).toEqual([]);
  });

  /**
   * The Phase 3 lesson, locked at the host level.
   *
   * A scene-shutdown teardown cannot assume Phaser's own systems are still
   * alive, so a pack's dispose() can legitimately throw mid-teardown. When it
   * does, every *other* pack must still tear down and every capability must
   * still be withdrawn - otherwise one bad teardown silently leaks the rest,
   * which is exactly the class of defect the flat-disposable-count evidence
   * could not see (PROJECT_BIBLE.md, Phase 3).
   */
  it('disposes every other pack and withdraws every capability when one pack dispose() throws', () => {
    const context = createContext();
    const throwingPack: SystemPackDefinition<never, GameContext> = {
      id: 'test.throwing-teardown',
      version: '0.0.0',
      provides: ['test.throwing'],
      dependencies: [],
      install: (context) => {
        const handle = context.capabilities.provide('test.throwing', {});
        return {
          id: 'test.throwing-teardown',
          dispose: () => {
            handle.dispose();
            throw new Error('teardown blew up mid-shutdown');
          },
        };
      },
    };
    const host = new SystemHostImpl(context, [combatPack, throwingPack, worldPack]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    host.install([
      { packId: combatPack.id },
      { packId: 'test.throwing-teardown' },
      { packId: worldPack.id },
    ]);
    expect(context.capabilities.list()).toHaveLength(3);

    expect(() => host.dispose()).not.toThrow();

    // Reverse order means world disposed before the thrower and combat after
    // it: both sides of the failure must have run.
    expect(context.capabilities.list()).toEqual([]);
    expect(host.installed).toEqual([]);
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining('test.throwing-teardown'),
      expect.any(Error),
    );
    errors.mockRestore();
  });

  it('fails with a duplicate-capability error when two real/fake packs both provide "combat.health"', () => {
    const context = createContext();
    const duplicateCombatPack: SystemPackDefinition<never, GameContext> = {
      id: 'test.duplicate-combat',
      version: '0.0.0',
      provides: ['combat.health'],
      dependencies: [],
      install: () => ({ id: 'test.duplicate-combat', dispose: () => undefined }),
    };
    const host = new SystemHostImpl(context, [combatPack, duplicateCombatPack]);

    expect(() =>
      host.install([{ packId: combatPack.id }, { packId: 'test.duplicate-combat' }]),
    ).toThrow(/combat\.health.*provided by both/s);
  });

  describe('configSchemaId enforcement (dependency-inverted validator)', () => {
    it('is unenforced without a validator: an out-of-range config installs silently', () => {
      const context = createContext();
      const host = new SystemHostImpl(context, [progressionPack]); // no validator

      expect(() =>
        host.install([{ packId: progressionPack.id, config: { startingCurrency: -5 } }]),
      ).not.toThrow();
      // The bad value made it all the way into the service, unvalidated.
      expect(context.capabilities.require<ProgressionService>('progression.state').currency()).toBe(-5);
    });

    it('is enforced with packConfigValidator: an out-of-range config is rejected before install', () => {
      const context = createContext();
      const host = new SystemHostImpl(context, [progressionPack], packConfigValidator);

      expect(() =>
        host.install([{ packId: progressionPack.id, config: { startingCurrency: -5 } }]),
      ).toThrow(/startingCurrency/);
      expect(context.capabilities.has('progression.state')).toBe(false);
    });

    it('accepts a valid config with the validator wired in', () => {
      const context = createContext();
      const host = new SystemHostImpl(context, [progressionPack], packConfigValidator);

      host.install([{ packId: progressionPack.id, config: { startingCurrency: 100 } }]);

      expect(context.capabilities.require<ProgressionService>('progression.state').currency()).toBe(100);
    });

    it('rolls back an already-installed pack when a later pack fails config validation', () => {
      const context = createContext();
      const host = new SystemHostImpl(context, [combatPack, progressionPack], packConfigValidator);

      expect(() =>
        host.install([
          { packId: combatPack.id },
          { packId: progressionPack.id, config: { startingCurrency: 'a lot' } },
        ]),
      ).toThrow();

      // combat installed successfully before progression's config failed -
      // the whole batch must roll back, not just the failing pack.
      expect(context.capabilities.list()).toEqual([]);
      expect(host.installed).toEqual([]);
    });

    it('leaves packs with no configSchemaId unaffected by the validator', () => {
      const context = createContext();
      const host = new SystemHostImpl(context, [worldPack], packConfigValidator);

      expect(() => host.install([{ packId: worldPack.id }])).not.toThrow();
      expect(context.capabilities.has('world.state')).toBe(true);
    });
  });
});

describe("code-configured packs (configSource: 'code')", () => {
  /**
   * The exact Gate B regression: a generated `content/game.json` writes
   * `config: {}` for every selected pack, which for `sw2d.puzzle` used to
   * reach `config.createInitialState()` and throw an opaque `TypeError` from
   * inside the pack, several frames after the real mistake. All six presets
   * requiring this pack shipped that way. The refusal now names the pack, the
   * reason and the fix.
   */
  it('refuses to install with a named, actionable error when no code config was supplied', () => {
    // A failed install rolls the host back and disposes it, so each assertion
    // needs its own host - the rollback itself is asserted elsewhere.
    const attempt = (): void => {
      const host = new SystemHostImpl(createContext(), ALL_NINE_PACKS);
      host.install([{ packId: puzzlePack.id, config: {} }]);
    };

    expect(attempt).toThrow(/sw2d\.puzzle/);
    expect(attempt).toThrow(/packConfig/);
    expect(attempt).toThrow(/code-configured/);
    // The old failure mode was an opaque TypeError from inside the pack itself.
    expect(attempt).not.toThrow(/createInitialState is not a function/);
  });

  it('installs and publishes its capability when the composition root supplies the config', () => {
    const context = createContext();
    const host = new SystemHostImpl(context, ALL_NINE_PACKS, undefined, PACK_CONFIG);

    host.install([{ packId: puzzlePack.id, config: {} }]);

    expect(context.capabilities.has('puzzle.state')).toBe(true);
    expect(context.capabilities.require<PuzzleService>('puzzle.state').isSolved()).toBe(false);
    host.dispose();
  });

  it("ignores a selection's JSON config entirely for a code-configured pack", () => {
    const context = createContext();
    const host = new SystemHostImpl(context, ALL_NINE_PACKS, undefined, PACK_CONFIG);

    // A JSON config that would be nonsense as a PuzzleConfig is simply not read.
    host.install([{ packId: puzzlePack.id, config: { createInitialState: 'not a function' } }]);

    expect(context.capabilities.require<PuzzleService>('puzzle.state').current()).toEqual({ moves: 0 });
    host.dispose();
  });
});
