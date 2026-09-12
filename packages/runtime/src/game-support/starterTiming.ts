import { TIMING_CAPABILITY_ID, type TimingService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.timing` (Category-C Wave 10).
 *
 * Inert unless the game installed the pack with a live catalog. `{ hud: false }`
 * lets expanded kits keep their own presentation. Overlay rhythm/reaction
 * kits do not bind this wave.
 */

export interface StarterTimingSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly phase: string;
  readonly windowOpen: boolean;
  readonly elapsedMs: number;
  readonly hits: number;
  readonly misses: number;
  readonly lastResult: string | null;
  readonly lastLatencyMs: number | null;
  readonly nextBeatInMs: number | null;
  readonly cueIndex: number;
  readonly outcome: string;
}

export interface StarterTimingBinding {
  readonly active: boolean;
  tick(deltaMs: number): void;
  hit(): void;
  snapshot(): StarterTimingSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterTimingBinding = {
  active: false,
  tick: () => undefined,
  hit: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    phase: 'wait',
    windowOpen: false,
    elapsedMs: 0,
    hits: 0,
    misses: 0,
    lastResult: null,
    lastLatencyMs: null,
    nextBeatInMs: null,
    cueIndex: 0,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

export function bindStarterTiming(context: SceneContext, options?: { readonly hud?: boolean }): StarterTimingBinding {
  if (!context.capabilities.has(TIMING_CAPABILITY_ID)) return INERT;
  const clock = context.capabilities.require<TimingService>(TIMING_CAPABILITY_ID);
  if (!clock.active()) return INERT;
  clock.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const cue = hud ? scene.add.circle(width * 0.5, height * 0.5, 22, 0x384054).setScrollFactor(0).setDepth(40) : null;
  const cueLabel = hud ? scene.add.text(width * 0.5, height * 0.5, '', headingStyle(28)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  function snapshot(): StarterTimingSnapshot {
    return {
      active: true,
      mode: clock.mode(),
      phase: clock.phase(),
      windowOpen: clock.windowOpen(),
      elapsedMs: Math.round(clock.elapsedMs()),
      hits: clock.hits(),
      misses: clock.misses(),
      lastResult: clock.lastResult(),
      lastLatencyMs: clock.lastLatencyMs() === null ? null : Math.round(clock.lastLatencyMs()!),
      nextBeatInMs: clock.nextBeatInMs() === null ? null : Math.round(clock.nextBeatInMs()!),
      cueIndex: clock.cueIndex(),
      outcome: clock.outcome(),
    };
  }

  function render(): void {
    if (!title || !status || !hint || !cue || !cueLabel) return;
    const snap = snapshot();
    const open = snap.windowOpen;
    title.setText(clock.mode() === 'rhythm' ? 'RHYTHM' : 'REACTION');
    status.setText(
      `hits ${snap.hits}  ·  misses ${snap.misses}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
        snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''
      }`,
    );
    const fill =
      snap.outcome === 'complete' ? 0x65d0a8 : snap.outcome === 'failed' ? 0xe0574f : open ? 0xffe14d : 0x384054;
    cue.setFillStyle(fill);
    cue.setRadius(open || snap.outcome !== 'playing' ? 56 : 22);
    cueLabel.setText(
      snap.outcome === 'complete' ? 'CLEAR' : snap.outcome === 'failed' ? 'OUT' : open ? 'GO' : 'WAIT',
    );
    hint.setText(clock.mode() === 'rhythm' ? 'ENTER ON THE BEAT  ·  EARLY / PERFECT / LATE' : 'WAIT FOR THE GO   ENTER HITS');
  }

  render();

  let disposed = false;
  return {
    active: true,
    tick(deltaMs: number): void {
      clock.tick(deltaMs);
      render();
    },
    hit(): void {
      clock.hit();
      context.audio.playCue('ui.confirm');
      render();
    },
    snapshot,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        cue?.destroy();
        cueLabel?.destroy();
        hint?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
