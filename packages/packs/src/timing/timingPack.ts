/**
 * Visual timing pack (Category-C capability program, Wave 10).
 *
 * Renderer-neutral reaction-test and beat-window state. Overlay-matching
 * audio-sync is deliberately out of contract: this is a visual metronome
 * plus a deterministic delay cue. Empty catalogs stay inert.
 *
 * Bounded modes: reaction (one-shot delay, too-early miss) and rhythm
 * (periodic visual beats). Not folded into `sw2d.arcade`.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
  TimingCatalog,
  TimingMode,
  TimingOutcome,
  TimingPhase,
  TimingService,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: TimingCatalog = {
  schemaVersion: 1,
  mode: 'reaction',
  windowMs: 0,
  hitsToWin: 0,
  missesToFail: 0,
  reaction: { delaysMs: [], maxWaitMs: 0 },
};

class TimingServiceImpl implements TimingService {
  private elapsed = 0;
  private cue = 0;
  private beat = 0;
  private waitStartedAt = 0;
  private goAt = 0;
  private hitCount = 0;
  private missCount = 0;
  private last: string | null = null;
  private latency: number | null = null;
  private phaseState: TimingPhase = 'wait';
  private current: TimingOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: TimingCatalog,
  ) {}

  mode(): TimingMode {
    return this.catalog.mode;
  }

  active(): boolean {
    if (this.catalog.hitsToWin <= 0) return false;
    if (this.catalog.mode === 'reaction') {
      return (this.catalog.reaction?.delaysMs.length ?? 0) > 0;
    }
    const rhythm = this.catalog.rhythm;
    return (rhythm?.periodMs ?? 0) > 0 && (rhythm?.beats ?? 0) > 0;
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    const dt = Math.max(0, deltaMs);
    if (dt === 0) return;
    this.elapsed += dt;
    if (this.catalog.mode === 'reaction') this.tickReaction();
    else this.tickRhythm();
  }

  hit(): void {
    if (!this.active() || this.current !== 'playing') return;
    if (this.catalog.mode === 'reaction') this.hitReaction();
    else this.hitRhythm();
  }

  phase(): TimingPhase {
    return this.phaseState;
  }

  windowOpen(): boolean {
    if (!this.active() || this.current !== 'playing') return false;
    if (this.catalog.mode === 'reaction') return this.phaseState === 'go';
    const beatTime = this.beatTime(this.beat);
    if (beatTime === null) return false;
    return Math.abs(this.elapsed - beatTime) <= this.catalog.windowMs;
  }

  elapsedMs(): number {
    return this.elapsed;
  }

  hits(): number {
    return this.hitCount;
  }

  misses(): number {
    return this.missCount;
  }

  lastResult(): string | null {
    return this.last;
  }

  lastLatencyMs(): number | null {
    return this.latency;
  }

  nextBeatInMs(): number | null {
    if (!this.active() || this.current !== 'playing') return null;
    if (this.catalog.mode === 'reaction') {
      if (this.phaseState === 'go') return 0;
      const delay = this.currentDelay();
      if (delay === null) return null;
      return Math.max(0, this.waitStartedAt + delay - this.elapsed);
    }
    const beatTime = this.beatTime(this.beat);
    if (beatTime === null) return null;
    return beatTime - this.elapsed;
  }

  cueIndex(): number {
    return this.catalog.mode === 'reaction' ? this.cue : this.beat;
  }

  outcome(): TimingOutcome {
    return this.current;
  }

  reset(): void {
    this.elapsed = 0;
    this.cue = 0;
    this.beat = 0;
    this.waitStartedAt = 0;
    this.goAt = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.last = null;
    this.latency = null;
    this.phaseState = 'wait';
    this.current = 'playing';
  }

  private currentDelay(): number | null {
    const delay = this.catalog.reaction?.delaysMs[this.cue];
    return delay === undefined ? null : delay;
  }

  private beatTime(index: number): number | null {
    const rhythm = this.catalog.rhythm;
    if (!rhythm || index >= rhythm.beats) return null;
    return rhythm.offsetMs + index * rhythm.periodMs;
  }

  private tickReaction(): void {
    const delay = this.currentDelay();
    if (delay === null) return;
    if (this.phaseState === 'wait' && this.elapsed - this.waitStartedAt >= delay) {
      this.phaseState = 'go';
      this.goAt = this.elapsed;
    }
    if (this.phaseState === 'go') {
      const maxWait = this.catalog.reaction?.maxWaitMs ?? 0;
      if (maxWait > 0 && this.elapsed - this.goAt >= maxWait) {
        this.noteMiss('timeout');
        this.advanceReaction();
      }
    }
  }

  private hitReaction(): void {
    if (this.phaseState === 'wait') {
      this.latency = null;
      this.noteMiss('false-start');
      this.waitStartedAt = this.elapsed;
      this.maybeFinish();
      return;
    }
    if (this.phaseState !== 'go') return;
    const latency = this.elapsed - this.goAt;
    this.latency = latency;
    if (latency <= this.catalog.windowMs) this.noteHit();
    else this.noteMiss('late');
    this.advanceReaction();
  }

  private advanceReaction(): void {
    this.maybeFinish();
    if (this.current !== 'playing') return;
    this.cue += 1;
    if (this.currentDelay() === null) {
      this.finish(this.hitCount >= this.catalog.hitsToWin ? 'complete' : 'failed');
      return;
    }
    this.phaseState = 'wait';
    this.waitStartedAt = this.elapsed;
  }

  private tickRhythm(): void {
    while (this.current === 'playing') {
      const beatTime = this.beatTime(this.beat);
      if (beatTime === null) {
        this.finish(this.hitCount >= this.catalog.hitsToWin ? 'complete' : 'failed');
        return;
      }
      if (this.elapsed > beatTime + this.catalog.windowMs) {
        this.latency = null;
        this.noteMiss('miss');
        this.beat += 1;
        this.maybeFinish();
        continue;
      }
      break;
    }
  }

  private hitRhythm(): void {
    const beatTime = this.beatTime(this.beat);
    if (beatTime === null) return;
    const delta = this.elapsed - beatTime;
    if (Math.abs(delta) <= this.catalog.windowMs) {
      this.latency = Math.abs(delta);
      this.noteHit();
      this.beat += 1;
      this.maybeFinish();
      return;
    }
    this.latency = Math.abs(delta);
    this.noteMiss('miss');
    if (this.elapsed > beatTime - this.catalog.windowMs) {
      this.beat += 1;
    }
    this.maybeFinish();
  }

  private noteHit(): void {
    this.hitCount += 1;
    this.last = 'hit';
    this.events.emit('timing:hit', { hits: this.hitCount, lastResult: 'hit' });
  }

  private noteMiss(reason: string): void {
    this.missCount += 1;
    this.last = reason;
    this.events.emit('timing:miss', { misses: this.missCount, lastResult: reason });
  }

  private maybeFinish(): void {
    if (this.current !== 'playing') return;
    if (this.hitCount >= this.catalog.hitsToWin) {
      this.finish('complete');
      return;
    }
    if (this.catalog.missesToFail > 0 && this.missCount >= this.catalog.missesToFail) {
      this.finish('failed');
    }
  }

  private finish(outcome: TimingOutcome): void {
    this.current = outcome;
    this.phaseState = outcome === 'complete' ? 'complete' : 'failed';
    this.events.emit('timing:completed', { mode: this.catalog.mode, outcome });
  }
}

export const timingPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.timing,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.timing],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['timing']?.value as TimingCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new TimingServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.timing, service);
    return {
      id: PACK_IDS.timing,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { TimingService };
