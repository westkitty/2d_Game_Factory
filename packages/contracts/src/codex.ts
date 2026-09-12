/**
 * Exhibit / codex entries (Category-C Wave 36).
 *
 * Renderer-neutral unlockable entries. Two bounded modes:
 *   - `exhibit` — inspect entries to fill a museum codex.
 *   - `case`    — inspect entries, then deduce when all are unlocked.
 *
 * Entry presentation metadata and bounded authored deduction links remain
 * renderer-neutral; the generated binders own their display.
 */

export const CODEX_CAPABILITY_ID = 'narrative.codex';

export type CodexMode = 'exhibit' | 'case';
export type CodexOutcome = 'playing' | 'complete';

export interface CodexEntryDef {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly x?: number;
  readonly y?: number;
  readonly image?: string;
  readonly portrait?: string;
  readonly spotlightColor?: string;
}

export interface CodexDeductionDef {
  readonly id: string;
  readonly requireEntries: readonly string[];
  readonly links: readonly (readonly [string, string])[];
  readonly conclusion: string;
  readonly valid: boolean;
}

export interface CodexCatalog {
  readonly schemaVersion: number;
  readonly mode: CodexMode;
  readonly entries: readonly CodexEntryDef[];
  readonly deductions?: readonly CodexDeductionDef[];
}

export interface CodexService {
  mode(): CodexMode;
  active(): boolean;
  inspect(id: string): boolean;
  deduce(): boolean;
  deduce(id: string): boolean;
  entries(): readonly CodexEntryDef[];
  links(): readonly (readonly [string, string])[];
  conclusion(): string | null;
  invalidAttempts(): number;
  unlocked(): readonly string[];
  lastResult(): string | null;
  outcome(): CodexOutcome;
  reset(): void;
}
