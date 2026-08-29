import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly generatorId: string;
  readonly seed: number;
  readonly kind: string;
  readonly roomCount: number;
  readonly hasStartNode: boolean;
  readonly hasExitObject: boolean;
  readonly enemyCount: number;
  readonly edgesValid: boolean;
  readonly startToExitReachable: boolean;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly travelled: number;
  readonly regenMatchesInitial: boolean | null;
  readonly altDiffers: boolean | null;
  readonly altValid: boolean | null;
  // Phase 13 chest extensions
  readonly chestsSpawnedCount?: number;
  readonly woodenFirstResult?: { success: boolean; status: string; drops: readonly any[] } | null;
  readonly woodenSecondResult?: { success: boolean; status: string; drops: readonly any[] } | null;
  readonly silverFirstResult?: { success: boolean; status: string; drops: readonly any[] } | null;
  readonly silverSecondResult?: { success: boolean; status: string; drops: readonly any[] } | null;
  readonly silverKeyConsumed?: boolean;
  readonly lockpickBadAttempt?: { success: boolean; pickDamage: number; pickHealth: number } | null;
  readonly lockpickSuccess?: { success: boolean; isUnlocked: boolean } | null;
  readonly goldOpenResult?: { success: boolean; status: string; drops: readonly any[] } | null;
  readonly trapOpenResult?: { success: boolean; status: string; trapTriggered: boolean } | null;
  readonly trapTriggeredCount?: number;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.top-down-shell');

async function hold(h: Harness, code: string, frames: number): Promise<void> {
  await h.keyDown(code);
  await h.stepFrames(frames);
  await h.keyUp(code);
  await h.stepFrames(2);
}

/**
 * Proof - dungeon-crawler (see proofs/dungeon-crawler/PROOF_CONTRACT.md).
 *
 * Phase 7: Deterministic seeded room graph from reusable sw2d.generation.
 * Phase 13: Composes with sw2d.dungeon-chests and sw2d.items for procedural
 * chests, lockpicking minigame, key validation/consumption, mimic traps,
 * and deterministic rarity-tier drops.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  const initial = await state(harness);
  const startedOk =
    initial.kind === 'room-graph' &&
    initial.valid === true &&
    initial.hasStartNode === true &&
    initial.hasExitObject === true &&
    initial.edgesValid === true &&
    initial.startToExitReachable === true &&
    initial.roomCount >= 4 &&
    initial.errors.length === 0 &&
    (initial.chestsSpawnedCount ?? 0) >= 4;
  const referenceRooms = initial.roomCount;

  // Move through the generated rooms (wall collision keeps it honest).
  await hold(harness, 'ArrowRight', 40);
  await hold(harness, 'ArrowDown', 40);
  const moved = await state(harness);
  const traverseOk = moved.travelled > 40;

  // Phase 7: deterministic regen verification
  await harness.keyTap('KeyE'); // INTERACT
  await harness.stepFrames(3);
  const afterRegen = await state(harness);
  const regenOk = afterRegen.regenMatchesInitial === true;

  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const afterAlt = await state(harness);
  const altOk = afterAlt.altDiffers === true && afterAlt.altValid === true;

  // Phase 13: Chest journey
  await harness.keyTap('KeyJ'); // PRIMARY_ACTION
  await harness.stepFrames(5);
  const afterChests = await state(harness);

  const woodenOk =
    afterChests.woodenFirstResult?.success === true &&
    afterChests.woodenFirstResult?.status === 'opened' &&
    (afterChests.woodenFirstResult?.drops.length ?? 0) > 0 &&
    afterChests.woodenSecondResult?.success === false &&
    afterChests.woodenSecondResult?.status === 'already_open';

  const silverOk =
    afterChests.silverFirstResult?.success === false &&
    afterChests.silverFirstResult?.status === 'locked_needs_key' &&
    afterChests.silverSecondResult?.success === true &&
    afterChests.silverSecondResult?.status === 'opened' &&
    afterChests.silverKeyConsumed === true;

  const lockpickOk =
    afterChests.lockpickBadAttempt?.success === false &&
    (afterChests.lockpickBadAttempt?.pickDamage ?? 0) > 0 &&
    afterChests.lockpickSuccess?.success === true &&
    afterChests.lockpickSuccess?.isUnlocked === true;

  const goldOk =
    afterChests.goldOpenResult?.success === true &&
    afterChests.goldOpenResult?.status === 'opened' &&
    (afterChests.goldOpenResult?.drops.length ?? 0) > 0;

  const trapOk =
    afterChests.trapOpenResult?.success === true &&
    afterChests.trapOpenResult?.trapTriggered === true &&
    (afterChests.trapTriggeredCount ?? 0) >= 1;

  const chestsOk = Boolean(woodenOk && silverOk && lockpickOk && goldOk && trapOk);

  // Phase 7 restart verification
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(14);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.roomCount === referenceRooms &&
    afterRestart.startToExitReachable === true &&
    afterRestart.valid === true &&
    (afterRestart.chestsSpawnedCount ?? 0) >= 4;

  const passed = startedOk && traverseOk && regenOk && altOk && chestsOk && restartOk;
  return {
    passed,
    details: {
      initial,
      moved,
      afterRegen,
      afterAlt,
      afterChests,
      afterRestart,
      startedOk,
      traverseOk,
      regenOk,
      altOk,
      chestsOk,
      woodenOk,
      silverOk,
      lockpickOk,
      goldOk,
      trapOk,
      restartOk,
    },
  };
}
