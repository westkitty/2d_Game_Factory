/**
 * Phase 21 defense authoring surface.
 *
 * It exposes balancing controls (funds, tower cost/range, upgrade cost,
 * capture time and score) while reporting spatial structure. A form is not a
 * substitute for drawing routes and build zones, so it deliberately refuses
 * to pretend otherwise.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { DefenseDocument } from '@sw2d/contracts';
import { validateDefenseDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { writeJsonAtomic } from './atomicJson.ts';
import { gameRoot, resolveContained } from './paths.ts';
import { SecurityError } from './security.ts';

export interface DefenseInspectResult {
  readonly document: DefenseDocument;
  readonly towerCount: number;
  readonly blockingTowerCount: number;
  readonly laneCount: number;
  readonly routeCount: number;
  readonly baseCount: number;
  readonly captureZoneCount: number;
}

function load(gameId: string): DefenseDocument {
  const path = resolveContained(gameRoot(gameId), 'content', 'defense.json');
  if (!existsSync(path)) throw new SecurityError(404, `No content/defense.json in "${gameId}".`);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new SecurityError(400, `content/defense.json in "${gameId}" is not valid JSON.`); }
  const document = validateContentBundleData({ defense: raw }).defense!.value as DefenseDocument;
  validateDefenseDocument(document);
  return document;
}

export function inspectDefense(gameId: string): DefenseInspectResult {
  const document = load(gameId);
  return {
    document,
    towerCount: document.towers?.length ?? 0,
    blockingTowerCount: document.towers?.filter((tower) => tower.blocking).length ?? 0,
    laneCount: document.lanes?.length ?? 0,
    routeCount: document.routes?.length ?? 0,
    baseCount: document.bases?.length ?? 0,
    captureZoneCount: document.captureZones?.length ?? 0,
  };
}

export function updateDefense(gameId: string, payload: unknown): { readonly ok: true; readonly document: DefenseDocument } {
  if (typeof payload !== 'object' || payload === null) throw new SecurityError(400, 'Defense update payload must be a DefenseDocument object.');
  const document = validateDocumentOrThrow('defense', 'content/defense.json', payload) as DefenseDocument;
  try { validateDefenseDocument(document); } catch (error) { throw new SecurityError(400, error instanceof Error ? error.message : String(error)); }
  writeJsonAtomic(resolveContained(gameRoot(gameId), 'content', 'defense.json'), document);
  return { ok: true, document };
}
