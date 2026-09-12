import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, TimingCatalog, TimingService } from '@sw2d/contracts';
import { TIMING_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { timingPack } from '../src/timing/timingPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const REACTION: TimingCatalog = {
  schemaVersion: 1,
  mode: 'reaction',
  windowMs: 400,
  hitsToWin: 2,
  missesToFail: 3,
  reaction: { delaysMs: [700, 700], maxWaitMs: 900 },
};

const RHYTHM: TimingCatalog = {
  schemaVersion: 1,
  mode: 'rhythm',
  windowMs: 120,
  hitsToWin: 3,
  missesToFail: 4,
  rhythm: { periodMs: 500, offsetMs: 700, beats: 8 },
};

function install(catalog?: TimingCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { timing: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = timingPack.install(ctx, undefined);
  const clock = capabilities.require<TimingService>(TIMING_CAPABILITY_ID);
  return { events, capabilities, installed, clock };
}

describe('sw2d.timing - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(TIMING_CAPABILITY_ID).toBe(CAPABILITY_IDS.timing);
    expect(timingPack.provides).toEqual([TIMING_CAPABILITY_ID]);
    expect(timingPack.dependencies).toEqual([]);
  });
});

describe('sw2d.timing - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ timing: REACTION })).not.toThrow();
    expect(() => validateContentBundleData({ timing: RHYTHM })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ timing: { ...REACTION, mode: 'audio' } })).toThrow();
  });
});

describe('sw2d.timing - reaction', () => {
  it('stays in wait until the delay, then GO, then a hit inside the window scores', () => {
    const { clock } = install(REACTION);
    expect(clock.mode()).toBe('reaction');
    expect(clock.phase()).toBe('wait');
    expect(clock.windowOpen()).toBe(false);
    clock.tick(699);
    expect(clock.phase()).toBe('wait');
    clock.tick(1);
    expect(clock.phase()).toBe('go');
    expect(clock.windowOpen()).toBe(true);
    clock.hit();
    expect(clock.hits()).toBe(1);
    expect(clock.lastResult()).toBe('hit');
    expect(clock.phase()).toBe('wait');
    expect(clock.outcome()).toBe('playing');
  });

  it('two in-window hits complete the starter catalog', () => {
    const { clock } = install(REACTION);
    clock.tick(700);
    clock.hit();
    clock.tick(700);
    clock.hit();
    expect(clock.hits()).toBe(2);
    expect(clock.outcome()).toBe('complete');
    expect(clock.phase()).toBe('complete');
  });

  it('a press during wait is a false-start miss and restarts the same delay', () => {
    const { clock } = install(REACTION);
    clock.tick(100);
    clock.hit();
    expect(clock.misses()).toBe(1);
    expect(clock.lastResult()).toBe('false-start');
    expect(clock.hits()).toBe(0);
    expect(clock.phase()).toBe('wait');
    clock.tick(699);
    expect(clock.phase()).toBe('wait');
    clock.tick(1);
    expect(clock.phase()).toBe('go');
  });

  it('waiting past maxWaitMs is a timeout miss', () => {
    const { clock } = install(REACTION);
    clock.tick(700);
    expect(clock.phase()).toBe('go');
    clock.tick(900);
    expect(clock.misses()).toBe(1);
    expect(clock.lastResult()).toBe('timeout');
    expect(clock.phase()).toBe('wait');
  });

  it('a late press after the window is a late miss', () => {
    const { clock } = install({ ...REACTION, windowMs: 50 });
    clock.tick(700);
    clock.tick(80);
    clock.hit();
    expect(clock.misses()).toBe(1);
    expect(clock.lastResult()).toBe('late');
  });
});

describe('sw2d.timing - rhythm', () => {
  it('opens a window around the first beat and counts an in-window hit', () => {
    const { clock } = install(RHYTHM);
    expect(clock.mode()).toBe('rhythm');
    clock.tick(579);
    expect(clock.windowOpen()).toBe(false);
    clock.tick(1);
    expect(clock.windowOpen()).toBe(true);
    clock.hit();
    expect(clock.hits()).toBe(1);
    expect(clock.lastResult()).toBe('hit');
    expect(clock.outcome()).toBe('playing');
  });

  it('three in-window hits complete the starter catalog', () => {
    const { clock } = install(RHYTHM);
    clock.tick(700);
    clock.hit();
    clock.tick(500);
    clock.hit();
    clock.tick(500);
    clock.hit();
    expect(clock.hits()).toBe(3);
    expect(clock.outcome()).toBe('complete');
  });

  it('a beat that closes without a press is a miss', () => {
    const { clock } = install(RHYTHM);
    clock.tick(821);
    expect(clock.misses()).toBe(1);
    expect(clock.lastResult()).toBe('miss');
    expect(clock.cueIndex()).toBe(1);
  });

  it('an early press before the window is a miss that does not consume the beat', () => {
    const { clock } = install(RHYTHM);
    clock.tick(200);
    clock.hit();
    expect(clock.misses()).toBe(1);
    expect(clock.cueIndex()).toBe(0);
    clock.tick(500);
    expect(clock.windowOpen()).toBe(true);
  });
});

describe('sw2d.timing - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(REACTION);
    expect(capabilities.has(TIMING_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(TIMING_CAPABILITY_ID)).toBe(false);
  });

  it('a missing content/timing.json yields an inert service, not an error', () => {
    const { clock } = install();
    expect(clock.active()).toBe(false);
    clock.tick(1000);
    clock.hit();
    expect(clock.hits()).toBe(0);
    expect(clock.outcome()).toBe('playing');
  });

  it('zero hitsToWin is inert', () => {
    const { clock } = install({ ...REACTION, hitsToWin: 0 });
    expect(clock.active()).toBe(false);
  });

  it('dt=0 does not advance elapsed', () => {
    const { clock } = install(REACTION);
    clock.tick(0);
    expect(clock.elapsedMs()).toBe(0);
    expect(clock.phase()).toBe('wait');
  });

  it('reset restores hits, phase and outcome', () => {
    const { clock } = install(REACTION);
    clock.tick(700);
    clock.hit();
    clock.tick(700);
    clock.hit();
    expect(clock.outcome()).toBe('complete');
    clock.reset();
    expect(clock.outcome()).toBe('playing');
    expect(clock.hits()).toBe(0);
    expect(clock.phase()).toBe('wait');
    expect(clock.elapsedMs()).toBe(0);
  });

  it('missesToFail ends a reaction run', () => {
    const { clock } = install({ ...REACTION, missesToFail: 1 });
    clock.tick(50);
    clock.hit();
    expect(clock.outcome()).toBe('failed');
    expect(clock.phase()).toBe('failed');
  });
});
