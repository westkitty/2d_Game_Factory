import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 4 proof - bullet-hell (see proofs/bullet-hell/PROOF_CONTRACT.md).
 *
 * A bounded, deterministic dense-pattern encounter driven entirely by
 * `content/encounters.json`: capped ring + spiral emitters produce an exact
 * bullet count, a spawn wave produces drones, and the whole thing runs
 * through the reusable `sw2d.encounters` + Phase 3 projectile runtime.
 */

interface ShellSnap {
  readonly playerHealth: { readonly current: number; readonly max: number };
  readonly dronesAlive: number;
  readonly phaseId: string | null;
  readonly bulletsFired: number;
  readonly projectilesLive: number;
  readonly hitsResolved: number;
  readonly encounterComplete: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(6);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.encounters') &&
    initial.phaseId === 'spread' &&
    initial.encounterComplete === false;

  // Let the capped emitters run out and shoot the drones down (auto-aim at nearest).
  await harness.keyDown('KeyJ'); // PRIMARY_ACTION
  for (let i = 0; i < 14; i++) await harness.stepFrames(12);
  const mid = await state(harness);
  await harness.keyUp('KeyJ');
  evidence.mid = mid;

  // ring: 8 emissions x 12 = 96; spiral: 16 emissions x 3 = 48; total 144, exactly.
  const boundedOk = mid.bulletsFired === 144 && mid.projectilesLive <= 200;
  const combatOk = mid.hitsResolved > 0 && mid.dronesAlive < 4 && mid.playerHealth.current < mid.playerHealth.max;

  // Phase completes at elapsed 2600ms.
  await harness.stepFrames(50);
  const done = await state(harness);
  evidence.done = done;
  const completeOk = done.encounterComplete === true && done.bulletsFired === 144;

  // Restart genuinely reinstalls: a fresh encounter runtime (bullet counter
  // reset well below the completed 144), back in the first phase.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(6);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.encounterComplete === false &&
    afterRestart.bulletsFired < 144 &&
    afterRestart.phaseId === 'spread' &&
    afterRestart.playerHealth.current === afterRestart.playerHealth.max;

  const passed = startedOk && boundedOk && combatOk && completeOk && restartOk;
  return { passed, details: { ...evidence, startedOk, boundedOk, combatOk, completeOk, restartOk } };
}
