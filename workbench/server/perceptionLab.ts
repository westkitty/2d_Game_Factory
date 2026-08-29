/**
 * AI Perception authoring surface (capability program Phase 11).
 *
 * A structured read-only view of `content/perception.json` (sensors:
 * vision range, field of view, awareness gain/decay, memory, hearing range/multiplier,
 * and pursuits: safe/danger/capture distances, grace period).
 *
 * Calls `POST /api/perception/inspect`.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PerceptionCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface PerceptionInspectResult {
  readonly sensors: readonly {
    readonly id: string;
    readonly visionRange: number;
    readonly fieldOfViewDegrees: number;
    readonly awarenessGainPerSecond: number;
    readonly awarenessDecayPerSecond: number;
    readonly memoryMs: number;
    readonly hearingRange: number;
    readonly hearingMultiplier: number;
  }[];
  readonly pursuits: readonly {
    readonly pursuerId: string;
    readonly targetId: string;
    readonly safeDistance: number;
    readonly dangerDistance: number;
    readonly captureDistance: number;
    readonly graceMs: number;
  }[];
}

function loadJson(gameId: string, file: string): unknown | null {
  const full = path.join(gameRoot(gameId), 'content', file);
  return existsSync(full) ? (JSON.parse(readFileSync(full, 'utf8')) as unknown) : null;
}

export function inspectPerception(gameId: string): PerceptionInspectResult {
  const raw = loadJson(gameId, 'perception.json');
  if (raw === null) throw new SecurityError(404, `No content/perception.json in "${gameId}".`);

  const catalog = validateContentBundleData({ perception: raw }).perception!.value as PerceptionCatalog;

  return {
    sensors: catalog.sensors.map((s) => ({
      id: s.id,
      visionRange: s.visionRange,
      fieldOfViewDegrees: s.fieldOfViewDegrees,
      awarenessGainPerSecond: s.awarenessGainPerSecond,
      awarenessDecayPerSecond: s.awarenessDecayPerSecond,
      memoryMs: s.memoryMs,
      hearingRange: s.hearingRange,
      hearingMultiplier: s.hearingMultiplier,
    })),
    pursuits: (catalog.pursuits ?? []).map((p) => ({
      pursuerId: p.pursuerId,
      targetId: p.targetId,
      safeDistance: p.safeDistance,
      dangerDistance: p.dangerDistance,
      captureDistance: p.captureDistance,
      graceMs: p.graceMs,
    })),
  };
}
