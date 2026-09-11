/**
 * Wave-30 authoring surface (Category-C / ADR-0057).
 *
 * One inspect over the six leftover catalogs. Live occupancy / ball /
 * origin belong in-game.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateContentBundleData } from '@sw2d/schemas';
import type {
  CameraCatalog,
  CodexCatalog,
  PinballCatalog,
  TargetingCatalog,
  TerritoryCatalog,
  WallCatalog,
} from '@sw2d/contracts';
import { SecurityError } from './security.ts';
import { gameRoot } from './paths.ts';

export function inspectWave30(gameId: string): {
  readonly wall: { readonly present: boolean; readonly mode: string; readonly walls: number };
  readonly territory: { readonly present: boolean; readonly mode: string; readonly zones: number };
  readonly pinball: { readonly present: boolean; readonly mode: string; readonly bumpers: number };
  readonly camera: { readonly present: boolean; readonly mode: string; readonly shotsToWin: number };
  readonly codex: { readonly present: boolean; readonly mode: string; readonly entries: number };
  readonly targeting: { readonly present: boolean; readonly mode: string; readonly actors: number };
} {
  const root = gameRoot(gameId);

  function read(name: string): unknown {
    const full = path.join(root, 'content', name);
    if (!existsSync(full)) throw new SecurityError(404, `No content/${name} in "${gameId}".`);
    return JSON.parse(readFileSync(full, 'utf8'));
  }

  const wall = validateContentBundleData({ wall: read('wall.json') })['wall']!.value as WallCatalog;
  const territory = validateContentBundleData({ territory: read('territory.json') })['territory']!.value as TerritoryCatalog;
  const pinball = validateContentBundleData({ pinball: read('pinball.json') })['pinball']!.value as PinballCatalog;
  const camera = validateContentBundleData({ camera: read('camera.json') })['camera']!.value as CameraCatalog;
  const codex = validateContentBundleData({ codex: read('codex.json') })['codex']!.value as CodexCatalog;
  const targeting = validateContentBundleData({ targeting: read('targeting.json') })['targeting']!.value as TargetingCatalog;

  return {
    wall: {
      present: wall.slideSpeed > 0 && wall.walls[0]?.id !== 'none',
      mode: wall.mode,
      walls: wall.walls.filter((w) => w.id !== 'none').length,
    },
    territory: {
      present: territory.zones[0]?.id !== 'none',
      mode: territory.mode,
      zones: territory.zones.filter((z) => z.id !== 'none').length,
    },
    pinball: {
      present: pinball.winScore > 0 && pinball.gravity > 0,
      mode: pinball.mode,
      bumpers: pinball.bumpers.length,
    },
    camera: {
      present: camera.mode === 'rail' ? camera.speed > 0 : camera.shotsToWin > 0,
      mode: camera.mode,
      shotsToWin: camera.shotsToWin,
    },
    codex: {
      present: codex.entries[0]?.id !== 'none',
      mode: codex.mode,
      entries: codex.entries.filter((e) => e.id !== 'none').length,
    },
    targeting: {
      present: targeting.actors[0]?.id !== 'none',
      mode: targeting.mode,
      actors: targeting.actors.filter((a) => a.id !== 'none').length,
    },
  };
}
