#!/usr/bin/env node
/**
 * `npm run release:verify` (Phase 11 section 8) - the release verification
 * matrix. Reuses the real generator, the real `sw2d pack` command
 * (checksums, resource governance, RELEASE_MANIFEST.json,
 * THIRD_PARTY_NOTICES.txt all included), and the real `@sw2d/qa` browser
 * harness. No hand-built fixtures.
 *
 * One representative generated game per controller-shell family
 * (traditional-platformer/platform, top-down-adventure/top-down,
 * asteroids-shooter/vehicle, sokoban/grid+code-configured puzzle,
 * gallery-shooter/pointer, idle-incremental/ui-simulation). For each:
 * generate -> build+typecheck+test (`sw2d validate`) -> pack -> verify
 * RELEASE_MANIFEST.json -> verify SHA256SUMS against the actual packed
 * files -> verify resource governance state -> serve the packed directory
 * (not dist/) -> launch real system Chrome -> enter play -> verify every
 * declared pack installed -> assert zero console errors -> assert zero
 * external request -> clean up.
 *
 * The first target is additionally packed a second time from the identical
 * generated source and its file tree diffed byte-for-byte against the
 * first pack - the "at least one candidate packed twice, byte-identical"
 * requirement.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getPreset } from '@sw2d/presets';
import { buildGameFiles, writeGameFiles } from '../../packages/cli/src/generator/generate.ts';
import { run as runProcess } from '../../packages/cli/src/exec.ts';
import { GAMES_ROOT, REPO_ROOT } from '../../packages/cli/src/paths.ts';
import { ensureWorkspaceInstalled } from '../../packages/cli/src/workspace.ts';
import { run as packRun } from '../../packages/cli/src/commands/pack.ts';
import { parseSha256Sums, verifyChecksums } from '../../packages/cli/src/releasePackaging/checksums.ts';

interface FamilyTarget {
  readonly family: string;
  readonly presetId: string;
}

const TARGETS: readonly FamilyTarget[] = [
  { family: 'platform', presetId: 'traditional-platformer' },
  { family: 'top-down', presetId: 'top-down-adventure' },
  { family: 'vehicle', presetId: 'asteroids-shooter' },
  { family: 'grid (code-configured puzzle path)', presetId: 'sokoban' },
  { family: 'pointer', presetId: 'gallery-shooter' },
  { family: 'ui-simulation', presetId: 'idle-incremental' },
];

function gameIdFor(presetId: string): string {
  return `release-verify-${presetId}`.slice(0, 60);
}

interface StepResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

async function verifyOne(target: FamilyTarget, doubleCheckPack: boolean): Promise<{ family: string; presetId: string; steps: StepResult[] }> {
  const gameId = gameIdFor(target.presetId);
  const gamePath = path.join(GAMES_ROOT, gameId);
  const steps: StepResult[] = [];

  // 1-2: generate + validate (typecheck, unit tests, production build).
  const preset = getPreset(target.presetId);
  writeGameFiles(buildGameFiles(gameId, preset), gamePath);
  steps.push({ name: 'generate', ok: existsSync(gamePath), detail: `games/${gameId}/` });

  const validateModule = await import('../../packages/cli/src/commands/validate.ts');
  const validateCode = await validateModule.run([gameId]);
  steps.push({ name: 'validate (typecheck + tests + build + boot smoke)', ok: validateCode === 0, detail: validateCode === 0 ? 'passed' : 'failed - see log above' });
  if (validateCode !== 0) return { family: target.family, presetId: target.presetId, steps };

  // 3: pack.
  const packCode = await packRun([gameId]);
  const packDir = path.join(gamePath, 'pack');
  steps.push({ name: 'pack', ok: packCode === 0, detail: packCode === 0 ? 'packed' : 'pack failed' });
  if (packCode !== 0) return { family: target.family, presetId: target.presetId, steps };

  // 4: verify RELEASE_MANIFEST.json.
  const manifestPath = path.join(packDir, 'RELEASE_MANIFEST.json');
  let manifestOk = false;
  let manifestDetail = 'RELEASE_MANIFEST.json missing';
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      gameId?: string;
      presetId?: string;
      resourceGovernance?: { manifestValid?: boolean; allApproved?: boolean };
    };
    manifestOk = manifest.gameId === gameId && manifest.presetId === target.presetId && manifest.resourceGovernance?.manifestValid === true;
    manifestDetail = manifestOk ? 'gameId/presetId/resourceGovernance fields consistent' : `unexpected content: ${JSON.stringify(manifest)}`;
  }
  steps.push({ name: 'verify RELEASE_MANIFEST.json', ok: manifestOk, detail: manifestDetail });

  // 5: verify SHA-256 checksums against the actual files on disk.
  const sumsPath = path.join(packDir, 'SHA256SUMS');
  let checksumsOk = false;
  let checksumsDetail = 'SHA256SUMS missing';
  if (existsSync(sumsPath)) {
    const expected = parseSha256Sums(readFileSync(sumsPath, 'utf8'));
    const mismatches = await verifyChecksums(packDir, expected);
    checksumsOk = mismatches.length === 0 && expected.length > 0;
    checksumsDetail = checksumsOk ? `${expected.length} file(s) verified` : `mismatches: ${JSON.stringify(mismatches)}`;
  }
  steps.push({ name: 'verify SHA256SUMS', ok: checksumsOk, detail: checksumsDetail });

  // 6: resource/provenance state - RELEASE_MANIFEST.json already asserted
  // manifestValid; also confirm THIRD_PARTY_NOTICES.txt exists (Phase 11
  // section 5's release-pack contract).
  const noticesOk = existsSync(path.join(packDir, 'THIRD_PARTY_NOTICES.txt'));
  steps.push({ name: 'verify THIRD_PARTY_NOTICES.txt present', ok: noticesOk, detail: noticesOk ? 'present' : 'missing' });

  // 7-13: serve the packed directory (not dist/), launch real Chrome, enter
  // play, verify declared packs installed, zero console errors, zero
  // external requests.
  const manifestForPacks = JSON.parse(readFileSync(path.join(gamePath, 'content', 'game.json'), 'utf8')) as {
    systemPacks?: readonly { packId: string }[];
  };
  const declaredPackIds = (manifestForPacks.systemPacks ?? []).map((s) => s.packId);
  const { runSmoke } = await import('@sw2d/qa');
  const smoke = await runSmoke({
    id: `${gameId}-packed`,
    buildDir: packDir,
    async run(harness) {
      type Snap = { scene: string | null; installedPacks: readonly string[] };
      const evalSnap = () => (window as unknown as { __SW2D__: { snapshot(): Snap } }).__SW2D__.snapshot();
      const title = await harness.evaluate(evalSnap);
      if (title.scene !== 'sw2d.title') return { passed: false, details: { title } };
      await harness.keyTap('Space');
      await harness.stepFrames(5);
      const playing = await harness.evaluate(evalSnap);
      const missingPacks = declaredPackIds.filter((id) => !playing.installedPacks.includes(id));
      return { passed: playing.scene === 'sw2d.play' && missingPacks.length === 0, details: { title, playing, declaredPackIds, missingPacks } };
    },
  }).catch((error: unknown) => ({ passed: false, details: {}, failureReason: String(error), id: gameId, consoleErrors: [], externalRequests: [] }));
  steps.push({
    name: 'serve packed dir + real Chrome: enter play, declared packs installed',
    ok: smoke.passed,
    detail: smoke.passed ? 'passed' : `failed: ${smoke.failureReason ?? JSON.stringify(smoke.details)}`,
  });
  steps.push({ name: 'zero console errors', ok: smoke.consoleErrors.length === 0, detail: `${smoke.consoleErrors.length} error(s)${smoke.consoleErrors[0] ? `: ${smoke.consoleErrors[0]}` : ''}` });
  steps.push({ name: 'zero external requests (offline)', ok: smoke.externalRequests.length === 0, detail: `${smoke.externalRequests.length} external request(s)` });

  // 14: byte-identical double-pack, for the designated candidate only.
  if (doubleCheckPack) {
    const firstPackCopy = mkdtempSync(path.join(tmpdir(), 'sw2d-release-verify-pack1-'));
    cpSync(packDir, firstPackCopy, { recursive: true });
    const secondPackCode = await packRun([gameId]);
    let identical = false;
    let detail = 'second pack failed';
    if (secondPackCode === 0) {
      const diff = await runProcess('diff', ['-rq', firstPackCopy, packDir], { cwd: REPO_ROOT });
      identical = diff.code === 0;
      detail = identical ? 'first and second pack are byte-identical' : diff.stdout || diff.stderr;
    }
    steps.push({ name: 'double-pack byte-identical', ok: identical, detail });
    rmSync(firstPackCopy, { recursive: true, force: true });
  }

  return { family: target.family, presetId: target.presetId, steps };
}

async function main(): Promise<number> {
  const { findSystemChrome } = await import('@sw2d/qa');
  if (!findSystemChrome()) {
    console.error('No system Chrome found. release:verify cannot run - see `npm run sw2d -- doctor`.');
    return 1;
  }

  await ensureWorkspaceInstalled();

  const results: Array<{ family: string; presetId: string; steps: StepResult[] }> = [];
  try {
    for (const [index, target] of TARGETS.entries()) {
      console.log(`\n=== ${target.family} (${target.presetId}) ===`);
      const result = await verifyOne(target, index === 0);
      results.push(result);
      for (const step of result.steps) {
        console.log(`  [${step.ok ? 'PASS' : 'FAIL'}] ${step.name} - ${step.detail}`);
      }
    }
  } finally {
    for (const target of TARGETS) {
      rmSync(path.join(GAMES_ROOT, gameIdFor(target.presetId)), { recursive: true, force: true });
    }
    console.log('\nCleaned up all temporary games/release-verify-* directories, relinking workspace...');
    await ensureWorkspaceInstalled();
  }

  console.log('\n--- release:verify summary ---');
  let allOk = true;
  for (const result of results) {
    const familyOk = result.steps.every((s) => s.ok);
    allOk &&= familyOk;
    console.log(`[${familyOk ? 'PASS' : 'FAIL'}] ${result.family} (${result.presetId})`);
  }
  console.log(allOk ? '\nrelease:verify PASSED for all controller-shell families.' : '\nrelease:verify FAILED - see steps above.');
  return allOk ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
