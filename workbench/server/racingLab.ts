/**
 * Vehicle + race authoring surface (capability program Phase 10).
 *
 * The smallest useful surface: surface the game's `content/vehicles.json`
 * (profile + the major handling numbers) and `content/races.json` (mode, lap
 * count, countdown, ordered checkpoint ids), with the structural validation
 * the runtime applies. Read-only - editing is JSON work on the files;
 * checkpoint placement uses normalized level objects in the scene composer.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RaceCatalog, VehicleCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface RacingInspectResult {
  readonly vehicles: readonly {
    readonly id: string;
    readonly profile: string;
    readonly acceleration: number;
    readonly braking: number;
    readonly maxForwardSpeed: number;
    readonly steeringRate: number;
    readonly lateralGrip: number;
    readonly driftFactor: number;
    readonly boostForce: number;
    readonly surfaces: readonly string[];
  }[];
  readonly races: readonly {
    readonly id: string;
    readonly mode: string;
    readonly laps: number;
    readonly countdownMs: number;
    readonly checkpoints: readonly string[];
    readonly startPositions: number;
  }[];
}

function loadJson(gameId: string, file: string): unknown | null {
  const full = path.join(gameRoot(gameId), 'content', file);
  return existsSync(full) ? (JSON.parse(readFileSync(full, 'utf8')) as unknown) : null;
}

export function inspectRacing(gameId: string): RacingInspectResult {
  const rawV = loadJson(gameId, 'vehicles.json');
  const rawR = loadJson(gameId, 'races.json');
  if (rawV === null && rawR === null) throw new SecurityError(404, `No content/vehicles.json or content/races.json in "${gameId}".`);

  const vCat = rawV !== null ? (validateContentBundleData({ vehicles: rawV }).vehicles!.value as VehicleCatalog) : { schemaVersion: 1, vehicles: [] };
  const rCat = rawR !== null ? (validateContentBundleData({ races: rawR }).races!.value as RaceCatalog) : { schemaVersion: 1, races: [] };

  return {
    vehicles: vCat.vehicles.map((v) => ({
      id: v.id,
      profile: v.profile,
      acceleration: v.acceleration,
      braking: v.braking,
      maxForwardSpeed: v.maxForwardSpeed,
      steeringRate: v.steeringRate,
      lateralGrip: v.lateralGrip,
      driftFactor: v.driftFactor,
      boostForce: v.boostForce,
      surfaces: Object.keys(v.surfaceModifiers ?? {}),
    })),
    races: rCat.races.map((r) => ({
      id: r.id,
      mode: r.mode,
      laps: r.laps,
      countdownMs: r.countdownMs,
      checkpoints: r.checkpoints.map((c) => c.id),
      startPositions: r.startPositions.length,
    })),
  };
}
