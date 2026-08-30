import {
  ECONOMY_CAPABILITY_ID,
  PRODUCTION_CAPABILITY_ID,
  WALL_CLOCK_CAPABILITY_ID,
  type EconomyService,
  type InstalledSystemPack,
  type ManualWallClock,
  type OfflineReport,
  type PrestigeResult,
  type ProductionService,
  type ProductionStartResult,
  type VersionedRecord,
} from '@sw2d/contracts';
import { accentStyle, mutedStyle, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ProgressionService, type SimulationService } from '@sw2d/packs';

/**
 * Proof E - idle-incremental (Phase 10 deep proof, see ../PROOF_CONTRACT.md).
 *
 * No canvas movement required - a text-only ui-simulation scene, matching
 * the preset's controllerFamilies (`['ui-simulation']`). Persistence uses
 * `context.saves` (SaveStore), a real, already-existing runtime capability.
 *
 * ## Post-ten Phase 19
 *
 * The Phase-10 journey above is unchanged: the same gold ledger, the same job
 * primitive, the same upgrade, the same save/reload equality bar. Phase 19 adds
 * a second, independent surface on top - a smelting chain, a bounded offline
 * catch-up and a prestige - because the preset's honest limitation was that
 * offline progress and prestige *were not systems*, and the way to retire that
 * claim is to make the same game use the real ones.
 *
 * The economy's frame advancement belongs to `sw2d.economy`. This shell reads
 * it and reports it; it never steps it.
 */

const SAVE_SLOT = 'idle-incremental-progress';
const SAVE_SCHEMA_VERSION = 1;
const PRODUCTION_RATE_PER_SEC = 2;
const JOB_ID = 'gather';
const JOB_DURATION_MS = 500;
const JOB_BONUS = 10;
const UPGRADE_COST = 20;
const UPGRADE_MULTIPLIER = 2;

interface SaveData extends VersionedRecord {
  readonly gold: number;
  readonly currency: number;
  readonly rateMultiplier: number;
  readonly jobsCompleted: number;
}

function createDefault(): SaveData {
  return { schemaVersion: SAVE_SCHEMA_VERSION, gold: 0, currency: 0, rateMultiplier: 1, jobsCompleted: 0 };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.ui-simulation-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.simulation, CAPABILITY_IDS.progression],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const simulation = context.capabilities.require<SimulationService>(CAPABILITY_IDS.simulation);
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
    const economy = context.capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    const production = context.capabilities.require<ProductionService>(PRODUCTION_CAPABILITY_ID);
    // The same clock `src/main.ts` handed to `createGame`, so moving it here
    // moves the one the economy stamps its save with.
    const wallClock = context.capabilities.require<ManualWallClock>(WALL_CLOCK_CAPABILITY_ID);
    let lastOffline: OfflineReport | null = null;
    const completedRecipes: string[] = [];

    const loadResult = context.saves.load<SaveData>(SAVE_SLOT, { currentVersion: SAVE_SCHEMA_VERSION, createDefault });
    const restored = loadResult.value;
    if (restored.gold > 0) simulation.addResource('gold', restored.gold);
    if (restored.currency > 0) progression.addCurrency(restored.currency);
    let rateMultiplier = restored.rateMultiplier;
    let jobsCompleted = restored.jobsCompleted;
    let lastSaveOutcome = loadResult.outcome;

    const label = scene.add
      .text(width * 0.5, height * 0.4, '', mutedStyle(20))
      .setOrigin(0.5)
      .setScrollFactor(0);
    const hint = scene.add
      .text(width * 0.5, height * 0.6, 'PRIMARY: gather | SECONDARY: upgrade | CONFIRM: save', accentStyle(14))
      .setOrigin(0.5)
      .setScrollFactor(0);

    function render(): void {
      label.setText(`Gold: ${simulation.resource('gold').toFixed(1)} | Currency: ${progression.currency()} | Rate x${rateMultiplier}`);
    }
    render();

    let jobActive = false;

    function tryQueueJob(): void {
      if (jobActive) return;
      simulation.queueJob(JOB_ID, JOB_DURATION_MS);
      jobActive = true;
    }

    function tryBuyUpgrade(): void {
      if (rateMultiplier > 1) return; // one upgrade tier - a deeper tree is exactly the "large economy balancing" this preset defers
      if (progression.currency() < UPGRADE_COST) return;
      progression.addCurrency(-UPGRADE_COST);
      rateMultiplier = UPGRADE_MULTIPLIER;
    }

    function saveProgress(): void {
      context.saves.save<SaveData>(SAVE_SLOT, {
        schemaVersion: SAVE_SCHEMA_VERSION,
        gold: simulation.resource('gold'),
        currency: progression.currency(),
        rateMultiplier,
        jobsCompleted,
      });
      lastSaveOutcome = 'loaded';
    }

    /**
     * Phase 19 controls, provided as a capability so the proof can drive them.
     * Every one is a pass-through: the shell decides nothing about the economy.
     */
    const economyControls = {
      startSmelt: (): ProductionStartResult => production.start('smelt'),
      restockOre: (quantity?: number) => economy.restock('ore', quantity),
      /** Save now, claim to have been away for `ms`, and resume. */
      goOffline(ms: number): OfflineReport {
        economy.save();
        wallClock.advance(ms);
        lastOffline = economy.resume();
        return lastOffline;
      },
      prestige: (): PrestigeResult => economy.performPrestige(),
      resetEconomy(): void {
        economy.reset();
        completedRecipes.length = 0;
        lastOffline = null;
      },
    };
    const controlsHandle = context.capabilities.provide('game.idle-economy-controls', economyControls);

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => {
      for (const event of production.drainEvents()) {
        if (event.kind === 'job-completed') completedRecipes.push(event.recipeId);
      }
      return {
        gold: simulation.resource('gold'),
        currency: progression.currency(),
        rateMultiplier,
        jobsCompleted,
        jobPending: jobActive,
        loadOutcome: loadResult.outcome,
        lastSaveOutcome,
        // Phase 19 surface.
        ore: economy.stock('ore'),
        ingot: economy.stock('ingot'),
        economyJobs: production.jobs().length,
        completedRecipes: [...completedRecipes],
        prestige: economy.prestigeState(),
        lastOffline,
        wallClockMs: wallClock.now(),
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;

        // Deterministic passive production: pure function of elapsed
        // simulated time and the current rate multiplier, no RNG.
        simulation.addResource('gold', (PRODUCTION_RATE_PER_SEC * rateMultiplier * deltaMs) / 1000);

        if (jobActive && simulation.isJobComplete(JOB_ID)) {
          simulation.cancelJob(JOB_ID);
          simulation.addResource('gold', JOB_BONUS);
          progression.addCurrency(JOB_BONUS);
          jobsCompleted += 1;
          jobActive = false;
        }

        const intent = uiSimulationController.read(context.input);
        if (context.input.justPressed('PRIMARY_ACTION')) tryQueueJob();
        if (context.input.justPressed('SECONDARY_ACTION')) tryBuyUpgrade();
        if (intent.confirmPressed) saveProgress();

        render();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        controlsHandle.dispose();
        try {
          label.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          hint.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
