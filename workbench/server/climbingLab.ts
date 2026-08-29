/**
 * Climbing & wall traversal authoring surface (capability program Phase 12).
 *
 * A structured read-only view of `content/climbing.json` (wall-slide speed,
 * friction, wall-jump velocities, wall-stick duration, ledge-grab tolerances,
 * ladder climb speed, and ledge climbing toggle).
 *
 * Calls `POST /api/climbing/inspect`.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ClimbingConfig } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface ClimbingInspectResult {
  readonly config: {
    readonly wallSlideMaxSpeed: number;
    readonly wallFriction: number;
    readonly wallJumpVelocityX: number;
    readonly wallJumpVelocityY: number;
    readonly wallStickMs: number;
    readonly ledgeGrabToleranceX: number;
    readonly ledgeGrabToleranceY: number;
    readonly ladderClimbSpeed: number;
    readonly enableLedgeClimb: boolean;
  };
}

function loadJson(gameId: string, file: string): unknown | null {
  const full = path.join(gameRoot(gameId), 'content', file);
  return existsSync(full) ? (JSON.parse(readFileSync(full, 'utf8')) as unknown) : null;
}

export function inspectClimbing(gameId: string): ClimbingInspectResult {
  const raw = loadJson(gameId, 'climbing.json');
  if (raw === null) throw new SecurityError(404, `No content/climbing.json in "${gameId}".`);

  const config = validateContentBundleData({ climbing: raw }).climbing!.value as ClimbingConfig;

  return {
    config: {
      wallSlideMaxSpeed: config.wallSlideMaxSpeed,
      wallFriction: config.wallFriction,
      wallJumpVelocityX: config.wallJumpVelocityX,
      wallJumpVelocityY: config.wallJumpVelocityY,
      wallStickMs: config.wallStickMs,
      ledgeGrabToleranceX: config.ledgeGrabToleranceX,
      ledgeGrabToleranceY: config.ledgeGrabToleranceY,
      ladderClimbSpeed: config.ladderClimbSpeed,
      enableLedgeClimb: config.enableLedgeClimb ?? false,
    },
  };
}
