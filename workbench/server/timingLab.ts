/**
 * Timing authoring surface (Category-C Wave 10 / ADR-0037).
 *
 * The smallest useful surface: surface the game's `content/timing.json`
 * (mode, window, hits/misses). Live elapsed belongs in-game.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateContentBundleData } from '@sw2d/schemas';
import type { TimingCatalog } from '@sw2d/contracts';
import { SecurityError } from './security.ts';
import { gameRoot } from './paths.ts';

export function inspectTiming(gameId: string): {
  readonly present: boolean;
  readonly mode: string;
  readonly windowMs: number;
  readonly hitsToWin: number;
  readonly missesToFail: number;
} {
  const full = path.join(gameRoot(gameId), 'content', 'timing.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/timing.json in "${gameId}".`);
  const raw: unknown = JSON.parse(readFileSync(full, 'utf8'));
  const catalog = validateContentBundleData({ timing: raw })['timing']!.value as TimingCatalog;
  const present =
    catalog.hitsToWin > 0 &&
    (catalog.mode === 'reaction'
      ? (catalog.reaction?.delaysMs.length ?? 0) > 0
      : (catalog.rhythm?.periodMs ?? 0) > 0);
  return {
    present,
    mode: catalog.mode,
    windowMs: catalog.windowMs,
    hitsToWin: catalog.hitsToWin,
    missesToFail: catalog.missesToFail,
  };
}
