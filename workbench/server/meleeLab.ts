/**
 * Melee authoring surface (Category-C Wave 6 / ADR-0033).
 *
 * The smallest useful surface: surface the game's `content/melee.json`
 * (mode, foe count, strike range). Live HP belongs in-game.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateContentBundleData } from '@sw2d/schemas';
import type { MeleeCatalog } from '@sw2d/contracts';
import { SecurityError } from './security.ts';
import { gameRoot } from './paths.ts';

export function inspectMelee(gameId: string): {
  readonly present: boolean;
  readonly mode: string;
  readonly foeCount: number;
  readonly strikeRange: number;
  readonly playerHealth: number;
} {
  const full = path.join(gameRoot(gameId), 'content', 'melee.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/melee.json in "${gameId}".`);
  const raw: unknown = JSON.parse(readFileSync(full, 'utf8'));
  const catalog = validateContentBundleData({ melee: raw })['melee']!.value as MeleeCatalog;
  return {
    present: catalog.foes.length > 0,
    mode: catalog.mode,
    foeCount: catalog.foes.length,
    strikeRange: catalog.strike.range,
    playerHealth: catalog.player.health,
  };
}
