/**
 * Ball & paddle authoring surface (post-ten program Phase 16).
 *
 * Reads and updates `content/ball-paddle.json` - the document that IS the game
 * for Breakout and Pong. The editable fields are the ones a creator actually
 * tunes for feel: ball speed and its bounds, the per-hit speed increase, the
 * steering authority of a paddle hit, paddle size and speed, and the match rules.
 *
 * Arena geometry and the brick layout are reported but not edited here: placing
 * bricks is a spatial job the Scene Composer already owns, and duplicating it in
 * a numeric form would give two answers to where a brick is.
 *
 * Validates against urn:sw2d:schema:content-ball-paddle:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { BallPaddleDocument } from '@sw2d/contracts';
import { validateBallPaddleDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface BallPaddleInspectResult {
  readonly document: BallPaddleDocument;
  readonly brickCount: number;
  readonly paddleCount: number;
  /** Edge behaviours, so the panel can say whether this is a Breakout or a Pong. */
  readonly edgeSummary: readonly { readonly edge: string; readonly behavior: string; readonly scoresFor: string | null }[];
}

export interface BallPaddleUpdateResult {
  readonly ok: boolean;
  readonly document: BallPaddleDocument;
}

function loadDocument(gameId: string): BallPaddleDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'ball-paddle.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/ball-paddle.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/ball-paddle.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ 'ball-paddle': raw })['ball-paddle']!.value as BallPaddleDocument;
  validateBallPaddleDocument(validated);
  return validated;
}

export function inspectBallPaddle(gameId: string): BallPaddleInspectResult {
  const document = loadDocument(gameId);
  return {
    document,
    brickCount: document.layout?.length ?? 0,
    paddleCount: document.paddles.length,
    edgeSummary: document.arena.edges.map((edge) => ({
      edge: edge.edge,
      behavior: edge.behavior,
      scoresFor: edge.scoresFor ?? null,
    })),
  };
}

export function updateBallPaddle(gameId: string, payload: unknown): BallPaddleUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Ball/paddle update payload must be a BallPaddleDocument object.');
  }
  const validated = validateDocumentOrThrow('ball-paddle', 'content/ball-paddle.json', payload) as BallPaddleDocument;
  // The schema cannot express speed ordering, the axis/facing agreement, or that
  // a bounce angle below 90 degrees is what stops a ball grinding along a paddle.
  try {
    validateBallPaddleDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'ball-paddle.json');
  writeJsonAtomic(target, validated);
  return { ok: true, document: validated };
}
