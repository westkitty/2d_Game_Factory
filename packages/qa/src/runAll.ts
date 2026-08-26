import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome } from './browserPath.ts';
import { runSmoke } from './smokeRunner.ts';

/**
 * The one runner behind `npm run qa:smoke` (MASTER_PROJECT.md section 18:
 * "do not create twelve unrelated runners" - this is the flip side of that
 * for running all of them together). Builds each target with a real `vite
 * build` (reproducible - no stale/hand-built dist/ required), then runs its
 * committed smoke spec through the shared `runSmoke()` oracle. Exits
 * non-zero if anything fails, so this is CI-usable as-is.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

interface Target {
  readonly id: string;
  readonly buildCwd: string;
  readonly buildDir: string;
  readonly entryPath?: string;
  readonly specModule: string;
}

const DEMO_IDS = [
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
] as const;

const DEMO_SPEC_MODULES: Readonly<Record<(typeof DEMO_IDS)[number], string>> = {
  'traditional-platformer': 'traditionalPlatformer',
  'chase-platformer': 'chasePlatformer',
  metroidvania: 'metroidvania',
  'twin-stick-shooter': 'twinStickShooter',
  'stealth-game': 'stealthGame',
  'bullet-hell': 'bulletHell',
  'top-down-racer': 'topDownRacer',
  sokoban: 'sokoban',
  'tower-defense': 'towerDefense',
  'turn-based-tactics': 'turnBasedTactics',
  'idle-incremental': 'idleIncremental',
  'visual-novel': 'visualNovel',
};

function demoTargets(): Target[] {
  return DEMO_IDS.map((id) => ({
    id,
    buildCwd: path.join(REPO_ROOT, 'demos', id),
    buildDir: path.join(REPO_ROOT, 'demos', id, 'dist'),
    specModule: DEMO_SPEC_MODULES[id],
  }));
}

function starterTargets(): Target[] {
  const buildCwd = path.join(REPO_ROOT, 'starter');
  const buildDir = path.join(REPO_ROOT, 'starter', 'dist');
  return [
    { id: 'starter-foundation', buildCwd, buildDir, entryPath: 'index.html', specModule: 'starterFoundation' },
    { id: 'starter-tiled-proof', buildCwd, buildDir, entryPath: 'tiled-proof.html', specModule: 'starterTiledProof' },
  ];
}

function build(target: Target): { ok: boolean; detail: string } {
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const result = spawnSync(viteBin, ['build'], { cwd: target.buildCwd, encoding: 'utf8' });
  const ok = result.status === 0;
  return { ok, detail: ok ? '' : (result.stderr || result.stdout || `exit ${result.status}`) };
}

async function runTarget(target: Target): Promise<{ id: string; ok: boolean; detail: string }> {
  const built = build(target);
  if (!built.ok) return { id: target.id, ok: false, detail: `build failed: ${built.detail}` };

  const { run } = (await import(`./../specs/${target.specModule}.ts`)) as { run: Parameters<typeof runSmoke>[0]['run'] };
  const result = await runSmoke({
    id: target.id,
    buildDir: target.buildDir,
    run,
    ...(target.entryPath !== undefined ? { entryPath: target.entryPath } : {}),
  });
  const detail = result.passed
    ? 'passed'
    : `failed: ${result.failureReason ?? ''} consoleErrors=${result.consoleErrors.length} externalRequests=${result.externalRequests.length}`.trim();
  return { id: target.id, ok: result.passed, detail };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('No system Chrome found. Browser smoke cannot run - see `npm run sw2d -- doctor`.');
    return 1;
  }

  const targets = [...demoTargets(), ...starterTargets()];
  const results: { id: string; ok: boolean; detail: string }[] = [];
  for (const target of targets) {
    process.stdout.write(`Running ${target.id}...\n`);
    results.push(await runTarget(target));
  }

  console.log('\n--- QA smoke summary ---');
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.id}${r.ok ? '' : ` - ${r.detail}`}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
