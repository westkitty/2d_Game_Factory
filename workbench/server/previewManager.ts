/**
 * Preview lifecycle.
 *
 * Both preview modes run the *real* generated Phaser game - Fast Preview via
 * the game's own `vite` dev server, Production Preview via a static server
 * over a real `vite build`. There is no editor-side mock renderer anywhere in
 * this product; the preview pane is an iframe pointed at one of these
 * (failure condition F09, acceptance W20).
 *
 * Three things this file exists to get right:
 *
 *  - every child process is tracked and killed, on stop and on host exit, so
 *    a session never leaves an orphaned dev server holding a port;
 *  - ports are OS-assigned, never fixed, so the workbench cannot collide with
 *    an unrelated service the user is already running;
 *  - a build carries a generation number, and a slow one that finishes after
 *    a newer one has already landed is discarded rather than overwriting it.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { serveStatic, type StaticServerHandle } from '@sw2d/qa';
import type { PreviewMode, PreviewState } from '../shared/types.ts';
import { gameRoot, resolveContained } from './paths.ts';
import { SecurityError, assertValidGameId } from './security.ts';

interface PreviewRecord {
  state: PreviewState;
  child: ChildProcess | null;
  server: StaticServerHandle | null;
}

const PREVIEWS = new Map<string, PreviewRecord>();
let generationCounter = 0;

export function nextGeneration(): number {
  return ++generationCounter;
}

/** Reads the dev server's own "Local: http://..." announcement rather than guessing a port. */
function parseViteUrl(text: string): string | null {
  const match = /(https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?)/.exec(text);
  return match ? match[1]!.replace(/\/$/, '') : null;
}

/**
 * Starts (or restarts) a Fast Preview: the generated game's own dev server,
 * bound to loopback on an OS-assigned port.
 *
 * `--host 127.0.0.1` is explicit rather than relying on Vite's default, and
 * `--port 0` asks the OS for a free port. Both matter: a preview that bound
 * to `0.0.0.0` would put a user's in-progress game on their local network.
 */
export async function startFastPreview(gameId: string): Promise<PreviewState> {
  assertValidGameId(gameId);
  const root = gameRoot(gameId);
  if (!existsSync(root)) throw new SecurityError(404, `No project "${gameId}".`);
  await stopPreview(gameId);

  const generation = nextGeneration();
  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '0', '--strictPort', 'false'], { cwd: root, shell: false });

  const url = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('The dev server did not report a URL within 30 seconds.'));
    }, 30_000);

    const onData = (chunk: Buffer): void => {
      const found = parseViteUrl(chunk.toString());
      if (!found || settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(found);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`The dev server exited with code ${String(code)} before reporting a URL.`));
    });
  });

  const state: PreviewState = { gameId, mode: 'fast', url, generation, status: 'ready' };
  PREVIEWS.set(gameId, { state, child, server: null });
  return state;
}

/**
 * Starts a Production Preview over an already-built `dist/`.
 *
 * Reuses `@sw2d/qa`'s static server rather than adding a second one: it
 * already binds loopback on a free port and already contains its own path
 * traversal check, and having one file server in the repository is worth more
 * than saving an import.
 */
export async function startProductionPreview(gameId: string): Promise<PreviewState> {
  assertValidGameId(gameId);
  const dist = resolveContained(gameRoot(gameId), 'dist');
  if (!existsSync(resolveContained(dist, 'index.html'))) {
    throw new SecurityError(409, `"${gameId}" has no production build yet. Run Build first.`);
  }
  await stopPreview(gameId);

  const generation = nextGeneration();
  const server = await serveStatic(dist);
  const state: PreviewState = { gameId, mode: 'production', url: server.baseUrl, generation, status: 'ready' };
  PREVIEWS.set(gameId, { state, child: null, server });
  return state;
}

export function currentPreview(gameId: string): PreviewState | null {
  return PREVIEWS.get(gameId)?.state ?? null;
}

/**
 * Records the outcome of a background rebuild, refusing anything stale.
 *
 * Without this, a slow build started at generation 4 could finish after a
 * fast one from generation 7 and quietly put the preview back to older
 * output - the classic race that makes a live preview untrustworthy.
 */
export function applyRebuildResult(gameId: string, generation: number, status: PreviewState['status'], error?: string): PreviewState | null {
  const record = PREVIEWS.get(gameId);
  if (!record) return null;
  if (generation < record.state.generation) return record.state;
  record.state = { ...record.state, generation, status, ...(error !== undefined ? { error } : {}) };
  return record.state;
}

export async function stopPreview(gameId: string): Promise<void> {
  const record = PREVIEWS.get(gameId);
  if (!record) return;
  PREVIEWS.delete(gameId);
  if (record.child) {
    record.child.kill('SIGTERM');
    // A dev server that ignores SIGTERM is still a process holding a port.
    const child = record.child;
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 3000).unref();
  }
  if (record.server) await record.server.close();
}

export async function stopAllPreviews(): Promise<void> {
  await Promise.all([...PREVIEWS.keys()].map((gameId) => stopPreview(gameId)));
}

export function listPreviews(): readonly PreviewState[] {
  return [...PREVIEWS.values()].map((record) => record.state);
}

export function previewModeOf(value: unknown): PreviewMode {
  if (value === 'fast' || value === 'production') return value;
  throw new SecurityError(400, `Unknown preview mode ${JSON.stringify(value)}.`);
}
