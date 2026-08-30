import { describe, expect, it } from 'vitest';
import { BrowserAudioTransport, ManualAudioTransport, createAudioTransport } from '../src/game-support/audioTransport.ts';

/** A stand-in for the browser's AudioContext clock, driven by hand. */
function fakeContext(): AudioContext & { advance(seconds: number): void } {
  let now = 0;
  return {
    get currentTime() {
      return now;
    },
    advance(seconds: number) {
      now += seconds;
    },
  } as unknown as AudioContext & { advance(seconds: number): void };
}

describe('BrowserAudioTransport', () => {
  it('reads the audio clock, not the page clock', () => {
    const context = fakeContext();
    const transport = new BrowserAudioTransport(context);
    expect(transport.usingAudioClock).toBe(true);

    transport.start();
    context.advance(1.5);
    expect(transport.currentTimeMs()).toBeCloseTo(1500, 6);
  });

  it('does not advance while paused, and continues from where it stopped', () => {
    const context = fakeContext();
    const transport = new BrowserAudioTransport(context);
    transport.start();
    context.advance(1);
    transport.pause();
    expect(transport.state).toBe('paused');

    context.advance(10); // the world moved on; the transport did not
    expect(transport.currentTimeMs()).toBeCloseTo(1000, 6);

    transport.resume();
    context.advance(0.5);
    expect(transport.currentTimeMs()).toBeCloseTo(1500, 6);
  });

  it('never reports a position that moved backwards', () => {
    let now = 0;
    const context = {
      get currentTime() {
        return now;
      },
    } as unknown as AudioContext;
    const transport = new BrowserAudioTransport(context);
    now = 5;
    transport.start();
    // A clock that appears to rewind must not let a judged note be re-judged.
    now = 1;
    expect(transport.currentTimeMs()).toBe(0);
  });

  it('restarts from zero', () => {
    const context = fakeContext();
    const transport = new BrowserAudioTransport(context);
    transport.start();
    context.advance(2);
    expect(transport.currentTimeMs()).toBeCloseTo(2000, 6);
    transport.start();
    expect(transport.currentTimeMs()).toBe(0);
  });

  it('degrades to the page clock without Web Audio, and says so', () => {
    const transport = new BrowserAudioTransport(null);
    expect(transport.usingAudioClock).toBe(false);
    transport.start();
    expect(transport.state).toBe('playing');
    expect(transport.currentTimeMs()).toBeGreaterThanOrEqual(0);
  });

  it('stops and freezes on dispose', () => {
    const context = fakeContext();
    const transport = new BrowserAudioTransport(context);
    transport.start();
    context.advance(1);
    transport.dispose();
    expect(transport.state).toBe('stopped');
    const frozen = transport.currentTimeMs();
    context.advance(10);
    expect(transport.currentTimeMs()).toBe(frozen);
  });

  it('createAudioTransport tolerates a missing context', () => {
    expect(createAudioTransport(null).usingAudioClock).toBe(false);
    expect(createAudioTransport(undefined).usingAudioClock).toBe(false);
    expect(createAudioTransport(fakeContext()).usingAudioClock).toBe(true);
  });
});

describe('ManualAudioTransport', () => {
  it('advances only while playing', () => {
    const transport = new ManualAudioTransport();
    transport.advance(100);
    expect(transport.currentTimeMs()).toBe(0); // idle

    transport.start();
    transport.advance(250);
    expect(transport.currentTimeMs()).toBe(250);

    transport.pause();
    transport.advance(1000);
    expect(transport.currentTimeMs()).toBe(250);

    transport.resume();
    transport.advance(50);
    expect(transport.currentTimeMs()).toBe(300);
  });

  it('seeks for setting up a case, and clamps below zero', () => {
    const transport = new ManualAudioTransport();
    transport.start();
    transport.seek(4200);
    expect(transport.currentTimeMs()).toBe(4200);
    transport.seek(-5);
    expect(transport.currentTimeMs()).toBe(0);
  });

  it('is inert after dispose', () => {
    const transport = new ManualAudioTransport();
    transport.start();
    transport.dispose();
    transport.advance(100);
    expect(transport.state).toBe('stopped');
    expect(transport.currentTimeMs()).toBe(0);
  });
});
