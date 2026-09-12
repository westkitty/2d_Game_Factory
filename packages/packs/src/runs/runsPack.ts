/**
 * Runs pack: run lifecycle + persistent meta progression (Final Product
 * Completion, Wave 2 - matrix L06 / L08). Publishes `progression.runs`.
 *
 * Renderer-neutral. Persists through `GameContext.saves` (slot `runs`,
 * schema version 1); an unavailable, invalid or foreign-version record
 * falls back to a fresh meta ledger and is reported through `loadOutcome()`.
 * Nothing here touches health, XP or currency directly - the consumer
 * reports run results and reads the loadout.
 */

import type {
  GameContext,
  InstalledSystemPack,
  RunBuyResult,
  RunLoadout,
  RunPhase,
  RunResultInput,
  RunSummary,
  RunUnlockDef,
  RunsCatalog,
  RunsMeta,
  RunsMode,
  RunsService,
  SaveStore,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

export const RUNS_SAVE_SLOT = 'runs';
const META_SCHEMA_VERSION = 1;

const EMPTY_CATALOG: RunsCatalog = {
  schemaVersion: 1,
  mode: 'survive',
  metaPerXp: 0,
  metaPerKill: 0,
  metaPerWave: 0,
  metaPerCurrency: 0,
  metaPerClear: 0,
  unlocks: [],
};

function freshMeta(): RunsMeta {
  return { schemaVersion: META_SCHEMA_VERSION, runsPlayed: 0, bestWave: 0, bestXp: 0, bestKills: 0, metaCurrency: 0, unlocked: [], lastRun: null };
}

function isMeta(value: unknown): value is RunsMeta {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.runsPlayed === 'number' &&
    typeof v.metaCurrency === 'number' &&
    Array.isArray(v.unlocked) &&
    (v.unlocked as unknown[]).every((u) => typeof u === 'string') &&
    typeof v.bestWave === 'number' &&
    typeof v.bestXp === 'number'
  );
}

class RunsServiceImpl implements RunsService {
  #meta: RunsMeta;
  #phase: RunPhase = 'idle';
  #open: { runIndex: number } | null = null;
  #last: RunSummary | null;
  readonly #outcome: string;
  readonly #events: GameContext['events'];

  constructor(
    private readonly saves: SaveStore | undefined,
    private readonly catalog: RunsCatalog,
    events: GameContext['events'],
  ) {
    this.#events = events;
    if (saves) {
      const loaded = saves.load<RunsMeta>(RUNS_SAVE_SLOT, {
        currentVersion: META_SCHEMA_VERSION,
        createDefault: freshMeta,
        migrate: (stored) => (isMeta(stored) ? { ...freshMeta(), ...(stored as RunsMeta), schemaVersion: META_SCHEMA_VERSION } : null),
      });
      this.#meta = isMeta(loaded.value) ? loaded.value : freshMeta();
      this.#outcome = loaded.outcome;
    } else {
      this.#meta = freshMeta();
      this.#outcome = 'unavailable';
    }
    // Unlocks that no longer exist in the catalog are dropped, never crash.
    const known = new Set(catalog.unlocks.map((u) => u.id));
    this.#meta = { ...this.#meta, unlocked: this.#meta.unlocked.filter((id) => known.has(id)) };
    this.#last = this.#meta.lastRun;
  }

  mode(): RunsMode {
    return this.catalog.mode;
  }

  active(): boolean {
    const c = this.catalog;
    return c.unlocks.length > 0 || c.metaPerXp > 0 || c.metaPerKill > 0 || c.metaPerWave > 0 || c.metaPerCurrency > 0 || c.metaPerClear > 0;
  }

  phase(): RunPhase {
    return this.#phase;
  }

  beginRun(): number {
    if (this.#open) return this.#open.runIndex;
    this.#open = { runIndex: this.#meta.runsPlayed + 1 };
    this.#phase = 'in-run';
    this.#events.emit('runs:started', { runIndex: this.#open.runIndex, mode: this.catalog.mode });
    return this.#open.runIndex;
  }

  endRun(result: RunResultInput): RunSummary {
    if (!this.#open) {
      if (this.#last) return this.#last;
      this.#open = { runIndex: this.#meta.runsPlayed + 1 };
    }
    const c = this.catalog;
    const metaEarned = Math.max(
      0,
      Math.round(
        result.xp * c.metaPerXp + result.kills * c.metaPerKill + result.wave * c.metaPerWave + result.currency * c.metaPerCurrency + (result.cause === 'cleared' ? c.metaPerClear : 0),
      ),
    );
    const summary: RunSummary = { ...result, runIndex: this.#open.runIndex, metaEarned };
    this.#meta = {
      ...this.#meta,
      runsPlayed: this.#meta.runsPlayed + 1,
      bestWave: Math.max(this.#meta.bestWave, result.wave),
      bestXp: Math.max(this.#meta.bestXp, result.xp),
      bestKills: Math.max(this.#meta.bestKills, result.kills),
      metaCurrency: this.#meta.metaCurrency + metaEarned,
      lastRun: summary,
    };
    this.#open = null;
    this.#last = summary;
    this.#phase = 'ended';
    this.persist();
    this.#events.emit('runs:ended', { runIndex: summary.runIndex, cause: summary.cause, metaEarned, metaCurrency: this.#meta.metaCurrency });
    return summary;
  }

  current(): RunSummary | null {
    return this.#last;
  }

  meta(): RunsMeta {
    return this.#meta;
  }

  unlocks(): readonly (RunUnlockDef & { readonly owned: boolean; readonly affordable: boolean })[] {
    return this.catalog.unlocks.map((u) => ({
      ...u,
      owned: this.#meta.unlocked.includes(u.id),
      affordable: !this.#meta.unlocked.includes(u.id) && this.#meta.metaCurrency >= u.cost,
    }));
  }

  buy(unlockId: string): RunBuyResult {
    const def = this.catalog.unlocks.find((u) => u.id === unlockId);
    if (!def) return 'unknown';
    if (this.#meta.unlocked.includes(unlockId)) return 'owned';
    if (this.#meta.metaCurrency < def.cost) return 'unaffordable';
    this.#meta = { ...this.#meta, metaCurrency: this.#meta.metaCurrency - def.cost, unlocked: [...this.#meta.unlocked, unlockId].sort() };
    this.persist();
    this.#events.emit('runs:unlocked', { unlockId, metaCurrency: this.#meta.metaCurrency });
    return 'bought';
  }

  nextAffordable(): RunUnlockDef | null {
    const candidates = this.unlocks().filter((u) => u.affordable).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    const first = candidates[0];
    return first ? { id: first.id, label: first.label, cost: first.cost, effect: first.effect } : null;
  }

  loadout(): RunLoadout {
    let maxHealthBonus = 0;
    let damageBonus = 0;
    let speedBonus = 0;
    let startCurrency = 0;
    let startXp = 0;
    for (const u of this.catalog.unlocks) {
      if (!this.#meta.unlocked.includes(u.id)) continue;
      switch (u.effect.kind) {
        case 'max-health':
          maxHealthBonus += u.effect.value;
          break;
        case 'damage':
          damageBonus += u.effect.value;
          break;
        case 'speed':
          speedBonus += u.effect.value;
          break;
        case 'start-currency':
          startCurrency += u.effect.value;
          break;
        case 'start-xp':
          startXp += u.effect.value;
          break;
      }
    }
    return { maxHealthBonus, damageBonus, speedBonus, startCurrency, startXp };
  }

  loadOutcome(): string {
    return this.#outcome;
  }

  wipe(): void {
    this.#meta = freshMeta();
    this.#last = null;
    this.#open = null;
    this.#phase = 'idle';
    this.saves?.clear(RUNS_SAVE_SLOT);
  }

  private persist(): void {
    this.saves?.save(RUNS_SAVE_SLOT, this.#meta);
  }
}

export const runsPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.runs,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.runs],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['runs']?.value as RunsCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new RunsServiceImpl(context.saves, catalog, context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.runs, service);
    return {
      id: PACK_IDS.runs,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { RunsService };
