import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface KartItem {
  readonly active: boolean;
  readonly held: boolean;
  readonly fired: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Race {
  readonly phase: string;
  readonly lapCount?: number;
}
interface Vehicle {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly vehicle?: Vehicle;
  readonly race?: Race;
  readonly expectedCheckpoint?: string | null;
  readonly kartItem?: KartItem;
}

// content/races.json of the generated kart-racer (mode race, 2 laps).
const CHECKPOINTS: Readonly<Record<string, { x: number; y: number }>> = {
  'cp-1': { x: 760, y: 440 },
  'cp-2': { x: 760, y: 120 },
  'cp-3': { x: 200, y: 120 },
  'cp-4': { x: 160, y: 440 },
};

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer toward the expected checkpoint with the keyboard until it changes (a real player's inputs, not an autopilot in the game). */
async function driveTo(harness: Harness, read: () => Promise<Shell>, targetId: string, maxSteps = 400): Promise<Shell> {
  let state = await read();
  await harness.keyDown('ArrowUp');
  let left = false;
  let right = false;
  for (let step = 0; step < maxSteps && state.expectedCheckpoint === targetId; step++) {
    const cp = CHECKPOINTS[targetId]!;
    const v = state.vehicle!;
    const desired = Math.atan2(cp.y - v.y, cp.x - v.x);
    const err = wrap(desired - v.heading);
    const wantLeft = err < -0.12;
    const wantRight = err > 0.12;
    if (wantLeft !== left) { left = wantLeft; await (left ? harness.keyDown('ArrowLeft') : harness.keyUp('ArrowLeft')); }
    if (wantRight !== right) { right = wantRight; await (right ? harness.keyDown('ArrowRight') : harness.keyUp('ArrowRight')); }
    await harness.stepFrames(2);
    state = await read();
  }
  await harness.keyUp('ArrowLeft');
  await harness.keyUp('ArrowRight');
  await harness.keyUp('ArrowUp');
  await harness.stepFrames(2);
  return read();
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.vehicle-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, race: initial.race, expected: initial.expectedCheckpoint, kartItem: initial.kartItem };
  const startedOk =
    booted.installedPacks.includes('sw2d.vehicles') && booted.installedPacks.includes('sw2d.racing') &&
    initial.kartItem?.active === true && !initial.kartItem.held && initial.kartItem.fired === 0 && initial.race?.phase === 'idle';

  // Firing with no item is 'empty'.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const empty = await read();
  const emptyOk = empty.kartItem?.lastResult === 'empty' && !empty.kartItem.held;

  // CONFIRM starts the race: countdown, then racing with cp-1 expected.
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const countdown = await read();
  const racing = await waitUntil(harness, read, (s) => s.race?.phase === 'racing', 80, 5);
  evidence.race = { countdown: countdown.race?.phase, racing: racing.race?.phase, expected: racing.expectedCheckpoint };
  const raceOk = countdown.race?.phase === 'countdown' && racing.race?.phase === 'racing' && racing.expectedCheckpoint === 'cp-1';

  // Drive the first straight: the item box on the way is picked up; cp-1 is passed; firing throws the shell.
  const picked = await holdUntil(harness, ['ArrowUp'], read, (s) => s.kartItem?.held === true, 60, 3);
  evidence.picked = picked.kartItem;
  const pickOk = picked.kartItem?.held === true && picked.kartItem.lastResult === 'pickup';
  const passedCp1 = await driveTo(harness, read, 'cp-1');
  const cp1Ok = passedCp1.expectedCheckpoint === 'cp-2';
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const fired = await read();
  evidence.fired = fired.kartItem;
  const fireOk = fired.kartItem?.lastResult === 'fired' && fired.kartItem.fired === 1 && !fired.kartItem.held && fired.kartItem.outcome === 'complete';

  // Steering (kart profile) reaches the second checkpoint: ordered checkpoints advance.
  const passedCp2 = await driveTo(harness, read, 'cp-2');
  evidence.cp2 = { expected: passedCp2.expectedCheckpoint, x: passedCp2.vehicle?.x, y: passedCp2.vehicle?.y };
  const cp2Ok = passedCp2.expectedCheckpoint === 'cp-3';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, race: fresh.race?.phase, expected: fresh.expectedCheckpoint, kartItem: fresh.kartItem };
  const restartOk = run.after === run.before + 1 && fresh.race?.phase === 'idle' && fresh.kartItem?.fired === 0 && !fresh.kartItem?.held;

  const passed = startedOk && emptyOk && raceOk && pickOk && cp1Ok && fireOk && cp2Ok && restartOk;
  return { passed, details: { ...evidence, startedOk, emptyOk, raceOk, pickOk, cp1Ok, fireOk, cp2Ok, restartOk } };
}
