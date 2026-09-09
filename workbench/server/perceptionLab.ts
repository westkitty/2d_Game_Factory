/**
 * Perception authoring surface (Category-C Wave 4 / ADR-0031).
 *
 * The smallest useful surface: surface the game's `content/perception.json`
 * (mode, observers, cover, objectives). Read-only - editing is JSON work on
 * the file. Live suspicion belongs on the in-game debug snapshot.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PerceptionCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface PerceptionInspectResult {
  readonly present: boolean;
  readonly mode: string;
  readonly observerCount: number;
  readonly coverCount: number;
  readonly objectiveCount: number;
  readonly exitCount: number;
  readonly observers: readonly { readonly id: string; readonly fovDeg: number; readonly range: number }[];
}

export function inspectPerception(gameId: string): PerceptionInspectResult {
  const full = path.join(gameRoot(gameId), 'content', 'perception.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/perception.json in "${gameId}".`);
  const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
  const catalog = validateContentBundleData({ perception: raw }).perception!.value as PerceptionCatalog;
  return {
    present: catalog.observers.length > 0,
    mode: catalog.mode,
    observerCount: catalog.observers.length,
    coverCount: catalog.cover?.length ?? 0,
    objectiveCount: catalog.objectives?.length ?? 0,
    exitCount: catalog.exits?.length ?? 0,
    observers: catalog.observers.map((o) => ({ id: o.id, fovDeg: o.fovDeg, range: o.range })),
  };
}
