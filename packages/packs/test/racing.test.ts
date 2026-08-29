import { describe, expect, it } from 'vitest';
import type { GameContext, RaceCatalog, RaceService } from '@sw2d/contracts';
import { RACE_STATE_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { racingPack } from '../src/racing/racingPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const RACE: RaceCatalog = {
  schemaVersion: 1,
  races: [
    {
      schemaVersion: 1,
      id: 'main',
      mode: 'race',
      countdownMs: 3000,
      laps: 2,
      startPositions: [{ x: 0, y: 0, heading: 0 }],
      checkpoints: [
        { id: 'a', x: 100, y: 0, radius: 40 },
        { id: 'b', x: 100, y: 100, radius: 40 },
        { id: 'c', x: 0, y: 0, radius: 40 },
      ],
    },
  ],
};

const TT: RaceCatalog = {
  schemaVersion: 1,
  races: [{ ...RACE.races[0]!, id: 'tt', mode: 'time-trial', laps: 1, countdownMs: 1000 }],
};

interface Harness {
  svc: RaceService;
  saveStore: Map<string, unknown>;
}

function make(cat: RaceCatalog, persist = false): Harness {
  const capabilities = new FakeCapabilityRegistry();
  const saveStore = new Map<string, unknown>();
  const saves = {
    load: <T,>(slot: string, o: { createDefault: () => T }) => ({ value: (saveStore.get(slot) as T) ?? o.createDefault() }),
    save: <T,>(slot: string, value: T) => void saveStore.set(slot, value),
  };
  const ctx = {
    events: new FakeEventBus(),
    capabilities,
    content: { data: { races: { schemaId: 'x', valid: true, value: cat } } },
    saves,
  } as unknown as GameContext;
  racingPack.install(ctx, { persist });
  return { svc: capabilities.require<RaceService>(RACE_STATE_CAPABILITY_ID), saveStore };
}

/** Drive checkpoints a,b,c in order N times. Returns the per-crossing results. */
function lap(svc: RaceService): void {
  for (const id of ['a', 'b', 'c']) svc.checkpointEntered(id);
}

describe('sw2d.racing', () => {
  it('publishes race.state and lists definitions', () => {
    expect(RACE_STATE_CAPABILITY_ID).toBe(CAPABILITY_IDS.racing);
    const { svc } = make(RACE);
    expect(svc.definitionIds()).toEqual(['main']);
  });

  it('a countdown gates racing; the timer only runs after it reaches zero', () => {
    const { svc } = make(RACE);
    svc.startRace();
    expect(svc.raceState().phase).toBe('countdown');
    svc.tick(1000);
    expect(svc.raceState().phase).toBe('countdown');
    expect(svc.elapsedMs()).toBe(0);
    svc.tick(2000);
    expect(svc.raceState().phase).toBe('racing');
    svc.tick(500);
    expect(svc.elapsedMs()).toBe(500);
  });

  it('only the expected checkpoint counts; a skipped one is ignored', () => {
    const { svc } = make(RACE);
    svc.startRace();
    svc.tick(3000);
    expect(svc.expectedCheckpoint()?.id).toBe('a');
    expect(svc.checkpointEntered('b').counted).toBe(false); // skipping 'a'
    expect(svc.expectedCheckpoint()?.id).toBe('a');
    expect(svc.checkpointEntered('a').counted).toBe(true);
    expect(svc.expectedCheckpoint()?.id).toBe('b');
  });

  it('a full ordered lap increments the lap; a shortcut never does', () => {
    const { svc } = make(RACE);
    svc.startRace();
    svc.tick(3000);
    expect(svc.currentLap()).toBe(1);
    // shortcut attempt: cross only the last checkpoint repeatedly
    for (let i = 0; i < 5; i++) svc.checkpointEntered('c');
    expect(svc.currentLap()).toBe(1);
    expect(svc.raceState().lapTimes).toHaveLength(0);
    // a proper lap
    lap(svc);
    expect(svc.currentLap()).toBe(2);
    expect(svc.raceState().lapTimes).toHaveLength(1);
  });

  it('finishing the required laps ends the race and records best results', () => {
    const { svc, saveStore } = make(RACE, true);
    svc.startRace();
    svc.tick(3000);
    svc.tick(4000);
    lap(svc); // lap 1
    svc.tick(3000);
    const done = lap(svc); // lap 2 -> finish
    void done;
    expect(svc.finished()).toBe(true);
    expect(svc.raceState().phase).toBe('finished');
    expect(svc.expectedCheckpoint()).toBeNull();
    expect(svc.raceState().bestTotalMs).toBeGreaterThan(0);
    expect(saveStore.get('racing')).toMatchObject({ bestByRaceId: { main: {} } });
  });

  it('time-trial: restart resets the attempt; a better later run updates the best', () => {
    const { svc } = make(TT, true);
    svc.startRace();
    svc.tick(1000);
    svc.tick(8000); // slow first run
    lap(svc);
    expect(svc.finished()).toBe(true);
    const firstBest = svc.raceState().bestTotalMs!;

    svc.restartRace();
    expect(svc.raceState().phase).toBe('idle');
    expect(svc.elapsedMs()).toBe(0);
    svc.startRace();
    svc.tick(1000);
    svc.tick(3000); // faster
    lap(svc);
    expect(svc.raceState().bestTotalMs).toBeLessThan(firstBest);
  });

  it('an invalid checkpoint sequence never registers a completed run', () => {
    const { svc } = make(RACE);
    svc.startRace();
    svc.tick(3000);
    for (let i = 0; i < 20; i++) {
      svc.checkpointEntered('c');
      svc.checkpointEntered('b');
    }
    expect(svc.finished()).toBe(false);
    expect(svc.currentLap()).toBe(1);
  });

  it('throws for an unknown race id', () => {
    const { svc } = make(RACE);
    expect(() => svc.load('grand-prix')).toThrow();
  });
});
