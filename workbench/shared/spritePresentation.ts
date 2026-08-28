/**
 * Presentation intelligence for imported sprites.
 *
 * Pure, DOM- and Node-free, shared by the host and the UI. It reads frame
 * *names* and *alpha shape* and offers presentation suggestions - animation
 * states, directional variants, a visual pivot. Every output is a suggestion,
 * never a decision:
 *
 *  - `idle` / `walk` / `run` / `move` are inferred with `confident` confidence
 *    because those tokens are unambiguous;
 *  - `attack` / `hurt` / `death` / `jump` and friends are only ever `suggested`
 *    - a filename is not permission to manufacture a semantic animation state;
 *  - a static fallback frame is always identified, so existing static role art
 *    stays valid whether or not any animation is used (architectural law 5);
 *  - a visual pivot / trimmed-bounds suggestion never implies a collision
 *    change - the note says so.
 *
 * Nothing here is load-bearing for gameplay. It is authoring metadata that a
 * person confirms.
 */

import type { RectSpec } from './types.ts';

export type PresentationConfidence = 'confident' | 'suggested';

export interface PresentationFrameRef {
  /** Stable id for the frame (asset id, staging id, cell index as string). */
  readonly ref: string;
  /** The file/display name the classification reads. */
  readonly name: string;
  readonly frameIndex?: number;
}

export interface PresentationState {
  /** 'idle' | 'walk' | 'run' | 'move' | 'attack' | ... | 'default'. */
  readonly state: string;
  readonly confidence: PresentationConfidence;
  /** Frame refs in play order. */
  readonly frames: readonly string[];
}

export type Direction = 'left' | 'right' | 'up' | 'down' | 'north' | 'south' | 'east' | 'west' | 'ne' | 'nw' | 'se' | 'sw';

export interface DirectionalVariant {
  readonly direction: Direction;
  readonly frames: readonly string[];
}

export interface PresentationSummary {
  readonly states: readonly PresentationState[];
  readonly directions: readonly DirectionalVariant[];
  /** The frame to draw when nothing is animating. Non-null whenever there is at least one frame. */
  readonly staticFallbackRef: string | null;
  readonly totalFrames: number;
  /** True when the only state is the synthetic 'default' bucket - i.e. names carried no animation vocabulary. */
  readonly namesWereUninformative: boolean;
}

const CONFIDENT_STATES = ['idle', 'walk', 'run', 'move'] as const;
const SUGGESTED_STATES = [
  'attack', 'hit', 'hurt', 'damage', 'death', 'die', 'dead', 'jump', 'fall', 'land', 'crouch', 'slide',
  'climb', 'shoot', 'fire', 'cast', 'block', 'roll', 'dash', 'spawn', 'win', 'lose',
] as const;

const DIRECTION_TOKENS: Readonly<Record<string, Direction>> = {
  left: 'left', right: 'right', up: 'up', down: 'down',
  north: 'north', south: 'south', east: 'east', west: 'west',
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'ne', nw: 'nw', se: 'se', sw: 'sw',
};

function tokens(name: string): readonly string[] {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[\s_\-.]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^\d+$/.test(part));
}

function stateOf(name: string): { state: string; confidence: PresentationConfidence } {
  const parts = tokens(name);
  for (const part of parts) if ((CONFIDENT_STATES as readonly string[]).includes(part)) return { state: part, confidence: 'confident' };
  for (const part of parts) if ((SUGGESTED_STATES as readonly string[]).includes(part)) return { state: part, confidence: 'suggested' };
  return { state: 'default', confidence: 'suggested' };
}

function directionOf(name: string): Direction | null {
  for (const part of tokens(name)) {
    const dir = DIRECTION_TOKENS[part];
    if (dir) return dir;
  }
  return null;
}

function orderFrames(refs: readonly PresentationFrameRef[]): readonly string[] {
  return [...refs]
    .sort((a, b) => {
      const ai = a.frameIndex ?? Number.MAX_SAFE_INTEGER;
      const bi = b.frameIndex ?? Number.MAX_SAFE_INTEGER;
      return ai - bi || a.name.localeCompare(b.name, undefined, { numeric: true });
    })
    .map((ref) => ref.ref);
}

/** Classifies a set of frames belonging to one group. */
export function classifyFrames(refs: readonly PresentationFrameRef[]): PresentationSummary {
  if (refs.length === 0) {
    return { states: [], directions: [], staticFallbackRef: null, totalFrames: 0, namesWereUninformative: true };
  }

  const byState = new Map<string, { confidence: PresentationConfidence; refs: PresentationFrameRef[] }>();
  const byDirection = new Map<Direction, PresentationFrameRef[]>();

  for (const ref of refs) {
    const { state, confidence } = stateOf(ref.name);
    const bucket = byState.get(state) ?? { confidence, refs: [] };
    // A confident classification anywhere in the bucket wins.
    bucket.confidence = bucket.confidence === 'confident' || confidence === 'confident' ? 'confident' : 'suggested';
    bucket.refs.push(ref);
    byState.set(state, bucket);

    const dir = directionOf(ref.name);
    if (dir) {
      const dirBucket = byDirection.get(dir) ?? [];
      dirBucket.push(ref);
      byDirection.set(dir, dirBucket);
    }
  }

  const states: PresentationState[] = [...byState.entries()]
    .map(([state, bucket]) => ({
      state,
      // The synthetic 'default' bucket is never "confident".
      confidence: state === 'default' ? ('suggested' as const) : bucket.confidence,
      frames: orderFrames(bucket.refs),
    }))
    .sort((a, b) => {
      const rank = (s: PresentationState): number => (s.state === 'idle' ? 0 : s.state === 'default' ? 9 : s.confidence === 'confident' ? 1 : 2);
      return rank(a) - rank(b) || a.state.localeCompare(b.state);
    });

  const directions: DirectionalVariant[] = [...byDirection.entries()]
    .map(([direction, dirRefs]) => ({ direction, frames: orderFrames(dirRefs) }))
    .sort((a, b) => a.direction.localeCompare(b.direction));

  // Static fallback: an idle frame first, else the lowest-index frame overall.
  const idle = states.find((s) => s.state === 'idle');
  const staticFallbackRef = idle?.frames[0] ?? orderFrames(refs)[0] ?? null;

  const namesWereUninformative = states.length === 1 && states[0]!.state === 'default';

  return { states, directions, staticFallbackRef, totalFrames: refs.length, namesWereUninformative };
}

// ---------------------------------------------------------------------------
// Visual origin / footprint suggestion (never a collision change)
// ---------------------------------------------------------------------------

export interface VisualBoundsSuggestion {
  /** Trimmed visible bounds, or null when the image is fully transparent / opaque with no alpha. */
  readonly trimmed: RectSpec | null;
  readonly pivot: 'center' | 'bottom-center';
  /** Visible area / full area, 0..1. */
  readonly footprintRatio: number;
  readonly note: string;
}

export interface VisualBoundsInput {
  readonly width: number;
  readonly height: number;
  readonly alphaBounds: RectSpec | null;
  readonly hasAlpha: boolean;
}

/**
 * Suggests a pivot and trimmed footprint from alpha shape. The output is
 * advice for the person mapping the sprite; it does not, and must not,
 * silently become a gameplay hitbox.
 */
export function suggestVisualBounds(input: VisualBoundsInput): VisualBoundsSuggestion {
  const note = 'Suggestion only - this does not change the game’s collision. Adjust collision explicitly if you want it to match.';
  const full = Math.max(1, input.width * input.height);

  if (!input.hasAlpha || !input.alphaBounds) {
    return { trimmed: null, pivot: 'center', footprintRatio: 1, note };
  }

  const b = input.alphaBounds;
  const footprintRatio = Math.min(1, (b.width * b.height) / full);
  // A visible mass sitting in the lower ~60% reads as a standing actor.
  const bottomEdge = b.y + b.height;
  const pivot: VisualBoundsSuggestion['pivot'] = bottomEdge >= input.height * 0.9 && b.y > input.height * 0.15 ? 'bottom-center' : 'center';

  return { trimmed: b, pivot, footprintRatio, note };
}
