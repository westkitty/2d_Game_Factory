/**
 * Local-play authoring surface (Category-C Wave 7 / ADR-0034).
 *
 * The smallest useful surface: surface the game's `content/local-play.json`
 * (mode, seats). Live axes/scores belong in-game.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateContentBundleData } from '@sw2d/schemas';
import type { LocalPlayCatalog } from '@sw2d/contracts';
import { SecurityError } from './security.ts';
import { gameRoot } from './paths.ts';

export function inspectLocalPlay(gameId: string): {
  readonly present: boolean;
  readonly mode: string;
  readonly playerCount: number;
  readonly turns: number | null;
} {
  const full = path.join(gameRoot(gameId), 'content', 'local-play.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/local-play.json in "${gameId}".`);
  const raw: unknown = JSON.parse(readFileSync(full, 'utf8'));
  const catalog = validateContentBundleData({ 'local-play': raw })['local-play']!.value as LocalPlayCatalog;
  return {
    present: catalog.players.length >= 2,
    mode: catalog.mode,
    playerCount: catalog.players.length,
    turns: catalog.hotseat?.turns ?? null,
  };
}
