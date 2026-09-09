/**
 * Ball / paddle authoring surface (Category-C Wave 5 / ADR-0032).
 *
 * The smallest useful surface: surface the game's `content/ball-paddle.json`
 * (mode, bricks, lives, pong win score). Read-only - editing is JSON work on
 * the file. Live paddle/ball belong on the in-game debug snapshot.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { BallPaddleCatalog } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface BallPaddleInspectResult {
  readonly present: boolean;
  readonly mode: string;
  readonly brickCount: number;
  readonly lives: number;
  readonly winScore: number | null;
  readonly paddleAxis: string;
}

export function inspectBallPaddle(gameId: string): BallPaddleInspectResult {
  const full = path.join(gameRoot(gameId), 'content', 'ball-paddle.json');
  if (!existsSync(full)) throw new SecurityError(404, `No content/ball-paddle.json in "${gameId}".`);
  const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
  const catalog = validateContentBundleData({ 'ball-paddle': raw })['ball-paddle']!.value as BallPaddleCatalog;
  const present = catalog.mode === 'pong' ? catalog.pong !== undefined : catalog.bricks.length > 0;
  return {
    present,
    mode: catalog.mode,
    brickCount: catalog.bricks.length,
    lives: catalog.lives,
    winScore: catalog.pong?.winScore ?? null,
    paddleAxis: catalog.paddle.axis,
  };
}
