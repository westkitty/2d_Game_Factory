import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Drive {
  readonly active: boolean;
  readonly mode: string | null;
  readonly profile: string | null;
  readonly speed: number;
  readonly altitude: number;
  readonly lastResult: string | null;
  readonly checkpoint: string | null;
  readonly bank: number;
  readonly outcome: string;
}
interface Race {
  readonly phase: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly drive?: Drive;
  readonly race?: Race;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.vehicle-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, drive: initial.drive };
  const startedOk =
    booted.installedPacks.includes('sw2d.vehicles') &&
    booted.installedPacks.includes('sw2d.racing') &&
    initial.drive?.mode === 'craft' &&
    initial.drive.profile === 'boat' &&
    initial.drive.altitude === 0 &&
    initial.drive.outcome === 'playing';

  // As a boat, throttle + climb never leaves the water.
  const boat = await holdUntil(harness, ['ArrowUp', 'ShiftLeft'], read, (s) => (s.drive?.speed ?? 0) > 20, 30, 4);
  evidence.boat = boat.drive;
  const boatOk = (boat.drive?.speed ?? 0) > 0 && boat.drive?.altitude === 0 && boat.drive.profile === 'boat';

  // PRIMARY switches to the flight profile (sw2d.vehicles reloads the definition); switching twice is 'already'.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const switched = await read();
  evidence.switched = switched.drive;
  const switchOk = switched.drive?.profile === 'flight' && switched.drive.lastResult === 'flight';

  // Now throttle + climb gains altitude to the airborne goal.
  const done = await holdUntil(harness, ['ArrowUp', 'ShiftLeft'], read, (s) => s.drive?.outcome === 'complete' || (s.drive?.altitude ?? 0) >= 80);
  evidence.done = done.drive;
  const doneOk = done.drive?.profile === 'flight' && done.drive.outcome === 'complete' && done.drive.lastResult === 'airborne' && done.drive.altitude >= 80;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, drive: fresh.drive };
  const restartOk = run.after === run.before + 1 && fresh.drive?.profile === 'boat' && fresh.drive.altitude === 0 && fresh.drive.outcome === 'playing';

  const passed = startedOk && boatOk && switchOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, boatOk, switchOk, doneOk, restartOk } };
}
