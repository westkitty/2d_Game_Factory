import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { getPreset } from '@sw2d/presets';
import { ALL_CONTROLLER_FAMILIES } from '../src/generator/controllerTemplates.ts';
import { buildGameFiles, writeGameFiles } from '../src/generator/generate.ts';
import { REPO_ROOT } from '../src/paths.ts';

/**
 * Every generated game's `src/game-specific/shellPack.ts` is a verbatim copy
 * of one of six controller-family templates. Those templates are never
 * compiled by `npm run typecheck` (they import a generated `./packConfig.ts`),
 * so a template that only `tsc` would reject - the Category-C convergence
 * program shipped one that read a `const` before its declaration (TS2448),
 * which Vite bundled without complaint and 74 real-browser proofs did not
 * notice - surfaced only in `qa:matrix` / `release:verify`, an hour into
 * the ladder. This suite generates one game per family into the gitignored
 * `games/` scratch root and runs the real `tsc --noEmit` on it, so a template
 * type error fails `npm test`.
 */

const SAMPLE_PRESET_BY_FAMILY: Readonly<Record<string, string>> = {
  platform: 'traditional-platformer',
  'top-down': 'top-down-adventure',
  vehicle: 'asteroids-shooter',
  grid: 'sokoban',
  pointer: 'gallery-shooter',
  'ui-simulation': 'idle-incremental',
};

const SCRATCH = path.join(REPO_ROOT, 'games', '__template-typecheck');
const TSC = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsc');

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

describe('controller-family shell templates typecheck as generated games', () => {
  for (const family of ALL_CONTROLLER_FAMILIES) {
    it(`${family} shell (via ${SAMPLE_PRESET_BY_FAMILY[family]}) passes tsc --noEmit`, () => {
      const presetId = SAMPLE_PRESET_BY_FAMILY[family];
      expect(presetId, `no sample preset for family ${family}`).toBeDefined();
      const preset = getPreset(presetId!);
      expect(preset.controllerFamilies[0]).toBe(family);
      const gameId = `tsc-${family}`;
      const target = path.join(SCRATCH, gameId);
      rmSync(target, { recursive: true, force: true });
      mkdirSync(SCRATCH, { recursive: true });
      writeGameFiles(buildGameFiles(gameId, preset), target);
      expect(existsSync(path.join(target, 'src', 'game-specific', 'shellPack.ts'))).toBe(true);
      const result = spawnSync(TSC, ['-p', path.join(target, 'tsconfig.json'), '--noEmit'], { encoding: 'utf8' });
      expect(result.status, `${family}: ${result.stdout}${result.stderr}`).toBe(0);
    }, 120_000);
  }
});
