import type { InstalledSystemPack, VersionedRecord } from '@sw2d/contracts';
import { accentStyle, mutedStyle, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ProgressionService, type SimulationService } from '@sw2d/packs';

/**
 * Idle Incremental demo (Phase 8 representative demo 11/12).
 *
 * Smoke contract: deterministic production, job/queue action, one upgrade,
 * save/reload persistence. No canvas movement required - this is a
 * text-only ui-simulation scene, matching the preset's controllerFamilies
 * (`['ui-simulation']`) and its "no farms/shops/tycoon UI, resource ledger
 * plus a timed job primitive only" scope (packages/packs/src/simulation/
 * simulationPack.ts).
 *
 * Persistence uses `context.saves` (SaveStore, packages/contracts/src/
 * persistence.ts) - a real, already-existing runtime capability, not
 * something invented for this demo.
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
      if (rateMultiplier > 1) return; // one upgrade only, for this smoke demo
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

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({
      gold: simulation.resource('gold'),
      currency: progression.currency(),
      rateMultiplier,
      jobsCompleted,
      jobPending: jobActive,
      loadOutcome: loadResult.outcome,
      lastSaveOutcome,
    }));

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
