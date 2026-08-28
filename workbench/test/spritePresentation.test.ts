/**
 * Phase E: intelligent sprite presentation.
 *
 * The classifier is pure. These lock the two rules that matter: idle/walk/run
 * are inferred confidently, everything more specific is only ever "suggested",
 * and a static fallback frame is always identified so static role art stays
 * valid.
 */

import { describe, expect, it } from 'vitest';
import { classifyFrames, suggestVisualBounds, type PresentationFrameRef } from '../shared/spritePresentation.ts';

// No explicit frameIndex: ordering falls to the classifier's numeric name sort,
// which is the realistic case for a folder of `walk_0.png`, `walk_1.png`, ...
function frames(names: readonly string[]): PresentationFrameRef[] {
  return names.map((name, index) => ({ ref: `f${index}`, name }));
}

describe('classifyFrames', () => {
  it('infers walk and idle with confidence and orders frames', () => {
    const summary = classifyFrames(frames(['hero_walk_0.png', 'hero_walk_1.png', 'hero_walk_2.png', 'hero_idle_0.png', 'hero_idle_1.png']));
    const walk = summary.states.find((s) => s.state === 'walk')!;
    const idle = summary.states.find((s) => s.state === 'idle')!;
    expect(walk.confidence).toBe('confident');
    expect(walk.frames).toEqual(['f0', 'f1', 'f2']);
    expect(idle.confidence).toBe('confident');
    expect(summary.totalFrames).toBe(5);
  });

  it('will not assert attack/death - those are only ever suggested', () => {
    const summary = classifyFrames(frames(['knight_attack_0.png', 'knight_attack_1.png', 'knight_death_0.png']));
    for (const state of summary.states) {
      expect(['attack', 'death']).toContain(state.state);
      expect(state.confidence).toBe('suggested');
    }
  });

  it('always identifies a static fallback frame, preferring idle frame 0', () => {
    const withIdle = classifyFrames(frames(['run_0.png', 'run_1.png', 'idle_0.png', 'idle_1.png']));
    expect(withIdle.staticFallbackRef).toBe('f2'); // idle_0

    const noIdle = classifyFrames(frames(['jump_2.png', 'jump_0.png', 'jump_1.png']));
    expect(noIdle.staticFallbackRef).toBe('f1'); // jump_0, lowest index
  });

  it('detects directional variants', () => {
    const summary = classifyFrames(frames(['walk_left_0.png', 'walk_left_1.png', 'walk_right_0.png', 'walk_right_1.png', 'walk_up_0.png', 'walk_down_0.png']));
    expect(summary.directions.map((d) => d.direction).sort()).toEqual(['down', 'left', 'right', 'up']);
    expect(summary.states.find((s) => s.state === 'walk')?.confidence).toBe('confident');
  });

  it('flags an uninformative name set as one unnamed sequence', () => {
    const summary = classifyFrames(frames(['sprite_0000.png', 'sprite_0001.png', 'sprite_0002.png']));
    expect(summary.namesWereUninformative).toBe(true);
    expect(summary.states).toHaveLength(1);
    expect(summary.states[0]!.state).toBe('default');
    expect(summary.states[0]!.confidence).toBe('suggested');
    expect(summary.staticFallbackRef).toBe('f0');
  });

  it('handles the empty case without throwing', () => {
    const summary = classifyFrames([]);
    expect(summary.staticFallbackRef).toBeNull();
    expect(summary.totalFrames).toBe(0);
  });
});

describe('suggestVisualBounds', () => {
  it('suggests bottom-center for a mass sitting on the lower edge', () => {
    const s = suggestVisualBounds({ width: 32, height: 32, hasAlpha: true, alphaBounds: { x: 8, y: 10, width: 16, height: 22 } });
    expect(s.pivot).toBe('bottom-center');
    expect(s.footprintRatio).toBeCloseTo((16 * 22) / (32 * 32), 5);
    expect(s.note).toMatch(/does not change/i);
  });

  it('suggests center for a centered mass and for an opaque image', () => {
    expect(suggestVisualBounds({ width: 32, height: 32, hasAlpha: true, alphaBounds: { x: 8, y: 8, width: 16, height: 16 } }).pivot).toBe('center');
    const opaque = suggestVisualBounds({ width: 64, height: 64, hasAlpha: false, alphaBounds: null });
    expect(opaque.pivot).toBe('center');
    expect(opaque.trimmed).toBeNull();
    expect(opaque.footprintRatio).toBe(1);
  });

  it('never claims a collision change', () => {
    const s = suggestVisualBounds({ width: 10, height: 10, hasAlpha: true, alphaBounds: { x: 0, y: 0, width: 10, height: 10 } });
    expect(s.note.toLowerCase()).toContain('suggestion only');
  });
});
