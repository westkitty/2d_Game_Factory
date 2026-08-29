import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome } from './browserPath.ts';
import { runSmoke } from './smokeRunner.ts';

/**
 * The one runner behind `npm run qa:proof` (Phase 10) - the flip side of
 * `runAll.ts`'s `qa:smoke`, for the five deep proof games instead of the
 * twelve Phase 8 demos. Builds each proof with a real `vite build`, then
 * runs its committed proof spec (proofs/<id>/PROOF_CONTRACT.md's defining
 * journey) through the same shared `runSmoke()` oracle qa:smoke uses (zero
 * console errors, zero external requests, plus whatever the spec itself
 * asserted).
 *
 * Targets are added here only once their proof actually exists and passes -
 * an id with no committed proof under proofs/ has no business appearing in
 * this list.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

interface Target {
  readonly id: string;
  readonly buildCwd: string;
  readonly buildDir: string;
  readonly specModule: string;
}

const PROOF_SPEC_MODULES: Readonly<Record<string, string>> = {
  'chase-platformer': 'chasePlatformer',
  'twin-stick-shooter': 'twinStickShooter',
  'tower-defense': 'towerDefense',
  sokoban: 'sokoban',
  'idle-incremental': 'idleIncremental',
  // Phase 1 - reusable spatial interaction (ADR-0018)
  'gallery-shooter': 'galleryShooter',
  'point-and-click': 'pointAndClick',
  // Phase 2 - data-driven items / effects / pickups (ADR-0019)
  'collectathon-platformer': 'collectathonPlatformer',
  'top-down-adventure': 'topDownAdventure',
  // Phase 3 - weapons & projectiles (ADR-0020)
  'run-and-gun': 'runAndGun',
};

function proofTargets(): Target[] {
  return Object.entries(PROOF_SPEC_MODULES).map(([id, specModule]) => ({
    id,
    buildCwd: path.join(REPO_ROOT, 'proofs', id),
    buildDir: path.join(REPO_ROOT, 'proofs', id, 'dist'),
    specModule,
  }));
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

  const { run } = (await import(`./../proof-specs/${target.specModule}.ts`)) as { run: Parameters<typeof runSmoke>[0]['run'] };
  const result = await runSmoke({ id: target.id, buildDir: target.buildDir, run });
  const detail = result.passed
    ? 'passed'
    : [
        result.failureReason ? `failed: ${result.failureReason}` : 'failed',
        `consoleErrors=${result.consoleErrors.length}`,
        `externalRequests=${result.externalRequests.length}`,
        result.consoleErrors.length > 0 ? `firstConsoleError=${result.consoleErrors[0]}` : '',
        `details=${JSON.stringify(result.details)}`,
      ]
        .filter(Boolean)
        .join(' ');
  return { id: target.id, ok: result.passed, detail };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('No system Chrome found. Browser proof runs cannot run - see `npm run sw2d -- doctor`.');
    return 1;
  }

  const targets = proofTargets();
  const results: { id: string; ok: boolean; detail: string }[] = [];
  for (const target of targets) {
    process.stdout.write(`Running proof ${target.id}...\n`);
    results.push(await runTarget(target));
  }

  console.log('\n--- QA proof summary ---');
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
