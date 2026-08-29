import type {
  GenerationService,
  InstalledSystemPack,
  NormalizedLevelObject,
  RunResetParticipant,
  RunService,
  RunState,
  RunsDocument,
  SaveLoadOutcome,
} from '@sw2d/contracts';
import {
  GENERATION_CAPABILITY_ID,
  RUNS_CAPABILITY_ID,
} from '@sw2d/contracts';
import type {
  CombatService,
  ProgressionService,
  ItemsService,
} from '@sw2d/packs';
import { CAPABILITY_IDS, RUNS_SAVE_SLOT_ACTIVE, RunServiceImpl } from '@sw2d/packs';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

export const ACTION_ROGUELITE_SHELL_CAPABILITY_ID = 'game.action-roguelite-shell';

/**
 * What the real `SaveStore` currently holds in the active-run slot.
 *
 * `outcome` is `SaveStore.load`'s own report - `'loaded'` only when a record
 * for this slot actually exists at the current schema version, `'default'` when
 * the slot is empty. That is why the resumability proof needs no `SaveStore.has()`:
 * the store already tells the caller whether it found anything.
 */
export interface SavedRunProbe {
  readonly outcome: SaveLoadOutcome;
  readonly record: {
    readonly runId: string;
    readonly phase: string;
    readonly attempt: number;
    readonly seed: number;
    readonly transientCurrency: number;
    readonly transientUpgrades: readonly string[];
    readonly runDurationMs: number;
    readonly stats: ActionRogueliteShellState['stats'];
  } | null;
}

export interface ActionRogueliteShellState {
  readonly runId: string;
  readonly phase: string;
  readonly attempt: number;
  readonly seed: number;
  readonly runDurationMs: number;
  readonly transientCurrency: number;
  readonly transientUpgrades: readonly string[];
  readonly stats: {
    readonly kills: number;
    readonly roomsCleared: number;
    readonly wavesCleared: number;
    readonly damageDealt: number;
    readonly damageTaken: number;
  };
  readonly metaCurrency: number;
  readonly metaXp: number;
  readonly metaUnlocks: readonly string[];
  readonly playerHp: number;
  readonly maxHp: number;
  readonly inventory: Readonly<Record<string, number>>;
  readonly currentRoom: string;
  readonly totalRooms: number;
  readonly attackBonus: number;
}

export interface ActionRogueliteShellService {
  state(): ActionRogueliteShellState;
  /** Read the live active-run save slot through the game's real SaveStore. */
  probeSavedRun(): SavedRunProbe;
  /**
   * Build a second `RunService` over the *same* SaveStore and content document
   * the installed one uses, and report the state it boots with. This is the
   * "relaunch the game" half of resumability: no private state is touched, the
   * new service only sees what was durably written.
   */
  rehydrateRunService(): RunState;
  startRun(): void;
  collectCurrency(amount: number): void;
  collectItem(itemId: string, quantity?: number): void;
  clearRoom(): void;
  dealDamage(amount: number): void;
  takeDamage(amount: number): void;
  buyTransientUpgrade(upgradeId: string): boolean;
  buyPermanentUpgrade(upgradeId: string): boolean;
  die(): void;
  reachObjective(): void;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.action-roguelite-shell',
  version: '0.1.0',
  provides: [ACTION_ROGUELITE_SHELL_CAPABILITY_ID],
  dependencies: [
    CAPABILITY_IDS.combat,
    CAPABILITY_IDS.progression,
    GENERATION_CAPABILITY_ID,
    CAPABILITY_IDS.items,
    RUNS_CAPABILITY_ID,
  ],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
    const generation = context.capabilities.require<GenerationService>(GENERATION_CAPABILITY_ID);
    const items = context.capabilities.require<ItemsService>(CAPABILITY_IDS.items);
    const runs = context.capabilities.require<RunService>(RUNS_CAPABILITY_ID);

    const playerId = 'player';
    const playerKey = context.assets.resolve('player');
    const wallKey = context.assets.resolve('platform');

    // Generate room graph
    const genResult = generation.generate('main');
    const totalRooms = genResult.manifest.graph.nodes.length;
    let currentRoomIndex = 0;

    // Permanent meta bonus check
    const baseHp = progression.isUnlocked('meta-health-boost') ? 120 : 100;
    combat.register(playerId, baseHp);

    // Build visual scene
    const walls = scene.physics.add.staticGroup();
    for (const solid of genResult.output.solids) {
      const w = scene.add.image(solid.x + solid.width / 2, solid.y + solid.height / 2, wallKey);
      w.setDisplaySize(solid.width, solid.height);
      walls.add(w);
    }

    const playerSpawn = genResult.output.objects.find((o: NormalizedLevelObject) => o.class === 'PlayerSpawn');
    const px = playerSpawn?.x ?? 160;
    const py = playerSpawn?.y ?? 120;

    const playerSprite = scene.physics.add.sprite(px, py, playerKey);
    playerSprite.setCollideWorldBounds(true);
    scene.physics.add.collider(playerSprite, walls);

    // Automatic start run if idle
    if (runs.state().phase === 'idle') {
      runs.startRun();
    }

    // Reset participant registration
    const resetParticipant: RunResetParticipant = {
      id: 'action-roguelite-shell-reset',
      onRunReset: (_state: RunState, _nextSeed: number) => {
        currentRoomIndex = 0;
        const max = progression.isUnlocked('meta-health-boost') ? 120 : 100;
        combat.remove(playerId);
        combat.register(playerId, max);
      },
    };
    const participantHandle = runs.registerResetParticipant(resetParticipant);

    const shellService: ActionRogueliteShellService = {
      state(): ActionRogueliteShellState {
        const rState = runs.state();
        const pHealth = combat.get(playerId);
        const hasAttackBuff = rState.transientUpgrades.includes('transient-attack-buff');
        const currentHpMax = progression.isUnlocked('meta-health-boost') ? 120 : 100;

        return {
          runId: rState.runId,
          phase: rState.phase,
          attempt: rState.attempt,
          seed: rState.seed,
          runDurationMs: rState.runDurationMs,
          transientCurrency: rState.transientCurrency,
          transientUpgrades: rState.transientUpgrades,
          stats: rState.stats,
          metaCurrency: progression.currency(),
          metaXp: progression.xp(),
          metaUnlocks: progression.unlockedFlags(),
          playerHp: pHealth.current,
          maxHp: currentHpMax,
          inventory: items.inventory(),
          currentRoom: genResult.manifest.graph.nodes[currentRoomIndex] ?? 'r0',
          totalRooms,
          attackBonus: hasAttackBuff ? 5 : 0,
        };
      },

      probeSavedRun(): SavedRunProbe {
        const result = context.saves.load<{ schemaVersion: number }>(RUNS_SAVE_SLOT_ACTIVE, {
          currentVersion: 1,
          createDefault: () => ({ schemaVersion: 1, __absent: true }) as { schemaVersion: number },
        });
        if (result.outcome !== 'loaded') return { outcome: result.outcome, record: null };
        return {
          outcome: result.outcome,
          record: result.value as unknown as NonNullable<SavedRunProbe['record']>,
        };
      },

      rehydrateRunService(): RunState {
        const doc = context.content.data['runs']?.value as RunsDocument | undefined;
        const rehydrated = new RunServiceImpl(
          context.events,
          context.capabilities,
          doc,
          context.saves,
          undefined,
        );
        return rehydrated.state();
      },

      startRun(): void {
        if (runs.state().phase === 'idle') {
          runs.startRun();
        }
      },

      collectCurrency(amount: number): void {
        runs.addTransientCurrency(amount);
      },

      collectItem(itemId: string, quantity = 1): void {
        items.grant(itemId, quantity);
      },

      clearRoom(): void {
        runs.recordRoomCleared();
        if (currentRoomIndex < totalRooms - 1) {
          currentRoomIndex++;
        }
      },

      dealDamage(amount: number): void {
        runs.recordDamage(amount, 0);
        runs.recordKill();
      },

      takeDamage(amount: number): void {
        runs.recordDamage(0, amount);
        const health = combat.damage(playerId, amount, 0);
        if (health.current <= 0) {
          runs.loseRun();
        }
      },

      buyTransientUpgrade(upgradeId: string): boolean {
        return runs.purchaseUpgrade(upgradeId);
      },

      buyPermanentUpgrade(upgradeId: string): boolean {
        const ok = runs.purchaseUpgrade(upgradeId);
        if (ok && upgradeId === 'perm-health-meta') {
          combat.remove(playerId);
          combat.register(playerId, 120);
        }
        return ok;
      },

      die(): void {
        this.takeDamage(999);
      },

      reachObjective(): void {
        runs.winRun();
      },

      reset(): void {
        runs.resetRun();
        // Auto-start the next attempt immediately (same as initial boot logic)
        if (runs.state().phase === 'idle') {
          runs.startRun();
        }
      },
    };

    const handle = context.capabilities.provide(ACTION_ROGUELITE_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(ACTION_ROGUELITE_SHELL_CAPABILITY_ID, () => shellService.state());

    return {
      id: 'game.action-roguelite-shell',
      update(): void {
        const intent = topDownController.read(context.input);
        playerSprite.setVelocityX(intent.moveX * 220);
        playerSprite.setVelocityY(intent.moveY * 220);
        runs.state();
      },
      dispose(): void {
        debugHandle.dispose();
        participantHandle.dispose();
        handle.dispose();
        playerSprite.destroy();
        walls.clear(true, true);
      },
    };
  },
};
