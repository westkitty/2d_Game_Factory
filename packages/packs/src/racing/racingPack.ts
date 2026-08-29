import type {
  GameContext,
  InstalledSystemPack,
  RaceCatalog,
  RaceCheckpointDefinition,
  RaceCheckpointResult,
  RaceDefinition,
  RaceSave,
  RaceService,
  RaceState,
  SaveStore,
  SystemPackDefinition,
  VersionedRecord,
} from '@sw2d/contracts';
import { UnknownRaceError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Racing pack: reusable race / checkpoint / lap state (capability program
 * Phase 10), publishing `race.state`. Separate from `vehicle.motion`.
 *
 * Simulation time only - `tick(deltaMs)` drives the countdown and the elapsed
 * timer, never `Date.now()`. Checkpoints are ordered; entering one out of
 * order never advances the race, so a shortcut cannot complete a lap. Best
 * results persist through `context.saves` when `config.persist` is set.
 */

export const RACING_SAVE_SLOT = 'racing';
const SAVE_VERSION = 1;

interface RaceSaveRecord extends VersionedRecord, RaceSave {}

class RaceServiceImpl implements RaceService {
  readonly #defs = new Map<string, RaceDefinition>();
  readonly #saves: SaveStore | undefined;
  #active: RaceDefinition | null = null;
  #phase: RaceState['phase'] = 'idle';
  #countdownMs = 0;
  #elapsedMs = 0;
  #lap = 0;
  #expected = 0;
  #lapStartMs = 0;
  #lapTimes: number[] = [];
  #best = new Map<string, { bestLapMs: number | null; bestTotalMs: number | null }>();

  constructor(catalog: RaceCatalog | undefined, saves: SaveStore | undefined) {
    this.#saves = saves;
    for (const def of catalog?.races ?? []) {
      if (this.#defs.has(def.id)) throw new Error(`Duplicate race id "${def.id}" in content/races.json.`);
      this.#defs.set(def.id, def);
    }
    if (saves) {
      const loaded = saves.load<RaceSaveRecord>(RACING_SAVE_SLOT, {
        currentVersion: SAVE_VERSION,
        createDefault: () => ({ schemaVersion: SAVE_VERSION, bestByRaceId: {} }),
      });
      for (const [id, rec] of Object.entries(loaded.value.bestByRaceId)) this.#best.set(id, rec);
    }
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  load(raceId: string): void {
    const def = this.#defs.get(raceId);
    if (!def) throw new UnknownRaceError(raceId);
    this.#active = def;
    this.restartRace();
  }

  restartRace(): void {
    this.#phase = 'idle';
    this.#countdownMs = this.#active?.countdownMs ?? 0;
    this.#elapsedMs = 0;
    this.#lap = 0;
    this.#expected = 0;
    this.#lapStartMs = 0;
    this.#lapTimes = [];
  }

  startRace(): void {
    if (!this.#active) return;
    this.restartRace();
    this.#phase = this.#countdownMs > 0 ? 'countdown' : 'racing';
    this.#lap = 1;
  }

  tick(deltaMs: number): void {
    if (deltaMs <= 0) return;
    if (this.#phase === 'countdown') {
      this.#countdownMs = Math.max(0, this.#countdownMs - deltaMs);
      if (this.#countdownMs === 0) {
        this.#phase = 'racing';
        this.#lapStartMs = 0;
      }
      return;
    }
    if (this.#phase === 'racing') this.#elapsedMs += deltaMs;
  }

  checkpointEntered(checkpointId: string): RaceCheckpointResult {
    const def = this.#active;
    if (!def || this.#phase !== 'racing') return { counted: false, lapCompleted: false, finished: false };
    const expected = def.checkpoints[this.#expected];
    if (!expected || expected.id !== checkpointId) return { counted: false, lapCompleted: false, finished: false };

    this.#expected += 1;
    let lapCompleted = false;
    let finished = false;

    if (this.#expected >= def.checkpoints.length) {
      // A full ordered lap.
      lapCompleted = true;
      this.#expected = 0;
      const lapMs = this.#elapsedMs - this.#lapStartMs;
      this.#lapTimes.push(lapMs);
      this.#lapStartMs = this.#elapsedMs;
      if (this.#lap >= def.laps) {
        finished = true;
        this.#phase = 'finished';
        this.#recordBest();
      } else {
        this.#lap += 1;
      }
    }
    return { counted: true, lapCompleted, finished };
  }

  raceState(): RaceState {
    const best = this.#active ? this.#best.get(this.#active.id) : undefined;
    return {
      phase: this.#phase,
      countdownRemainingMs: this.#countdownMs,
      currentLap: this.#lap,
      expectedCheckpointIndex: this.#expected,
      elapsedMs: this.#elapsedMs,
      lapTimes: [...this.#lapTimes],
      bestLapMs: best?.bestLapMs ?? null,
      bestTotalMs: best?.bestTotalMs ?? null,
      finished: this.#phase === 'finished',
    };
  }

  expectedCheckpoint(): RaceCheckpointDefinition | null {
    if (!this.#active || this.#phase === 'finished' || this.#phase === 'idle') return null;
    return this.#active.checkpoints[this.#expected] ?? null;
  }

  currentLap(): number {
    return this.#lap;
  }

  elapsedMs(): number {
    return this.#elapsedMs;
  }

  lapTimes(): readonly number[] {
    return [...this.#lapTimes];
  }

  finished(): boolean {
    return this.#phase === 'finished';
  }

  #recordBest(): void {
    if (!this.#active) return;
    const total = this.#elapsedMs;
    const bestLap = this.#lapTimes.length > 0 ? Math.min(...this.#lapTimes) : null;
    const prev = this.#best.get(this.#active.id) ?? { bestLapMs: null, bestTotalMs: null };
    const next = {
      bestLapMs: prev.bestLapMs === null ? bestLap : bestLap === null ? prev.bestLapMs : Math.min(prev.bestLapMs, bestLap),
      bestTotalMs: prev.bestTotalMs === null ? total : Math.min(prev.bestTotalMs, total),
    };
    this.#best.set(this.#active.id, next);
    this.#persist();
  }

  #persist(): void {
    if (!this.#saves) return;
    const bestByRaceId: Record<string, { bestLapMs: number | null; bestTotalMs: number | null }> = {};
    for (const [id, rec] of this.#best) bestByRaceId[id] = rec;
    this.#saves.save<RaceSaveRecord>(RACING_SAVE_SLOT, { schemaVersion: SAVE_VERSION, bestByRaceId });
  }
}

export interface RacingConfig {
  /** Persist best lap / total times through `context.saves`. Default false. */
  readonly persist?: boolean;
}

export const racingPack: SystemPackDefinition<RacingConfig, GameContext> = {
  id: PACK_IDS.racing,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.racing],
  dependencies: [],

  install(context: GameContext, config: RacingConfig): InstalledSystemPack {
    const catalog = context.content.data['races']?.value as RaceCatalog | undefined;
    const service = new RaceServiceImpl(catalog, config?.persist ? context.saves : undefined);
    const first = service.definitionIds()[0];
    if (first) service.load(first);
    const handle = context.capabilities.provide(CAPABILITY_IDS.racing, service);
    return {
      id: PACK_IDS.racing,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { RaceService } from '@sw2d/contracts';
