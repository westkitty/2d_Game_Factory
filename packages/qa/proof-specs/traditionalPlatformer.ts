import type { Harness } from '../src/harness.ts';
import { holdUntil, pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Objectives {
  readonly active: boolean;
  readonly collected: number;
  readonly quota: number;
  readonly checkpoint: string | null;
  readonly resets: number;
  readonly cleared: boolean;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly onGround: boolean;
  readonly objectives?: Objectives;
}

/**
 * The generator's universal level: spawn x 60, checkpoint x 180, coin x 300,
 * spikes x 450-510, exit x 900 - all on one ground row. A straight walk
 * hits the spikes; a jump clears them.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 30);
  const booted = await readSnapshot(harness);
  const spawn = await read();
  evidence.spawn = spawn;
  const startedOk =
    booted.installedPacks.includes('sw2d.world') && booted.installedPacks.includes('sw2d.world-entities') &&
    spawn.objectives?.active === true && spawn.objectives.quota === 1 && spawn.objectives.checkpoint === null && spawn.onGround;

  // A jump from rest leaves the ground and lands again; then movement under a held key.
  await harness.keyTap('Space');
  const jumping = await read();
  const jumpOk = jumping.vy < 0 || !jumping.onGround;
  const landed = await waitUntil(harness, read, (s) => s.onGround, 30, 3);
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(10);
  const moving = await read();
  const moveOk = landed.onGround && moving.x > spawn.x && moving.vx > 0;

  // Walk on: the checkpoint activates and the coin is collected, then the spikes reset the player to the checkpoint.
  const collected = await waitUntil(harness, read, (s) => (s.objectives?.collected ?? 0) >= 1, 40, 4);
  evidence.collected = collected.objectives;
  const collectOk = collected.objectives?.checkpoint === 'checkpoint-1' && collected.objectives.collected === 1;
  const reset = await waitUntil(harness, read, (s) => (s.objectives?.resets ?? 0) >= 1, 60, 4);
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(6);
  const afterReset = await read();
  evidence.reset = { objectives: reset.objectives, x: afterReset.x };
  const resetOk = reset.objectives?.resets === 1 && afterReset.x < 260 && afterReset.x > 120 && afterReset.objectives?.collected === 1;

  // Pause mid-run keeps the counters.
  const paused = await pauseResume(harness);
  const resumed = await read();
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.objectives?.resets === 1;

  // Second attempt: jump the spikes and reach the exit with the quota met.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 380, 60, 3);
  await harness.keyDown('ArrowRight');
  await harness.keyTap('Space');
  const cleared = await waitUntil(harness, read, (s) => s.objectives?.cleared === true, 80, 5);
  await harness.keyUp('ArrowRight');
  evidence.cleared = { objectives: cleared.objectives, x: cleared.x };
  const clearedOk = cleared.objectives?.cleared === true && cleared.objectives.outcome === 'complete' && cleared.objectives.resets === 1 && cleared.x >= 860;
  // Input after the clear does not move the player.
  await harness.keyDown('ArrowLeft');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowLeft');
  const frozen = await read();
  const frozenOk = Math.abs(frozen.x - cleared.x) < 4;

  const run = await restartRun(harness, 30);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, objectives: fresh.objectives };
  const restartOk = run.after === run.before + 1 && fresh.objectives?.collected === 0 && fresh.objectives.resets === 0 && !fresh.objectives.cleared && fresh.objectives.checkpoint === null && fresh.x < 100;
  // The coin is collectable again: sw2d.world is scene-scoped, so its `collected.<id>` flag did not survive the reinstall.
  const recollected = await holdUntil(harness, ['ArrowRight'], read, (s) => (s.objectives?.collected ?? 0) >= 1, 40, 4);
  evidence.recollected = recollected.objectives;
  const recollectOk = recollected.objectives?.collected === 1 && recollected.objectives.checkpoint === 'checkpoint-1';

  const passed = startedOk && moveOk && jumpOk && collectOk && resetOk && pauseOk && clearedOk && frozenOk && restartOk && recollectOk;
  return { passed, details: { ...evidence, startedOk, moveOk, jumpOk, collectOk, resetOk, pauseOk, clearedOk, frozenOk, restartOk, recollectOk } };
}
