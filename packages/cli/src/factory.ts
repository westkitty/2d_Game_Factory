/**
 * The canonical programmatic factory service.
 *
 * `sw2d new` and the workbench host must not become two different factories
 * that happen to agree today. This module is the one place game creation
 * lives; `commands/new.ts` is a thin argv wrapper over it, and the workbench
 * calls it directly rather than spawning `npm run sw2d -- new`. Generation was
 * already a pure `(gameId, preset) => Map<path, contents>` (see
 * `generator/generate.ts`), so exposing it as a library needed no new
 * abstraction - only a named boundary.
 *
 * Subprocesses remain where the work genuinely *is* a process (`vite build`,
 * `tsc`, `vitest`). Generation is not one of those.
 */

import { getPreset } from '@sw2d/presets';
import type { PresetDefinition } from '@sw2d/contracts';
import { buildGameFiles, findUnresolvedTokens, writeGameFiles } from './generator/generate.ts';
import { GAMES_ROOT, assertDoesNotExist, resolveUnder } from './paths.ts';
import { assertValidSlug } from './slug.ts';

/**
 * The only directories an overlay may write into.
 *
 * These are exactly the surfaces `README.md`'s "one rule" calls normal game
 * work. A starter kit that wants to touch `packages/`, `vite.config.ts` or
 * anything else is not a starter kit - it is an engine change wearing a
 * costume, and `assertOverlayContained` refuses it before a single byte is
 * written.
 */
export const OVERLAY_ROOTS: readonly string[] = ['content/', 'themes/', 'public/', 'resources/', 'src/game-specific/'];

export class OverlayContainmentError extends Error {
  readonly offendingPaths: readonly string[];
  constructor(offendingPaths: readonly string[]) {
    super(
      `Refusing an overlay that writes outside normal game surfaces: ${offendingPaths.join(', ')}. ` +
        `Allowed roots: ${OVERLAY_ROOTS.join(', ')}.`,
    );
    this.name = 'OverlayContainmentError';
    this.offendingPaths = offendingPaths;
  }
}

/** Throws OverlayContainmentError naming every offending path, not just the first - a kit author should see all of them at once. */
export function assertOverlayContained(paths: Iterable<string>): void {
  const offending: string[] = [];
  for (const relativePath of paths) {
    const normalized = relativePath.replaceAll('\\', '/');
    const escapes = normalized.startsWith('/') || normalized.split('/').includes('..');
    const allowed = OVERLAY_ROOTS.some((root) => normalized.startsWith(root));
    if (escapes || !allowed) offending.push(relativePath);
  }
  if (offending.length > 0) throw new OverlayContainmentError(offending);
}

export interface CreateGameRequest {
  readonly gameId: string;
  readonly presetId: string;
  /** Files written on top of canonical generation. Every path is containment-checked before any write happens. */
  readonly overlay?: ReadonlyMap<string, string>;
}

export interface CreateGameResult {
  readonly gameId: string;
  readonly presetId: string;
  readonly preset: PresetDefinition;
  readonly targetPath: string;
  readonly fileCount: number;
  readonly overlaidPaths: readonly string[];
}

/** Generate a real, runnable game through the one canonical path. */
export function createGame(request: CreateGameRequest): CreateGameResult {
  assertValidSlug('game id', request.gameId);
  const preset = getPreset(request.presetId);

  const targetPath = resolveUnder(GAMES_ROOT, request.gameId);
  assertDoesNotExist(`Game "${request.gameId}"`, targetPath);

  const files = new Map(buildGameFiles(request.gameId, preset));
  const overlaidPaths: string[] = [];
  if (request.overlay && request.overlay.size > 0) {
    assertOverlayContained(request.overlay.keys());
    for (const [relativePath, contents] of request.overlay) {
      files.set(relativePath, contents);
      overlaidPaths.push(relativePath);
    }
  }

  const unresolved = findUnresolvedTokens(files);
  if (unresolved.length > 0) {
    throw new Error(`Generator error: unresolved template token(s) ${unresolved.join(', ')}. Not writing "${request.gameId}".`);
  }

  writeGameFiles(files, targetPath);
  return {
    gameId: request.gameId,
    presetId: request.presetId,
    preset,
    targetPath,
    fileCount: files.size,
    overlaidPaths: overlaidPaths.sort(),
  };
}

export { buildGameFiles, findUnresolvedTokens, writeGameFiles } from './generator/generate.ts';
export { generateGameManifest, generateResourceManifest, generateTheme, generateTiledLevel, generateTuning } from './generator/contentDocuments.ts';
export { GAMES_ROOT, REPO_ROOT, PathEscapeError, TargetExistsError, assertDoesNotExist, resolveUnder } from './paths.ts';
export { InvalidSlugError, assertValidSlug } from './slug.ts';
export { WORKSPACE_REQUIRED_PATHS, ensureWorkspaceInstalled } from './workspace.ts';
