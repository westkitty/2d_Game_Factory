import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly currentNode: string;
  readonly discovered: readonly string[];
  readonly visited: readonly string[];
  readonly townVisitedFlag: boolean;
  readonly transitions: number;
  readonly roomDoorSprites: number;
  readonly overlappingDoor: string | null;
  readonly mapOpen: boolean;
  readonly mapDiscoveredCount: number;
  readonly knownEdges: number;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.top-down-shell');

async function walkToDoor(h: Harness, doorId: string): Promise<boolean> {
  // Areas are one screen; sweep right, then left, until the door is under the player.
  for (const dir of ['ArrowRight', 'ArrowLeft', 'ArrowRight'] as const) {
    for (let i = 0; i < 90; i++) {
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
  }
  return false;
}

async function go(h: Harness, doorId: string): Promise<boolean> {
  const reached = await walkToDoor(h, doorId);
  if (!reached) return false;
  await h.keyTap('KeyE'); // INTERACT
  await h.stepFrames(6);
  return true;
}

/**
 * Proof - exploration-game (see proofs/exploration-game/PROOF_CONTRACT.md).
 *
 * Three areas in a loop via the reusable sw2d.world-graph capability.
 * Discovery / visited state, the map, a persistent world flag surviving every
 * transition, and no room-resource accumulation after repeated back-and-forth.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  const start = await state(harness);
  const startedOk = start.currentNode === 'plaza' && start.townVisitedFlag === true && start.discovered.join(',') === 'plaza';

  const steps = ['plaza-garden', 'garden-library', 'library-garden', 'garden-plaza', 'plaza-garden', 'garden-plaza'];
  let allMoved = true;
  let maxDoorSprites = start.roomDoorSprites;
  let flagHeld = true;
  for (const door of steps) {
    const ok = await go(harness, door);
    const s = await state(harness);
    allMoved = allMoved && ok;
    maxDoorSprites = Math.max(maxDoorSprites, s.roomDoorSprites);
    flagHeld = flagHeld && s.townVisitedFlag === true;
  }
  const end = await state(harness);

  const traverseOk = allMoved && end.currentNode === 'plaza';
  const discoveryOk = [...end.discovered].sort().join(',') === 'garden,library,plaza' && [...end.visited].sort().join(',') === 'garden,library,plaza';
  const flagOk = flagHeld && end.townVisitedFlag === true;
  // garden has two doors; nothing should ever exceed that after the loops.
  const leakOk = maxDoorSprites <= 2;

  await harness.keyTap('KeyK'); // SECONDARY_ACTION -> map
  await harness.stepFrames(3);
  const mapShown = await state(harness);
  const mapOk = mapShown.mapOpen === true && mapShown.mapDiscoveredCount === 3 && mapShown.knownEdges >= 2;
  await harness.keyTap('KeyK');
  await harness.stepFrames(3);

  // Restart -> no persistence configured, back to the start.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(16);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk = restarted.scene === 'sw2d.play' && afterRestart.currentNode === 'plaza' && afterRestart.discovered.join(',') === 'plaza';

  const passed = startedOk && traverseOk && discoveryOk && flagOk && leakOk && mapOk && restartOk;
  return {
    passed,
    details: { start, end, mapShown, afterRestart, maxDoorSprites, startedOk, traverseOk, discoveryOk, flagOk, leakOk, mapOk, restartOk },
  };
}
