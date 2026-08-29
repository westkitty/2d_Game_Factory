import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 2 proof - collectathon-platformer (see proofs/collectathon-platformer/PROOF_CONTRACT.md).
 *
 * A real generated game whose preset requires `sw2d.items` and whose shared
 * platform shell binds Collectible pickups to the reusable item service with
 * no game-specific pickup code. Walking picks up several canonical item
 * definitions; their effects (arcade score, a world flag via a chain effect)
 * land in the real services.
 */

interface ShellSnap {
  readonly x: number;
  readonly items: Readonly<Record<string, number>> | null;
  readonly pickupsRemaining: number;
  readonly score: number;
  readonly gotStar: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

async function stepUntil(harness: Harness, predicate: (s: ShellSnap) => boolean, maxFrames: number): Promise<ShellSnap> {
  for (let i = 0; i < maxFrames; i++) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(4);
  }
  return state(harness);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(20); // settle onto the ground
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.items') &&
    initial.score === 0 &&
    initial.gotStar === false &&
    // 4 catalog-known Collectibles are bound; the 5th ("not-in-catalog") is skipped.
    initial.pickupsRemaining === 4;

  // Walk right, collecting everything.
  await harness.keyDown('ArrowRight');
  const collected = await stepUntil(harness, (s) => s.pickupsRemaining === 0, 400);
  await harness.keyUp('ArrowRight');
  evidence.collected = collected;

  const inventoryOk =
    collected.items !== null &&
    collected.items['coin-1'] === 2 &&
    collected.items['gem-1'] === 1 &&
    collected.items['star-1'] === 1 &&
    collected.items['not-in-catalog'] === undefined;
  // 5 + 5 (coins) + 25 (gem) + 100 (star chain) = 135.
  const effectsOk = collected.score === 135 && collected.gotStar === true;

  // Restart genuinely reinstalls: fresh services, pickups back on the field.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(20);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.score === 0 &&
    afterRestart.gotStar === false &&
    afterRestart.pickupsRemaining === 4 &&
    (afterRestart.items === null || Object.keys(afterRestart.items).length === 0);

  const passed = startedOk && inventoryOk && effectsOk && restartOk;
  return { passed, details: { ...evidence, startedOk, inventoryOk, effectsOk, restartOk } };
}
