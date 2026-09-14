import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * climbing-game defining journey. Category-C Wave 27/30 climb plus the Final
 * Product Completion program's ledge grammar (matrix L03). Each step of the
 * climb is taller than a plain jump, so the way up is the reusable sw2d.wall
 * grammar: grab the step ledge and climb (UP); slide the cliff face while
 * airborne and wall-jump off it to the summit. After a restart the same
 * grammar is exercised the other way: DOWN drops off a hang, JUMP from a
 * hang launches straight up and the ledge is regrabbed on the way down.
 */

interface Parkour {
  readonly active: boolean;
  readonly mode: string | null;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Wall {
  readonly sliding: boolean;
  readonly wallId: string | null;
  readonly state: string;
  readonly ledgeId: string | null;
  readonly ledges: { readonly grabs: number; readonly climbs: number; readonly drops: number };
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly parkour?: Parkour;
  readonly wall?: Wall;
}

const playing = (s: Shell): boolean => s.parkour?.outcome === 'playing';

/** From the floor start, hold right and jump at once: the apex lands in the step ledge's grab box. */
async function grabStep(harness: Harness, read: () => Promise<Shell>): Promise<Shell> {
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(1);
  await harness.keyTap('Space');
  const hung = await waitUntil(harness, read, (s) => s.wall?.state === 'ledge-hang' || !playing(s), 60, 1);
  await harness.keyUp('ArrowRight');
  return hung;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, y: initial.y, parkour: initial.parkour, wall: initial.wall };
  const startedOk =
    booted.installedPacks.includes('sw2d.wall') && initial.parkour?.mode === 'climb' && initial.parkour.outcome === 'playing' && initial.y > 400 && initial.wall?.state === 'grounded';

  // Walking right without jumping never gains height (the first step is above head height).
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(20);
  await harness.keyUp('ArrowRight');
  const stuck = await read();
  const stuckOk = stuck.y > 400 && playing(stuck) && stuck.parkour!.jumps === 0 && stuck.wall?.ledges.grabs === 0;
  // Walk back to the start.
  await harness.keyDown('ArrowLeft');
  await waitUntil(harness, read, (s) => s.x <= 102, 60, 2);
  await harness.keyUp('ArrowLeft');
  await harness.stepFrames(2);

  // 1. Step ledge: grab, then UP climbs onto the middle platform.
  const hung = await grabStep(harness, read);
  await harness.keyTap('ArrowUp');
  const step = await waitUntil(harness, read, (s) => s.wall?.state === 'grounded' || !playing(s), 60, 2);
  await harness.stepFrames(4);
  evidence.step = { hung: { x: hung.x, y: hung.y, wall: hung.wall }, climbed: { x: step.x, y: step.y, wall: step.wall } };
  const stepOk = hung.wall?.ledgeId === 'step-ledge' && step.wall?.ledges.grabs === 1 && step.wall.ledges.climbs === 1 && step.y < 350 && step.y > 300 && step.x > 170;

  // 2. Cliff face: jump into it while holding right -> a real slide; wall-jump off it and land on the summit.
  await harness.keyDown('ArrowRight');
  const atFace = await waitUntil(harness, read, (s) => s.x >= 248 || !playing(s), 60, 1);
  await harness.keyTap('Space');
  const sliding = await waitUntil(harness, read, (s) => s.wall?.sliding === true || !playing(s), 40, 1);
  const slidOk = atFace.x >= 248 && sliding.wall?.sliding === true && sliding.wall.wallId === 'cliff' && sliding.wall.state === 'sliding';
  await harness.keyTap('Space');
  const kicked = await read();
  const kickedOk = kicked.wall?.lastResult === 'climb' && kicked.parkour!.jumps >= 2;
  // The wall-jump carries the player up past the summit ledge; falling back
  // through its grab box hangs there, and UP climbs onto the summit.
  const summitHang = await waitUntil(harness, read, (s) => s.wall?.state === 'ledge-hang' || s.onGround || !playing(s), 120, 2);
  if (summitHang.wall?.state === 'ledge-hang') {
    await harness.keyTap('ArrowUp');
    await waitUntil(harness, read, (s) => s.wall?.state === 'grounded' || !playing(s), 60, 2);
  }
  const done = await waitUntil(harness, read, (s) => !playing(s), 120, 3);
  await harness.keyUp('ArrowRight');
  evidence.cliff = { atFaceX: atFace.x, sliding: sliding.wall, kicked: kicked.wall, summitHang: summitHang.wall, done: { x: done.x, y: done.y, parkour: done.parkour, wall: done.wall } };
  const doneOk =
    summitHang.wall?.ledgeId === 'summit-ledge' && done.parkour?.outcome === 'complete' && done.parkour.lastResult === 'summit' && done.y <= 300 && done.x >= 400 && done.wall?.ledges.climbs === 2;

  // 3. Restart clears the ledge counters; DOWN drops off the step ledge; JUMP from a hang goes straight up and regrabs.
  const restart = await restartRun(harness);
  const fresh = await read();
  const restartOk = restart.after === restart.before + 1 && playing(fresh) && fresh.y > 400 && fresh.parkour!.jumps === 0 && fresh.wall?.ledges.grabs === 0 && fresh.wall.state === 'grounded';
  const hung2 = await grabStep(harness, read);
  await harness.keyTap('ArrowDown');
  const dropped = await waitUntil(harness, read, (s) => s.onGround && s.wall?.state === 'grounded', 60, 2);
  evidence.drop = { hung: hung2.wall, dropped: { y: dropped.y, wall: dropped.wall } };
  const droppedOk = hung2.wall?.state === 'ledge-hang' && dropped.wall?.ledges.drops === 1 && dropped.y > 400 && playing(dropped);
  await harness.keyDown('ArrowLeft');
  await waitUntil(harness, read, (s) => s.x <= 102, 60, 2);
  await harness.keyUp('ArrowLeft');
  await harness.stepFrames(2);
  const hung3 = await grabStep(harness, read);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const launched = await read();
  const regrabbed = await waitUntil(harness, read, (s) => s.wall?.state === 'ledge-hang' || !playing(s), 90, 2);
  evidence.hangJump = { hung: hung3.wall, launched: { y: launched.y, wall: launched.wall }, regrabbed: regrabbed.wall };
  const hangJumpOk =
    hung3.wall?.ledges.grabs === 2 && launched.wall?.lastResult === 'hang-jump' && launched.wall.state === 'airborne' && regrabbed.wall?.ledges.grabs === 3 && regrabbed.wall.ledgeId === 'step-ledge';

  const passed = startedOk && stuckOk && stepOk && slidOk && kickedOk && doneOk && restartOk && droppedOk && hangJumpOk;
  return { passed, details: { ...evidence, startedOk, stuckOk, stepOk, slidOk, kickedOk, doneOk, restartOk, droppedOk, hangJumpOk } };
}
