/**
 * Exhibit / codex entries (Category-C Wave 36).
 *
 * Renderer-neutral unlockable entries. Two bounded modes:
 *   - `exhibit` — inspect entries to fill a museum codex.
 *   - `case`    — inspect entries, then deduce when all are unlocked.
 *
 * Not portraits, not parser IF, not an evidence-board graph.
 */

export const CODEX_CAPABILITY_ID = 'narrative.codex';

export type CodexMode = 'exhibit' | 'case';
export type CodexOutcome = 'playing' | 'complete';

export interface CodexEntryDef {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface CodexCatalog {
  readonly schemaVersion: number;
  readonly mode: CodexMode;
  readonly entries: readonly CodexEntryDef[];
}

export interface CodexService {
  mode(): CodexMode;
  active(): boolean;
  inspect(id: string): boolean;
  deduce(): boolean;
  unlocked(): readonly string[];
  lastResult(): string | null;
  outcome(): CodexOutcome;
  reset(): void;
}
