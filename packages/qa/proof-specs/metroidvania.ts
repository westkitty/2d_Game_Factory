import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly currentNode: string;
  readonly discovered: readonly string[];
  readonly visited: readonly string[];
  readonly treasuryUnlocked: boolean;
  readonly transitions: number;
  readonly transitioning: boolean;
  readonly roomDoorSprites: number;
  readonly overlappingDoor: string | null;
  readonly lastBlocked: string | null;
  readonly mapOpen: boolean;
  readonly mapDiscoveredCount: number;
  readonly canReachTreasury: boolean;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.platform-shell');

async function walkToDoor(h: Harness, doorId: string, dir: 'ArrowLeft' | 'ArrowRight'): Promise<boolean> {
  for (let i = 0; i < 200; i++) {
    if ((await state(h)).overlappingDoor === doorId) {
      await h.keyUp('ArrowLeft');
      await h.keyUp('ArrowRight');
      await h.stepFrames(2);
      return true;
    }
    await h.keyDown(dir);
    await h.stepFrames(3);
  }
  await h.keyUp(dir);
  return false;
}

async function interact(h: Harness): Promise<void> {
  await h.keyTap('KeyE');
  await h.stepFrames(6);
}

/**
 * Proof - metroidvania (see proofs/metroidvania/PROOF_CONTRACT.md).
 *
 * Three real rooms via the reusable sw2d.world-graph capability: a locked
 * connection, a world flag that unlocks it, a return trip, the map, and
 * persistence across a real scene reinstall.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  const start = await state(harness);
  const startedOk = start.currentNode === 'hub' && start.discovered.join(',') === 'hub' && start.roomDoorSprites === 1;

  // Hub -> East.
  const reachedEastDoor = await walkToDoor(harness, 'hub-east', 'ArrowRight');
  await interact(harness);
  const inEast = await state(harness);
  const toEastOk = reachedEastDoor && inEast.currentNode === 'east' && inEast.visited.includes('east');

  // Locked East -> Treasury: rejected.
  const reachedTreasuryDoor = await walkToDoor(harness, 'east-treasury', 'ArrowRight');
  const beforeLock = await state(harness);
  await interact(harness);
  const afterLock = await state(harness);
  const lockOk =
    reachedTreasuryDoor &&
    beforeLock.canReachTreasury === false &&
    afterLock.currentNode === 'east' &&
    afterLock.lastBlocked === 'condition-failed';

  // Pull the lever -> sets the world flag.
  const reachedLever = await walkToDoor(harness, 'lever', 'ArrowLeft');
  await interact(harness);
  const afterLever = await state(harness);
  const leverOk = reachedLever && afterLever.treasuryUnlocked === true && afterLever.canReachTreasury === true;

  // Now East -> Treasury succeeds.
  await walkToDoor(harness, 'east-treasury', 'ArrowRight');
  await interact(harness);
  const inTreasury = await state(harness);
  const toTreasuryOk =
    inTreasury.currentNode === 'treasury' &&
    [...inTreasury.discovered].sort().join(',') === 'east,hub,treasury';

  // Return to a previously visited room; persistent world state remains.
  const reachedBack = await walkToDoor(harness, 'treasury-east', 'ArrowLeft');
  await interact(harness);
  const backInEast = await state(harness);
  const returnOk = reachedBack && backInEast.currentNode === 'east' && backInEast.treasuryUnlocked === true;

  // Map shows discovered rooms + current room.
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const mapShown = await state(harness);
  const mapOk = mapShown.mapOpen === true && mapShown.mapDiscoveredCount === 3;
  await harness.keyTap('KeyK');
  await harness.stepFrames(3);

  // No room-resource leak after all the back-and-forth: the current room's
  // door count, not an accumulation.
  const leakOk = backInEast.roomDoorSprites === 3;

  // Restart -> persistence restores the graph.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(16);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const persistOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.currentNode === 'east' &&
    [...afterRestart.discovered].sort().join(',') === 'east,hub,treasury';

  const passed = startedOk && toEastOk && lockOk && leverOk && toTreasuryOk && returnOk && mapOk && leakOk && persistOk;
  return {
    passed,
    details: { start, inEast, afterLock, afterLever, inTreasury, backInEast, mapShown, afterRestart, startedOk, toEastOk, lockOk, leverOk, toTreasuryOk, returnOk, mapOk, leakOk, persistOk },
  };
}
