#!/usr/bin/env node
/**
 * The all-74 generation/build matrix's *build* half (MASTER_PROJECT.md
 * section 10, item 6: "prove buildable/runnable evidence, not only file
 * existence").
 *
 * `packages/cli/test/generate.test.ts` already proves, for real, for all 74
 * presets: no unresolved template token, schema-valid manifest/theme/
 * tuning/level, a resolvable shell template, correct required-vs-optional
 * pack enablement. What that file does NOT do is spawn `npm install`/`tsc`/
 * `vite build` 74 times - that would make the fast unit-test loop unusable.
 *
 * The mechanical-equivalence argument this script exists to prove instead:
 * a generated game's TypeScript source is drawn from exactly one of six
 * fixed shell templates (packages/cli/src/templates/gameSpecific/*.ts),
 * selected solely by the preset's *primary* controller family
 * (packages/cli/src/generator/controllerTemplates.ts). Every other file
 * (main.ts, content.ts, game.ts, vite.config.ts, tsconfig.json, styles.css,
 * index.html) is copied byte-for-byte regardless of preset. The only
 * per-preset variation in the generated *source code* is therefore which of
 * six fixed strings gets copied to `src/game-specific/shellPack.ts` - data
 * (game id, required pack ids, tuning numbers) varies per preset, but data
 * validity is exactly what generate.test.ts already checked with Ajv for
 * all 74. `vite build`/`tsc` success is a function of source code
 * correctness plus JSON *shape* correctness, not of specific data values -
 * so one real, passing build per controller-family equivalence class is
 * evidence that all 74 build, PROVIDED every class is actually exercised.
 *
 * This script builds: one representative preset per controller family not
 * already covered by a committed demo, plus the 12 committed demos'
 * presets themselves (their *generic* generated form - the real committed
 * demos layer additional game-specific code on top afterward and are
 * verified again independently once that lands).
 *
 * Generated the same way a real user's `sw2d new` would - under `games/`,
 * linked into the real npm workspace - because that is the actual code
 * path being proven, not a simulation of it. Every directory this script
 * creates is removed afterward (MASTER_PROJECT.md section 10: "do not
 * commit 74 generated starter directories" - not even the thirteen
 * representative ones).
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PRESETS, getPreset } from '@sw2d/presets';
import { buildGameFiles, writeGameFiles } from '../../packages/cli/src/generator/generate.ts';
import { run } from '../../packages/cli/src/exec.ts';
import { GAMES_ROOT, REPO_ROOT } from '../../packages/cli/src/paths.ts';
import { ensureWorkspaceInstalled } from '../../packages/cli/src/workspace.ts';

const DEMO_PRESET_IDS = [
  'traditional-platformer',
  'chase-platformer',
  'metroidvania',
  'twin-stick-shooter',
  'stealth-game',
  'bullet-hell',
  'top-down-racer',
  'sokoban',
  'tower-defense',
  'turn-based-tactics',
  'idle-incremental',
  'visual-novel',
];

const CONTROLLER_FAMILIES = ['platform', 'top-down', 'vehicle', 'grid', 'pointer', 'ui-simulation'] as const;

function pickRepresentatives(): readonly string[] {
  const covered = new Set(DEMO_PRESET_IDS.map((id) => getPreset(id).controllerFamilies[0]!));
  const picks: string[] = [];
  for (const family of CONTROLLER_FAMILIES) {
    if (covered.has(family)) continue;
    const preset = PRESETS.find((p) => p.controllerFamilies[0] === family);
    if (preset) picks.push(preset.id);
  }
  return picks;
}

function gameIdFor(presetId: string): string {
  return `matrix-${presetId}`.slice(0, 60);
}

async function main(): Promise<void> {
  const representatives = pickRepresentatives();
  const targets = [...DEMO_PRESET_IDS, ...representatives];
  console.log(
    `Build matrix: ${DEMO_PRESET_IDS.length} demo preset(s) + ${representatives.length} representative(s) for otherwise-uncovered families [${representatives.join(', ')}] = ${targets.length} real builds.`,
  );

  const gameIds = targets.map(gameIdFor);
  const gamePaths = gameIds.map((id) => path.join(GAMES_ROOT, id));

  for (const [index, presetId] of targets.entries()) {
    const files = buildGameFiles(gameIds[index]!, getPreset(presetId));
    writeGameFiles(files, gamePaths[index]!);
  }

  console.log('Linking npm workspace for all generated instances...');
  await ensureWorkspaceInstalled();

  const tscBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsc');
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');

  const results: Array<{ presetId: string; ok: boolean; detail: string }> = [];
  try {
    for (const [index, presetId] of targets.entries()) {
      const gamePath = gamePaths[index]!;
      process.stdout.write(`building ${presetId}... `);

      const tsc = await run(tscBin, ['-p', 'tsconfig.json', '--noEmit'], { cwd: gamePath });
      if (tsc.code !== 0) {
        results.push({ presetId, ok: false, detail: `tsc failed:\n${tsc.stdout}${tsc.stderr}` });
        console.log('FAILED (tsc)');
        continue;
      }

      const build = await run(viteBin, ['build'], { cwd: gamePath });
      if (build.code !== 0) {
        results.push({ presetId, ok: false, detail: `vite build failed:\n${build.stdout}${build.stderr}` });
        console.log('FAILED (build)');
        continue;
      }

      const distExists = existsSync(path.join(gamePath, 'dist', 'index.html'));
      results.push({ presetId, ok: distExists, detail: distExists ? 'tsc + build passed, dist/index.html present' : 'build reported success but dist/index.html is missing' });
      console.log(distExists ? 'OK' : 'FAILED (no dist output)');
    }
  } finally {
    for (const gamePath of gamePaths) rmSync(gamePath, { recursive: true, force: true });
    console.log('Cleaning up: removed all temporary games/matrix-* directories, relinking workspace...');
    await ensureWorkspaceInstalled();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} builds passed.`);
  for (const failure of failed) {
    console.error(`--- ${failure.presetId} ---`);
    console.error(failure.detail);
  }
  if (failed.length > 0) process.exitCode = 1;
}

await main();
