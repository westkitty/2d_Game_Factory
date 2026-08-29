/**
 * Run lifecycle & roguelite meta-progression authoring surface (capability program Phase 13).
 *
 * Reads and updates `content/runs.json`.
 * Validates against urn:sw2d:schema:content-runs:v1.
 * Writes atomically via writeJsonAtomic with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { RunsDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface RunsInspectResult {
  readonly runs: RunsDocument;
}

export interface RunsUpdateResult {
  readonly ok: boolean;
  readonly runs: RunsDocument;
}

function loadRunsDoc(gameId: string): RunsDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'runs.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/runs.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    throw new SecurityError(400, `content/runs.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ runs: raw });
  return validated.runs!.value as RunsDocument;
}

export function inspectRuns(gameId: string): RunsInspectResult {
  const doc = loadRunsDoc(gameId);
  return { runs: doc };
}

export function updateRuns(gameId: string, payload: unknown): RunsUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Runs update payload must be a RunsDocument object.');
  }

  // Schema validation
  const validated = validateDocumentOrThrow('runs', 'content/runs.json', payload) as RunsDocument;
  const target = resolveContained(gameRoot(gameId), 'content', 'runs.json');
  writeJsonAtomic(target, validated);

  return { ok: true, runs: validated };
}
