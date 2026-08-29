import type {
  InstalledSystemPack,
  RunResetParticipant,
  RunService,
  RunState,
} from '@sw2d/contracts';
import {
  RUNS_CAPABILITY_ID,
} from '@sw2d/contracts';
import type {
  CombatService,
  EncounterService,
  ProgressionService,
} from '@sw2d/packs';
import { CAPABILITY_IDS } from '@sw2d/packs';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

export const SURVIVOR_SHELL_CAPABILITY_ID = 'game.survivor-shell';

export interface SurvivorShellState {
  readonly phase: string;
  readonly attempt: number;
  readonly seed: number;
  readonly runDurationMs: number;
  readonly wave: number;
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
  readonly spawnedEnemies: number;
  readonly bulletSpeedBonus: number;
}

export interface SurvivorShellService {
  state(): SurvivorShellState;
  spawnWave(count: number): void;
  defeatEnemy(): void;
  advanceWave(): void;
  collectCurrency(amount: number): void;
  buyUpgrade(upgradeId: string): boolean;
  surviveToVictory(): void;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.survivor-shell',
  version: '0.1.0',
  provides: [SURVIVOR_SHELL_CAPABILITY_ID],
  dependencies: [
    CAPABILITY_IDS.combat,
    CAPABILITY_IDS.encounters,
    CAPABILITY_IDS.progression,
    RUNS_CAPABILITY_ID,
  ],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const encounters = context.capabilities.require<EncounterService>(CAPABILITY_IDS.encounters);
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
    const runs = context.capabilities.require<RunService>(RUNS_CAPABILITY_ID);

    const playerId = 'player';
    const playerKey = context.assets.resolve('player');

    let currentWave = 1;
    let spawnedEnemyCount = 0;

    combat.register(playerId, 100);

    const playerSprite = scene.physics.add.sprite(480, 270, playerKey);
    playerSprite.setCollideWorldBounds(true);

    if (runs.state().phase === 'idle') {
      runs.startRun();
    }

    const resetParticipant: RunResetParticipant = {
      id: 'survivor-shell-reset',
      onRunReset: (_state: RunState, _nextSeed: number) => {
        currentWave = 1;
        spawnedEnemyCount = 0;
        combat.remove(playerId);
        combat.register(playerId, 100);
      },
    };
    const participantHandle = runs.registerResetParticipant(resetParticipant);

    const shellService: SurvivorShellService = {
      state(): SurvivorShellState {
        const rState = runs.state();
        const pHealth = combat.get(playerId);
        const hasBulletBuff = rState.transientUpgrades.includes('transient-bullet-speed');

        return {
          phase: rState.phase,
          attempt: rState.attempt,
          seed: rState.seed,
          runDurationMs: rState.runDurationMs,
          wave: currentWave,
          transientCurrency: rState.transientCurrency,
          transientUpgrades: rState.transientUpgrades,
          stats: rState.stats,
          metaCurrency: progression.currency(),
          metaXp: progression.xp(),
          metaUnlocks: progression.unlockedFlags(),
          playerHp: pHealth.current,
          maxHp: 100,
          spawnedEnemies: spawnedEnemyCount,
          bulletSpeedBonus: hasBulletBuff ? 20 : 0,
        };
      },

      spawnWave(count: number): void {
        spawnedEnemyCount += count;
        encounters.start('arena-waves');
      },

      defeatEnemy(): void {
        if (spawnedEnemyCount > 0) spawnedEnemyCount--;
        runs.recordKill();
        runs.recordDamage(20, 0);
        runs.addTransientCurrency(5);
      },

      advanceWave(): void {
        currentWave++;
        runs.recordWaveCleared();
        runs.addTransientCurrency(10);
      },

      collectCurrency(amount: number): void {
        runs.addTransientCurrency(amount);
      },

      buyUpgrade(upgradeId: string): boolean {
        return runs.purchaseUpgrade(upgradeId);
      },

      surviveToVictory(): void {
        runs.winRun();
      },

      reset(): void {
        runs.resetRun();
      },
    };

    const handle = context.capabilities.provide(SURVIVOR_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(SURVIVOR_SHELL_CAPABILITY_ID, () => shellService.state());

    return {
      id: 'game.survivor-shell',
      update(): void {
        const intent = topDownController.read(context.input);
        playerSprite.setVelocityX(intent.moveX * 240);
        playerSprite.setVelocityY(intent.moveY * 240);
        runs.state();
      },
      dispose(): void {
        debugHandle.dispose();
        participantHandle.dispose();
        handle.dispose();
        playerSprite.destroy();
      },
    };
  },
};
