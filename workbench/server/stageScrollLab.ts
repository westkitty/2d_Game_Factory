/**
 * Stage-scroll authoring surface (Category-C Wave 8 / ADR-0035).
 *
 * The smallest useful surface: surface the game's `content/stage-scroll.json`
 * (mode, length, hazard count). Live offset belongs in-game.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateContentBundleData } from '@sw2d/schemas';
import type { StageScrollCatalog } from '@sw2d/contracts';
import { SecurityError } from './security.ts';
import { gameRoot } from './paths.ts';

export function inspectStageScroll(gameId: string): {
  readonly present: boolean;
  readonly mode: string;
  readonly length: number;
  readonly speed: number;
  readonly hazardCount: number;
} {
  const full = path.join(gameRoot(gameId), 'content', 'stage-scroll.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/stage-scroll.json in \"${gameId}\".`);
  const raw: unknown = JSON.parse(readFileSync(full, 'utf8'));
  const catalog = validateContentBundleData({ 'stage-scroll': raw })['stage-scroll']!.value as StageScrollCatalog;
  return {
    present: catalog.length > 0 && catalog.speed > 0,
    mode: catalog.mode,
    length: catalog.length,
    speed: catalog.speed,
    hazardCount: catalog.hazards.length,
  };
}
