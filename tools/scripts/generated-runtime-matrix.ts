#!/usr/bin/env node
/**
 * The generated-runtime composition matrix (Phase 9 / Gate B, section 5).
 *
 * `tools/scripts/build-matrix.ts` proves generated games *build*. Building is
 * not entering play: `SystemHostImpl.install()` never runs during `tsc`/`vite
 * build`, so a preset whose generated `content/game.json` selects a pack the
 * generator cannot honestly configure builds perfectly and then throws the
 * moment a player presses CONFIRM. That is exactly the gap this script closes.
 *
 * The equivalence class that matters for *install* is not the controller
 * family alone (six classes - what build-matrix.ts covers) but the pair
 *
 *     (primary controller shell, the exact set of required pack ids)
 *
 * because the shell decides which template is copied and the required-pack set
 * decides what `SystemHostImpl` actually installs, with the generator's
 * `config: {}` for each. Across all 74 presets that pair takes 37 distinct
 * values. This script derives those signatures mechanically from the catalog
 * (never a hand-maintained list - a new preset with a new pack set grows the
 * matrix automatically), generates one real game per signature under `games/`
 * exactly as `sw2d new` would, really builds it, and then really *plays* it in
 * system Chrome: press CONFIRM, and assert the run actually entered
 * `sw2d.play` with every required pack plus the shell pack installed and zero
 * console errors.
 *
 * Every preset selecting `sw2d.puzzle` is additionally covered individually
 * rather than by its signature representative, because that pack is the one
 * whose config is code, not data.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PRESETS } from '@sw2d/presets';
import type { PresetDefinition } from '@sw2d/contracts';
import { buildGameFiles, writeGameFiles } from '../../packages/cli/src/generator/generate.ts';
import { shellPackId } from '../../packages/cli/src/generator/controllerTemplates.ts';
import { run } from '../../packages/cli/src/exec.ts';
import { GAMES_ROOT, REPO_ROOT } from '../../packages/cli/src/paths.ts';
import { ensureWorkspaceInstalled } from '../../packages/cli/src/workspace.ts';
import { findSystemChrome } from '../../packages/qa/src/browserPath.ts';
import { launchHarness } from '../../packages/qa/src/harness.ts';
import { readSnapshot } from '../../packages/qa/src/snapshot.ts';
import { serveStatic } from '../../packages/qa/src/staticServer.ts';

/** Packs whose `install()` reads its `config` argument at all. Asserted covered below. */
const CONFIG_READING_PACKS = ['sw2d.progression', 'sw2d.arcade', 'sw2d.puzzle'] as const;

interface Signature {
  readonly key: string;
  readonly shellPackId: string;
  readonly requiredPackIds: readonly string[];
  readonly presetIds: readonly string[];
  /** The preset actually generated and played for this signature. */
  readonly representative: PresetDefinition;
}

function signatureOf(preset: PresetDefinition): { key: string; shell: string; required: readonly string[] } {
  const shell = shellPackId(preset.controllerFamilies[0]!);
  const required = preset.requiredSystemPacks.map((s) => s.packId).slice().sort();
  return { key: `${shell}|${required.join(',')}`, shell, required };
}

/** Derived from the catalog, never hand-listed. Catalog order decides the representative, so the matrix is deterministic. */
export function deriveSignatures(): readonly Signature[] {
  const bySignature = new Map<string, { shell: string; required: readonly string[]; presets: PresetDefinition[] }>();
  for (const preset of PRESETS) {
    const { key, shell, required } = signatureOf(preset);
    const entry = bySignature.get(key) ?? { shell, required, presets: [] };
    entry.presets.push(preset);
    bySignature.set(key, entry);
  }
  return [...bySignature.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => ({
      key,
      shellPackId: entry.shell,
      requiredPackIds: entry.required,
      presetIds: entry.presets.map((p) => p.id),
      representative: entry.presets[0]!,
    }));
}

/** Signature representatives, plus every `sw2d.puzzle` preset a representative did not already pick. */
export function deriveTargets(): readonly PresetDefinition[] {
  const signatures = deriveSignatures();
  const chosen = new Map<string, PresetDefinition>(signatures.map((s) => [s.representative.id, s.representative]));
  for (const preset of PRESETS) {
    if (preset.requiredSystemPacks.some((s) => s.packId === 'sw2d.puzzle') && !chosen.has(preset.id)) {
      chosen.set(preset.id, preset);
    }
  }
  return [...chosen.values()];
}

interface TargetResult {
  readonly presetId: string;
  readonly stage: 'generate' | 'tsc' | 'build' | 'play';
  readonly ok: boolean;
  readonly detail: string;
}

async function playGeneratedGame(presetId: string, gamePath: string, expectedPacks: readonly string[]): Promise<TargetResult> {
  const server = await serveStatic(path.join(gamePath, 'dist'));
  const harness = await launchHarness();
  try {
    await harness.gotoAndWaitForRuntime(`${server.baseUrl}/index.html`);
    await harness.stepFrames(10);
    await harness.keyTap('Space'); // CONFIRM: title -> play
    await harness.stepFrames(30);

    const snapshot = await readSnapshot(harness);
    const consoleErrors = harness.consoleErrors();
    const missing = expectedPacks.filter((id) => !snapshot.installedPacks.includes(id));
    const enteredPlay = snapshot.scene === 'sw2d.play';

    const ok = enteredPlay && missing.length === 0 && consoleErrors.length === 0;
    const detail = ok
      ? `entered sw2d.play with ${snapshot.installedPacks.length} pack(s) installed`
      : [
          !enteredPlay ? `scene is ${String(snapshot.scene)}, not sw2d.play` : '',
          missing.length > 0 ? `required pack(s) never installed: ${missing.join(', ')}` : '',
          consoleErrors.length > 0 ? `console error(s): ${consoleErrors.slice(0, 2).join(' | ')}` : '',
        ]
          .filter(Boolean)
          .join('; ');
    return { presetId, stage: 'play', ok, detail };
  } finally {
    await harness.close();
    await server.close();
  }
}

async function main(): Promise<void> {
  if (!findSystemChrome()) {
    console.error('No system Chrome found. The runtime half of this matrix cannot run - see `npm run sw2d -- doctor`.');
    process.exitCode = 1;
    return;
  }

  const signatures = deriveSignatures();
  const targets = deriveTargets();

  const coveredPacks = new Set(targets.flatMap((p) => p.requiredSystemPacks.map((s) => s.packId)));
  const uncoveredConfigPacks = CONFIG_READING_PACKS.filter((id) => !coveredPacks.has(id));
  if (uncoveredConfigPacks.length > 0) {
    console.error(`Config-reading pack(s) not covered by any target: ${uncoveredConfigPacks.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Generated-runtime matrix: ${PRESETS.length} preset(s) -> ${signatures.length} distinct runtime signature(s) -> ${targets.length} real generate+build+play target(s).`,
  );
  console.log(`Config-reading packs covered: ${CONFIG_READING_PACKS.join(', ')}.`);

  const gameIds = targets.map((p) => `rtmatrix-${p.id}`.slice(0, 60));
  const gamePaths = gameIds.map((id) => path.join(GAMES_ROOT, id));

  for (const [index, preset] of targets.entries()) {
    writeGameFiles(buildGameFiles(gameIds[index]!, preset), gamePaths[index]!);
  }

  console.log('Linking npm workspace for all generated instances...');
  await ensureWorkspaceInstalled();

  const tscBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsc');
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const results: TargetResult[] = [];

  try {
    for (const [index, preset] of targets.entries()) {
      const gamePath = gamePaths[index]!;
      process.stdout.write(`${preset.id}... `);

      const tsc = await run(tscBin, ['-p', 'tsconfig.json', '--noEmit'], { cwd: gamePath });
      if (tsc.code !== 0) {
        results.push({ presetId: preset.id, stage: 'tsc', ok: false, detail: `${tsc.stdout}${tsc.stderr}`.trim() });
        console.log('FAILED (tsc)');
        continue;
      }

      const built = await run(viteBin, ['build'], { cwd: gamePath });
      if (built.code !== 0 || !existsSync(path.join(gamePath, 'dist', 'index.html'))) {
        results.push({ presetId: preset.id, stage: 'build', ok: false, detail: `${built.stdout}${built.stderr}`.trim() });
        console.log('FAILED (build)');
        continue;
      }

      const expected = [...preset.requiredSystemPacks.map((s) => s.packId), shellPackId(preset.controllerFamilies[0]!)];
      const played = await playGeneratedGame(preset.id, gamePath, expected);
      results.push(played);
      console.log(played.ok ? 'OK' : `FAILED (play) - ${played.detail}`);
    }
  } finally {
    for (const gamePath of gamePaths) rmSync(gamePath, { recursive: true, force: true });
    console.log('Cleaning up: removed all temporary games/rtmatrix-* directories, relinking workspace...');
    await ensureWorkspaceInstalled();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- generated-runtime matrix ---`);
  for (const r of results) console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.presetId}${r.ok ? '' : ` (${r.stage}) - ${r.detail.split('\n')[0]}`}`);
  console.log(`\n${results.length - failed.length}/${results.length} generated games really entered play.`);
  if (failed.length > 0) process.exitCode = 1;
}

await main();
