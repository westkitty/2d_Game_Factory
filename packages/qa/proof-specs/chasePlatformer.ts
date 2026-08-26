import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Proof A - chase-platformer (see proofs/chase-platformer/PROOF_CONTRACT.md).
 *
 * This does not pre-compute jump trajectories offline and hope the timing
 * lines up: it drives the harness's deterministic frame stepping one (or a
 * few) frames at a time and polls the real debug snapshot for the condition
 * it is waiting on (`stepUntil`). That is what makes assertions about
 * coyote-time/double-jump/jump-buffer timing robust to exact physics
 * constants instead of brittle frame-count arithmetic.
 */

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly jumpsUsed: number;
  readonly lastJumpKind: 'ground' | 'coyote' | 'double' | 'buffered' | null;
  readonly jumpBufferPending: boolean;
  readonly collected: number;
  readonly quota: number;
  readonly checkpoint: string | null;
  readonly deaths: number;
  readonly lastDeathCause: 'hazard' | 'caught' | null;
  readonly health: { readonly current: number; readonly max: number };
  readonly chasePressure: number;
  readonly inSpawnGrace: boolean;
  readonly outcome: 'playing' | 'escaped';
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

class ConditionNotReachedError extends Error {
  constructor(label: string, frames: number) {
    super(`condition "${label}" not reached within ${frames} frames`);
    this.name = 'ConditionNotReachedError';
  }
}

/** Steps one frame at a time, checking the shell snapshot after each, until `predicate` is true. */
async function stepUntil(harness: Harness, label: string, predicate: (s: ShellSnap) => boolean, maxFrames: number): Promise<ShellSnap> {
  for (let i = 0; i < maxFrames; i++) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(1);
  }
  const last = await state(harness);
  if (predicate(last)) return last;
  throw new ConditionNotReachedError(label, maxFrames);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  // 1. Launch/start.
  await harness.keyTap('Space');
  await harness.stepFrames(10);

  // 2. Move right, collecting coin-1 and activating the checkpoint (both on the ground, before the ledge).
  await harness.keyDown('ArrowRight');
  const beforeJumpApproach = await stepUntil(harness, 'reached x>=150, past coin-1 and the checkpoint', (s) => s.x >= 150, 200);
  evidence.beforeJumpApproach = beforeJumpApproach;
  const earlyPickupsOk = beforeJumpApproach.collected >= 1 && beforeJumpApproach.checkpoint !== null;

  // 3. A single running jump onto the ledge (collecting coin-2). ArrowRight stays held
  // through the whole arc - jumping onto a platform from outside its horizontal span is
  // an ordinary running jump, not a jump from directly underneath (which would just hit
  // the platform's underside before ever reaching its top).
  await harness.keyTap('KeyZ');
  const airborneAfterGroundJump = await stepUntil(harness, 'airborne after ground jump', (s) => !s.onGround, 20);
  const groundJumpOk = airborneAfterGroundJump.lastJumpKind === 'ground' && airborneAfterGroundJump.jumpsUsed === 1;

  const landedOnLedge = await stepUntil(harness, 'landed on ledge', (s) => s.onGround, 200);
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(6); // let horizontal velocity settle to 0
  evidence.groundJumpOk = groundJumpOk;
  evidence.landedOnLedge = landedOnLedge;
  const ledgeLandingOk = landedOnLedge.onGround && landedOnLedge.y < 450 && landedOnLedge.collected >= 2;

  // 4. Walk off the ledge's far edge, then coyote-jump, double-jump, and buffer-jump in the same fall.
  await harness.keyDown('ArrowRight');
  const leftLedge = await stepUntil(harness, 'left the ledge (falling)', (s) => !s.onGround, 100);
  evidence.leftLedge = leftLedge;

  await harness.keyTap('KeyZ'); // coyote jump: airborne already, but within the coyote grace window
  const coyoteSnap = await state(harness);
  const coyoteOk = coyoteSnap.lastJumpKind === 'coyote' && coyoteSnap.jumpsUsed === 1;

  await harness.keyTap('KeyZ'); // double jump, second aerial jump
  const secondAirJumpSnap = await state(harness);
  const secondAirJumpOk = secondAirJumpSnap.lastJumpKind === 'double' && secondAirJumpSnap.jumpsUsed === 2;

  // The buffer window is only 150ms, so the third press has to land close to actual
  // touchdown - after a coyote+double chain there's plenty of remaining airtime, so wait
  // until just before landing (close to the ground's resting height) rather than pressing
  // immediately, which would let the buffer expire mid-fall.
  await stepUntil(harness, 'close to landing', (s) => !s.onGround && s.y >= 445, 200);
  await harness.keyDown('KeyZ'); // third press: both aerial jumps spent -> buffers instead of firing
  await harness.stepFrames(2);
  await harness.keyUp('KeyZ');
  const bufferedPendingSnap = await state(harness);
  const bufferPendingOk = bufferedPendingSnap.jumpBufferPending === true && !bufferedPendingSnap.onGround;

  await harness.keyUp('ArrowRight');
  const landedAfterBuffer = await stepUntil(harness, 'landed after buffered jump chain', (s) => s.onGround, 300);
  evidence.coyoteOk = coyoteOk;
  evidence.secondAirJumpOk = secondAirJumpOk;
  evidence.bufferPendingOk = bufferPendingOk;
  evidence.landedAfterBuffer = landedAfterBuffer;
  const bufferedFiredOk = landedAfterBuffer.lastJumpKind === 'buffered' && landedAfterBuffer.jumpBufferPending === false && landedAfterBuffer.jumpsUsed === 1;

  // 5. Cross the hazard fully once (one hit, then clear of it), wait out invulnerability, then
  // deliberately cross back into it a second time (lethal) -> death + checkpoint respawn.
  //
  // The jump chain above can land anywhere, including past the hazard entirely (it flew
  // over it while still airborne) - normalize to a known position safely before the hazard,
  // on the ground, before starting this test, so it doesn't depend on exactly where that
  // chain happened to touch down.
  await harness.keyDown('ArrowLeft');
  await stepUntil(harness, 'clear runway before the hazard', (s) => s.onGround && s.x <= 400, 400);
  await harness.keyUp('ArrowLeft');
  await harness.stepFrames(5);

  await harness.keyDown('ArrowRight');
  const pastHazardFirstPass = await stepUntil(harness, 'crossed hazard fully (first pass)', (s) => s.x >= 520, 400);
  await harness.keyUp('ArrowRight');
  evidence.pastHazardFirstPass = pastHazardFirstPass;
  const firstHazardHitOk = pastHazardFirstPass.health.current === 5 && pastHazardFirstPass.deaths === 0;

  await harness.stepFrames(60); // outlast the 800ms post-hit invulnerability window, clear of the hazard
  await harness.keyDown('ArrowLeft');
  const afterDeath = await stepUntil(harness, 'died to hazard', (s) => s.deaths === 1, 300);
  await harness.keyUp('ArrowLeft');
  await harness.stepFrames(2);
  const afterRespawn = await state(harness);
  evidence.afterDeath = afterDeath;
  evidence.afterRespawn = afterRespawn;
  const deathAndRespawnOk =
    afterDeath.lastDeathCause === 'hazard' &&
    afterRespawn.health.current === afterRespawn.health.max &&
    afterRespawn.collected === afterRespawn.quota &&
    afterRespawn.inSpawnGrace === true &&
    afterRespawn.checkpoint !== null;

  // 6. Chase pressure: frozen during spawn grace, advances during play, frozen while paused, resumes after unpause.
  const duringGrace = await state(harness);
  await harness.stepFrames(15); // well inside the 500ms grace window
  const stillInGrace = await state(harness);
  const graceHoldsOk = stillInGrace.inSpawnGrace === true && stillInGrace.chasePressure === duringGrace.chasePressure;

  await stepUntil(harness, 'spawn grace elapsed', (s) => !s.inSpawnGrace, 60);
  const afterGrace = await state(harness);
  await harness.stepFrames(40);
  const advancingDuringPlay = await state(harness);
  const advancesDuringPlayOk = advancingDuringPlay.chasePressure > afterGrace.chasePressure;

  await harness.keyTap('KeyP');
  const pausedFirst = await state(harness);
  await harness.stepFrames(90);
  const pausedSecond = await state(harness);
  const pausedHoldsOk = pausedSecond.chasePressure === pausedFirst.chasePressure;

  await harness.keyTap('Space');
  await harness.stepFrames(30);
  const afterResume = await state(harness);
  const resumesAfterUnpauseOk = afterResume.chasePressure > pausedSecond.chasePressure;

  evidence.gracePressure = { duringGrace, stillInGrace, afterGrace, advancingDuringPlay, pausedFirst, pausedSecond, afterResume };

  // 7. Cross the hazard a third time (non-lethal, fully healed since respawn) and reach the exit with quota met.
  await harness.keyDown('ArrowRight');
  const finalState = await stepUntil(harness, 'reached exit / escaped', (s) => s.outcome === 'escaped', 500);
  await harness.keyUp('ArrowRight');
  evidence.finalState = finalState;
  const clearOk = finalState.outcome === 'escaped';

  const passed =
    earlyPickupsOk &&
    groundJumpOk &&
    ledgeLandingOk &&
    coyoteOk &&
    secondAirJumpOk &&
    bufferPendingOk &&
    bufferedFiredOk &&
    firstHazardHitOk &&
    deathAndRespawnOk &&
    graceHoldsOk &&
    advancesDuringPlayOk &&
    pausedHoldsOk &&
    resumesAfterUnpauseOk &&
    clearOk;

  return {
    passed,
    details: {
      ...evidence,
      earlyPickupsOk,
      groundJumpOk,
      ledgeLandingOk,
      coyoteOk,
      secondAirJumpOk,
      bufferPendingOk,
      bufferedFiredOk,
      firstHazardHitOk,
      deathAndRespawnOk,
      graceHoldsOk,
      advancesDuringPlayOk,
      pausedHoldsOk,
      resumesAfterUnpauseOk,
      clearOk,
    },
  };
}
