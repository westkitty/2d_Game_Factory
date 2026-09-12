/**
 * Needs authoring surface (Category-C Wave 2 / ADR-0029).
 *
 * The smallest useful surface: surface the game's `content/needs.json`
 * (mode, subject, needs, actions, win/lose). Read-only - editing is JSON
 * work on the file. Live values belong on the in-game debug snapshot.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { NeedsCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface NeedsInspectResult {
  readonly present: boolean;
  readonly mode: string;
  readonly subject: { readonly id: string; readonly displayName: string };
  readonly needs: readonly { readonly id: string; readonly displayName: string; readonly value: number; readonly decayPerSecond: number }[];
  readonly actions: readonly { readonly id: string; readonly displayName: string }[];
  readonly win: { readonly minValue: number; readonly holdMs: number; readonly minActions: number };
  readonly loseBelow: number | null;
}

export function inspectNeeds(gameId: string): NeedsInspectResult {
  const full = path.join(gameRoot(gameId), 'content', 'needs.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/needs.json in \"${gameId}\".`);
  const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
  const catalog = validateContentBundleData({ needs: raw }).needs!.value as NeedsCatalog;
  return {
    present: catalog.needs.length > 0,
    mode: catalog.mode,
    subject: catalog.subject,
    needs: catalog.needs.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      value: n.value,
      decayPerSecond: n.decayPerSecond,
    })),
    actions: catalog.actions.map((a) => ({ id: a.id, displayName: a.displayName })),
    win: catalog.win,
    loseBelow: catalog.loseBelow ?? null,
  };
}
