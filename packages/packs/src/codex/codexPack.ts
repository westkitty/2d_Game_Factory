/**
 * Exhibit / codex entries (Category-C Wave 30).
 *
 * Renderer-neutral unlockable entries. Overlay kits stay local. Empty
 * catalogs stay inert.
 *
 * Bounded modes: exhibit (inspect to fill a museum codex) and case
 * (inspect, reject invalid theories, then expose authored links/conclusion).
 */

import type {
  CodexCatalog,
  CodexMode,
  CodexOutcome,
  CodexService,
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: CodexCatalog = {
  schemaVersion: 1,
  mode: 'exhibit',
  entries: [{ id: 'none', title: 'None', body: 'None' }],
};

class CodexServiceImpl implements CodexService {
  private readonly unlockedSet = new Set<string>();
  private last: string | null = null;
  private current: CodexOutcome = 'playing';
  private boardLinks: Array<readonly [string, string]> = [];
  private solvedConclusion: string | null = null;
  private invalidCount = 0;

  constructor(
    private readonly events: EventBus,
    private readonly catalog: CodexCatalog,
  ) {}

  mode(): CodexMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.entries.length > 0 && this.catalog.entries[0]?.id !== 'none';
  }

  inspect(id: string): boolean {
    if (!this.active() || this.current !== 'playing') return false;
    if (!this.catalog.entries.some((entry) => entry.id === id)) {
      this.last = 'unknown';
      return false;
    }
    if (this.unlockedSet.has(id)) {
      this.last = `reread-${id}`;
      return true;
    }
    this.unlockedSet.add(id);
    this.last = `unlock-${id}`;
    this.events.emit('codex:unlocked', { entryId: id, unlocked: this.unlockedSet.size });
    if (this.catalog.mode === 'exhibit' && this.unlockedSet.size >= this.liveCount()) {
      this.current = 'complete';
      this.last = 'catalogued';
      this.events.emit('codex:completed', { mode: this.catalog.mode });
    }
    return true;
  }

  deduce(id?: string): boolean {
    if (!this.active() || this.current !== 'playing' || this.catalog.mode !== 'case') {
      this.last = 'no-case';
      return false;
    }
    const deduction = id
      ? this.catalog.deductions?.find((candidate) => candidate.id === id)
      : this.catalog.deductions?.find((candidate) => candidate.valid);
    const required = deduction?.requireEntries ?? this.catalog.entries.filter((entry) => entry.id !== 'none').map((entry) => entry.id);
    if (required.some((entryId) => !this.unlockedSet.has(entryId))) {
      this.last = 'incomplete';
      return false;
    }
    if (deduction && !deduction.valid) {
      this.invalidCount += 1;
      this.last = 'invalid-deduction';
      return false;
    }
    this.boardLinks = [...(deduction?.links ?? [])];
    this.solvedConclusion = deduction?.conclusion ?? 'The evidence supports the conclusion.';
    this.current = 'complete';
    this.last = 'solved';
    this.events.emit('codex:completed', { mode: this.catalog.mode });
    return true;
  }

  entries(): readonly CodexCatalog['entries'][number][] { return this.catalog.entries; }
  links(): readonly (readonly [string, string])[] { return this.boardLinks; }
  conclusion(): string | null { return this.solvedConclusion; }
  invalidAttempts(): number { return this.invalidCount; }

  unlocked(): readonly string[] {
    return [...this.unlockedSet];
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): CodexOutcome {
    return this.current;
  }

  reset(): void {
    this.unlockedSet.clear();
    this.last = null;
    this.current = 'playing';
    this.boardLinks = [];
    this.solvedConclusion = null;
    this.invalidCount = 0;
  }

  private liveCount(): number {
    return this.catalog.entries.filter((entry) => entry.id !== 'none').length;
  }
}

export const codexPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.codex,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.codex],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['codex']?.value as CodexCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new CodexServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.codex, service);
    return {
      id: PACK_IDS.codex,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { CodexService };
