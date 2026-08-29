import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SaveStore,
  SystemPackDefinition,
  VersionedRecord,
  GenerationSeed,
  RunDefinition,
  RunsDocument,
  RunPhase,
  RunResetFailure,
  RunResetParticipant,
  RunResetResult,
  RunService,
  RunState,
  RunStats,
} from '@sw2d/contracts';
import { normalizeSeed } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { ProgressionService } from '../progression/progressionPack.ts';
import type { ItemsService } from '../items/itemsPack.ts';
import type { WorldService } from '../world/worldPack.ts';
import runsConfigSchema from '../../schemas/runs-config.schema.json' with { type: 'json' };

export const RUNS_CONFIG_SCHEMA_ID = runsConfigSchema.$id;
registerSchema(runsConfigSchema);

export const RUNS_SAVE_SLOT_ACTIVE = 'sw2d.runs.active';
const RUNS_SAVE_VERSION = 1;

export interface RunsConfig {
  readonly defaultRunId?: string;
}

interface ActiveRunSaveRecord extends VersionedRecord {
  readonly schemaVersion: number;
  readonly runId: string;
  readonly seed: number;
  readonly phase: RunPhase;
  readonly attempt: number;
  readonly runDurationMs: number;
  readonly transientCurrency: number;
  readonly transientUpgrades: readonly string[];
  readonly stats: RunStats;
}

export class DuplicateRunIdError extends Error {
  constructor(id: string) {
    super(`Duplicate run definition id: "${id}".`);
    this.name = 'DuplicateRunIdError';
  }
}

export class DuplicateResetParticipantError extends Error {
  constructor(id: string) {
    super(`Duplicate RunResetParticipant id: "${id}".`);
    this.name = 'DuplicateResetParticipantError';
  }
}

export class MissingCapabilityRequirementError extends Error {
  constructor(requirement: string, capability: string) {
    super(`RunDefinition requires ${requirement}, but capability "${capability}" is not installed.`);
    this.name = 'MissingCapabilityRequirementError';
  }
}

export class RunAlreadyActiveError extends Error {
  constructor(runId: string) {
    super(`Cannot start run "${runId}": a run is already active.`);
    this.name = 'RunAlreadyActiveError';
  }
}

export class UnknownRunError extends Error {
  constructor(runId: string) {
    super(`Unknown run definition: "${runId}".`);
    this.name = 'UnknownRunError';
  }
}

interface MutableRunStats {
  kills: number;
  roomsCleared: number;
  wavesCleared: number;
  damageDealt: number;
  damageTaken: number;
}

export class RunServiceImpl implements RunService {
  readonly #events: EventBus;
  readonly #capabilities: GameContext['capabilities'];
  readonly #saves: SaveStore | undefined;
  readonly #runs = new Map<string, RunDefinition>();
  readonly #participants = new Map<string, RunResetParticipant>();

  #activeDef: RunDefinition | undefined;
  #runId: string;
  #seed: GenerationSeed;
  #phase: RunPhase = 'idle';
  #attempt = 1;
  #runDurationMs = 0;
  #transientCurrency = 0;
  #transientUpgrades: string[] = [];
  #stats: MutableRunStats = {
    kills: 0,
    roomsCleared: 0,
    wavesCleared: 0,
    damageDealt: 0,
    damageTaken: 0,
  };

  constructor(
    events: EventBus,
    capabilities: GameContext['capabilities'],
    runsDoc: RunsDocument | undefined,
    saves: SaveStore | undefined,
    defaultRunId?: string,
  ) {
    this.#events = events;
    this.#capabilities = capabilities;
    this.#saves = saves;

    for (const def of runsDoc?.runs ?? []) {
      if (this.#runs.has(def.id)) throw new DuplicateRunIdError(def.id);
      this.#runs.set(def.id, def);
    }

    if (defaultRunId && this.#runs.has(defaultRunId)) {
      this.#activeDef = this.#runs.get(defaultRunId);
    } else if (this.#runs.size > 0) {
      this.#activeDef = this.#runs.values().next().value;
    }

    this.#runId = this.#activeDef?.id ?? 'default';
    this.#transientCurrency = this.#activeDef?.startingTransientCurrency ?? 0;
    this.#seed = this.#deriveSeed(this.#attempt);

    // Resumable check
    if (this.#activeDef?.resumable && saves) {
      const loaded = saves.load<ActiveRunSaveRecord>(RUNS_SAVE_SLOT_ACTIVE, {
        currentVersion: RUNS_SAVE_VERSION,
        createDefault: () => ({
          schemaVersion: RUNS_SAVE_VERSION,
          runId: this.#runId,
          seed: this.#seed,
          phase: 'idle' as RunPhase,
          attempt: 1,
          runDurationMs: 0,
          transientCurrency: this.#transientCurrency,
          transientUpgrades: [],
          stats: { kills: 0, roomsCleared: 0, wavesCleared: 0, damageDealt: 0, damageTaken: 0 },
        }),
      });

      if (loaded.outcome === 'loaded' && loaded.value.phase === 'active') {
        this.#runId = loaded.value.runId;
        this.#seed = normalizeSeed(loaded.value.seed);
        this.#phase = loaded.value.phase;
        this.#attempt = loaded.value.attempt;
        this.#runDurationMs = loaded.value.runDurationMs;
        this.#transientCurrency = loaded.value.transientCurrency;
        this.#transientUpgrades = [...loaded.value.transientUpgrades];
        this.#stats = { ...loaded.value.stats };
        if (this.#runs.has(this.#runId)) {
          this.#activeDef = this.#runs.get(this.#runId);
        }
      }
    }
  }

  state(): RunState {
    return {
      runId: this.#runId,
      seed: this.#seed,
      phase: this.#phase,
      attempt: this.#attempt,
      runDurationMs: Math.round(this.#runDurationMs),
      transientCurrency: this.#transientCurrency,
      transientUpgrades: [...this.#transientUpgrades],
      stats: { ...this.#stats },
    };
  }

  definition(): RunDefinition | undefined {
    return this.#activeDef;
  }

  startRun(options?: { seed?: number; runId?: string }): RunState {
    if (this.#phase === 'active') {
      throw new RunAlreadyActiveError(this.#runId);
    }

    if (options?.runId) {
      const def = this.#runs.get(options.runId);
      if (!def) throw new UnknownRunError(options.runId);
      this.#activeDef = def;
      this.#runId = def.id;
    }

    if (options?.seed !== undefined) {
      this.#seed = normalizeSeed(options.seed);
    } else {
      this.#seed = this.#deriveSeed(this.#attempt);
    }

    this.#phase = 'active';
    this.#runDurationMs = 0;
    this.#transientCurrency = this.#activeDef?.startingTransientCurrency ?? 0;
    this.#transientUpgrades = [];
    this.#stats = { kills: 0, roomsCleared: 0, wavesCleared: 0, damageDealt: 0, damageTaken: 0 };

    // Apply starting items
    if (this.#activeDef?.startingItems && this.#activeDef.startingItems.length > 0) {
      if (!this.#capabilities.has(CAPABILITY_IDS.items)) {
        throw new MissingCapabilityRequirementError('startingItems', CAPABILITY_IDS.items);
      }
      const items = this.#capabilities.require<ItemsService>(CAPABILITY_IDS.items);
      for (const item of this.#activeDef.startingItems) {
        items.grant(item.itemId, item.quantity);
      }
    }

    // Apply starting resources
    if (this.#activeDef?.startingResources && this.#activeDef.startingResources.length > 0) {
      if (!this.#capabilities.has(CAPABILITY_IDS.simulation)) {
        throw new MissingCapabilityRequirementError('startingResources', CAPABILITY_IDS.simulation);
      }
    }

    // Apply starting flags
    if (this.#activeDef?.startingFlags && this.#activeDef.startingFlags.length > 0) {
      if (!this.#capabilities.has(CAPABILITY_IDS.world)) {
        throw new MissingCapabilityRequirementError('startingFlags', CAPABILITY_IDS.world);
      }
      const world = this.#capabilities.require<WorldService>(CAPABILITY_IDS.world);
      for (const flag of this.#activeDef.startingFlags) {
        world.setFlag(flag.flagId, flag.value);
      }
    }

    this.#events.emit('runs:started', {
      runId: this.#runId,
      seed: this.#seed,
      attempt: this.#attempt,
    });

    this.#persistActive();
    return this.state();
  }

  update(deltaMs: number): void {
    if (this.#phase === 'active') {
      this.#runDurationMs += deltaMs;
    }
  }

  endRun(outcome: 'victory' | 'defeat' | 'abandoned'): RunState {
    if (this.#phase !== 'active') return this.state();

    this.#phase = outcome;

    // Apply rewards
    const rewards = outcome === 'victory' ? this.#activeDef?.rewardRules?.onVictory : outcome === 'defeat' ? this.#activeDef?.rewardRules?.onDefeat : undefined;

    if (rewards) {
      if (this.#capabilities.has(CAPABILITY_IDS.progression)) {
        const progression = this.#capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
        if (rewards.metaCurrency !== undefined && rewards.metaCurrency > 0) {
          progression.addCurrency(rewards.metaCurrency);
        }
        if (rewards.xp !== undefined && rewards.xp > 0) {
          progression.addXp(rewards.xp);
        }
        if (rewards.unlockFlags) {
          for (const flag of rewards.unlockFlags) {
            progression.unlock(flag);
          }
        }
      }
      if (rewards.items && this.#capabilities.has(CAPABILITY_IDS.items)) {
        const items = this.#capabilities.require<ItemsService>(CAPABILITY_IDS.items);
        for (const item of rewards.items) {
          items.grant(item.itemId, item.quantity);
        }
      }
    }

    this.#events.emit('runs:ended', {
      runId: this.#runId,
      outcome,
      durationMs: Math.round(this.#runDurationMs),
      stats: { ...this.#stats },
    });

    this.#clearActiveSave();
    return this.state();
  }

  winRun(): RunState {
    return this.endRun('victory');
  }

  loseRun(): RunState {
    return this.endRun('defeat');
  }

  abandonRun(): RunState {
    return this.endRun('abandoned');
  }

  resetRun(nextSeed?: number): RunResetResult {
    this.#attempt += 1;
    this.#phase = 'idle';

    if (nextSeed !== undefined) {
      this.#seed = normalizeSeed(nextSeed);
    } else {
      this.#seed = this.#deriveSeed(this.#attempt);
    }

    this.#transientCurrency = 0;
    this.#transientUpgrades = [];
    this.#runDurationMs = 0;
    this.#stats = { kills: 0, roomsCleared: 0, wavesCleared: 0, damageDealt: 0, damageTaken: 0 };

    this.#clearActiveSave();

    const failures: RunResetFailure[] = [];
    const currentState = this.state();

    // Deterministic order: sorted by participant ID
    const sortedIds = [...this.#participants.keys()].sort();
    for (const id of sortedIds) {
      const participant = this.#participants.get(id);
      if (!participant) continue;
      try {
        participant.onRunReset(currentState, this.#seed);
      } catch (err) {
        failures.push({
          participantId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.#events.emit('runs:reset', {
      runId: this.#runId,
      attempt: this.#attempt,
      seed: this.#seed,
      failures,
    });

    return {
      ok: failures.length === 0,
      state: this.state(),
      failures,
    };
  }

  addTransientCurrency(delta: number): number {
    this.#transientCurrency = Math.max(0, this.#transientCurrency + delta);
    this.#events.emit('runs:currencyChanged', {
      transientCurrency: this.#transientCurrency,
      delta,
    });
    this.#persistActive();
    return this.#transientCurrency;
  }

  purchaseUpgrade(upgradeId: string): boolean {
    const upgrade = this.#activeDef?.upgrades?.find((u) => u.id === upgradeId);
    if (!upgrade) return false;

    if (upgrade.kind === 'transient') {
      if (this.#transientCurrency < upgrade.cost) return false;
      this.#transientCurrency -= upgrade.cost;
      this.#transientUpgrades.push(upgrade.id);
      this.#events.emit('runs:upgradePurchased', {
        upgradeId: upgrade.id,
        kind: 'transient',
      });
      this.#persistActive();
      return true;
    }

    if (upgrade.kind === 'permanent') {
      if (!this.#capabilities.has(CAPABILITY_IDS.progression)) return false;
      const progression = this.#capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
      if (progression.currency() < upgrade.cost) return false;
      progression.addCurrency(-upgrade.cost);
      progression.unlock(upgrade.effectRef ?? upgrade.id);
      this.#events.emit('runs:upgradePurchased', {
        upgradeId: upgrade.id,
        kind: 'permanent',
      });
      return true;
    }

    return false;
  }

  recordKill(): void {
    this.#stats.kills += 1;
    this.#events.emit('runs:killRecorded', { kills: this.#stats.kills });
  }

  recordRoomCleared(): void {
    this.#stats.roomsCleared += 1;
    this.#events.emit('runs:roomCleared', { roomsCleared: this.#stats.roomsCleared });
  }

  recordWaveCleared(): void {
    this.#stats.wavesCleared += 1;
    this.#events.emit('runs:waveCleared', { wavesCleared: this.#stats.wavesCleared });
  }

  recordDamage(dealt: number, taken: number): void {
    if (dealt > 0) this.#stats.damageDealt += Math.floor(dealt);
    if (taken > 0) this.#stats.damageTaken += Math.floor(taken);
  }

  registerResetParticipant(participant: RunResetParticipant): { dispose(): void } {
    if (this.#participants.has(participant.id)) {
      throw new DuplicateResetParticipantError(participant.id);
    }
    this.#participants.set(participant.id, participant);
    return {
      dispose: () => {
        this.#participants.delete(participant.id);
      },
    };
  }

  #deriveSeed(attempt: number): GenerationSeed {
    const policy = this.#activeDef?.seedPolicy;
    if (!policy) return normalizeSeed(1337 + attempt);

    switch (policy.kind) {
      case 'fixed':
        return normalizeSeed(policy.seed ?? 1337);

      case 'increment-attempt': {
        const base = policy.baseSeed ?? 1337;
        const step = policy.step ?? 1;
        return normalizeSeed(base + (attempt - 1) * step);
      }

      case 'run-counter-derived': {
        const base = normalizeSeed(policy.baseSeed ?? 1337);
        let h = Math.imul(base ^ attempt, 0x85ebca6b);
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 16;
        return h >>> 0;
      }
    }
  }

  #persistActive(): void {
    if (!this.#activeDef?.resumable || !this.#saves || this.#phase !== 'active') return;
    this.#saves.save<ActiveRunSaveRecord>(RUNS_SAVE_SLOT_ACTIVE, {
      schemaVersion: RUNS_SAVE_VERSION,
      runId: this.#runId,
      seed: this.#seed,
      phase: this.#phase,
      attempt: this.#attempt,
      runDurationMs: this.#runDurationMs,
      transientCurrency: this.#transientCurrency,
      transientUpgrades: [...this.#transientUpgrades],
      stats: { ...this.#stats },
    });
  }

  dispose(): void {
    this.#persistActive();
  }

  #clearActiveSave(): void {
    if (!this.#activeDef?.resumable || !this.#saves) return;
    this.#saves.clear(RUNS_SAVE_SLOT_ACTIVE);
  }
}

export const runsPack: SystemPackDefinition<RunsConfig, GameContext> = {
  id: PACK_IDS.runs,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.runs],
  dependencies: [],
  configSchemaId: RUNS_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: RunsConfig): InstalledSystemPack {
    const runsDoc = context.content.data['runs']?.value as RunsDocument | undefined;
    const saves = context.saves;
    const service = new RunServiceImpl(
      context.events,
      context.capabilities,
      runsDoc,
      saves,
      config?.defaultRunId,
    );
    const handle = context.capabilities.provide(CAPABILITY_IDS.runs, service);

    return {
      id: PACK_IDS.runs,
      update(deltaMs: number): void {
        service.update(deltaMs);
      },
      dispose(): void {
        service.dispose();
        handle.dispose();
      },
    };
  },
};

export type { RunService } from '@sw2d/contracts';
