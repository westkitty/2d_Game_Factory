/**
 * The workbench's bridge to the canonical factory.
 *
 * Generation goes through `@sw2d/cli/factory`'s `createGame` - the exact
 * function `sw2d new` calls - so the two can never diverge (acceptance W15,
 * failure condition F08). Nothing here re-implements generation, and nothing
 * here shells out to run the CLI.
 *
 * Validate / build / pack *are* genuinely process work (`vite`, `tsc`,
 * `vitest`, and the CLI's own pack command). Those run with a fixed
 * executable, an argument array, `shell: false`, and a working directory
 * inside this repository. No caller-supplied string ever reaches an argv
 * position that is not a slug this module has already validated.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createGame, ensureWorkspaceInstalled } from '@sw2d/cli/factory';
import { getPreset } from '@sw2d/presets';
import type { ProjectDocument } from '../shared/types.ts';
import { DEFAULT_PANEL_STATE } from '../shared/types.ts';
import { REPO_ROOT, gameRoot, resolveContained } from './paths.ts';
import { SecurityError, assertValidGameId } from './security.ts';
import { saveProject } from './projectStore.ts';
import { starterKitFor } from './starterKits/index.ts';
import type { JobHandle } from './jobManager.ts';

export interface ProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * The only place this product starts a subprocess.
 *
 * `shell: false` is not a default worth trusting silently, so it is written
 * out. `command` is always one of a small set of literals chosen by this
 * module; `args` entries are literals or already-validated slugs.
 */
export function runProcess(
  command: 'npx' | 'npm' | 'node',
  args: readonly string[],
  cwd: string,
  handle?: JobHandle,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    let cancelled = false;

    const poll = handle
      ? setInterval(() => {
          if (!handle.cancelled() || cancelled) return;
          cancelled = true;
          child.kill('SIGTERM');
        }, 250)
      : null;

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (poll) clearInterval(poll);
      reject(error);
    });
    child.on('close', (code) => {
      if (poll) clearInterval(poll);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** The last few meaningful lines of a tool's output - what the Activity panel shows instead of a wall of text. */
export function tailLines(text: string, count = 12): readonly string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-count);
}

export interface CreateProjectRequest {
  readonly gameId: string;
  readonly presetId: string;
  readonly displayName?: string;
  /** When false, the canonical generated shell is used with no kit overlay. Defaults to true. */
  readonly useStarterKit?: boolean;
}

export interface CreateProjectResult {
  readonly project: ProjectDocument;
  readonly starterKitDepth: string;
  readonly overlaidPaths: readonly string[];
  readonly fileCount: number;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function createProject(request: CreateProjectRequest): CreateProjectResult {
  const gameId = assertValidGameId(request.gameId);
  const preset = getPreset(request.presetId);
  const displayName = request.displayName?.trim() || titleCase(gameId);

  const kit = request.useStarterKit === false ? undefined : starterKitFor(request.presetId);
  const overlay = kit?.overlay(gameId, displayName);

  const result = createGame({
    gameId,
    presetId: request.presetId,
    ...(overlay ? { overlay } : {}),
  });

  const project: ProjectDocument = {
    version: 1,
    gameId,
    presetId: request.presetId,
    displayName,
    ...(kit ? { starterKitId: kit.presetId } : {}),
    panels: DEFAULT_PANEL_STATE,
  };
  saveProject(project);

  return {
    project,
    starterKitDepth: kit?.depth ?? (preset.maturity === 'smoke-validated' ? 'smoke-kit' : 'generated-shell'),
    overlaidPaths: result.overlaidPaths,
    fileCount: result.fileCount,
  };
}

// ---------------------------------------------------------------------------
// Pipeline operations
// ---------------------------------------------------------------------------

function requireProject(gameId: string): string {
  assertValidGameId(gameId);
  const root = gameRoot(gameId);
  if (!existsSync(root)) throw new SecurityError(404, `No project "${gameId}" under games/.`);
  return root;
}

/**
 * Links a freshly-created game into the npm workspace so its `@sw2d/*` and
 * `phaser` imports resolve from the repository's own `node_modules`.
 *
 * This deliberately delegates to the CLI's canonical workspace helper. That
 * helper is offline-only and package-lock-free, so creating or operating on a
 * scratch game cannot dirty the tracked lockfile and cannot silently reach the
 * registry.
 */
export async function ensureWorkspaceLinked(handle?: JobHandle): Promise<void> {
  handle?.setStep('Linking workspace');
  await ensureWorkspaceInstalled();
}

export interface PipelineOutcome {
  readonly ok: boolean;
  readonly steps: readonly { readonly name: string; readonly ok: boolean; readonly detail: readonly string[] }[];
}

export async function buildProject(gameId: string, handle: JobHandle): Promise<PipelineOutcome> {
  const root = requireProject(gameId);
  await ensureWorkspaceLinked(handle);
  handle.setStep('Production build');
  const result = await runProcess('npx', ['vite', 'build'], root, handle);
  const ok = result.code === 0;
  handle.log(ok ? 'Build succeeded.' : 'Build failed.');
  return { ok, steps: [{ name: 'Production build', ok, detail: tailLines(ok ? result.stdout : result.stderr || result.stdout) }] };
}

/**
 * The validation ladder, run from the UI.
 *
 * The same sequence `sw2d validate` runs - schema/unit tests, TypeScript,
 * production build - and it reports each step separately so a failure names
 * itself rather than collapsing to "validation failed". Browser smoke is the
 * CLI's job and is not duplicated here; `qa:workbench` covers the browser
 * layer for workbench-created games.
 */
export async function validateProject(gameId: string, handle: JobHandle): Promise<PipelineOutcome> {
  const root = requireProject(gameId);
  await ensureWorkspaceLinked(handle);

  const steps: { name: string; ok: boolean; detail: readonly string[] }[] = [];

  handle.setStep('Schema and unit tests');
  handle.setProgress(0.15);
  const tests = await runProcess('npx', ['vitest', 'run', '--config', resolveContained(REPO_ROOT, 'vitest.config.ts'), `games/${gameId}/tests`], REPO_ROOT, handle);
  steps.push({ name: 'Schema/content validation + unit tests', ok: tests.code === 0, detail: tailLines(tests.stdout || tests.stderr) });

  handle.throwIfCancelled();
  handle.setStep('TypeScript');
  handle.setProgress(0.45);
  const tsc = await runProcess('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit'], root, handle);
  steps.push({ name: 'TypeScript', ok: tsc.code === 0, detail: tailLines(tsc.stdout || tsc.stderr) });

  handle.throwIfCancelled();
  handle.setStep('Production build');
  handle.setProgress(0.75);
  const build = await runProcess('npx', ['vite', 'build'], root, handle);
  steps.push({ name: 'Production build', ok: build.code === 0, detail: tailLines(build.stdout || build.stderr) });

  handle.setProgress(1);
  return { ok: steps.every((step) => step.ok), steps };
}

/**
 * Packs a release candidate through the CLI's own `pack` command.
 *
 * Deliberately the CLI and not a reimplementation: `pack` is where resource
 * governance is enforced, and that gate must stay in exactly one place. A
 * project with an unknown-provenance asset is refused here for the same
 * reason and by the same code as on the command line (W24 / F14).
 */
export async function packProject(gameId: string, handle: JobHandle): Promise<PipelineOutcome> {
  assertValidGameId(gameId);
  requireProject(gameId);
  await ensureWorkspaceLinked(handle);
  handle.setStep('Packing release candidate');
  const result = await runProcess(
    'node',
    ['--experimental-strip-types', resolveContained(REPO_ROOT, 'packages', 'cli', 'src', 'bin.ts'), 'pack', gameId],
    REPO_ROOT,
    handle,
  );
  const ok = result.code === 0;
  return {
    ok,
    steps: [{ name: 'Pack', ok, detail: tailLines(ok ? result.stdout : result.stderr || result.stdout, 16) }],
  };
}
