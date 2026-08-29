import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 2 proof - top-down-adventure (see proofs/top-down-adventure/PROOF_CONTRACT.md).
 *
 * The cross-family consumer of the reusable item/effect system: a different
 * preset (top-down, not platform), different effect kinds (world.flag,
 * progression.currency, progression.xp) and a real consume() path - all
 * through the same `sw2d.items` service and the same shared shell binding.
 */

interface ShellSnap {
  readonly items: Readonly<Record<string, number>> | null;
  readonly pickupsRemaining: number;
  readonly hasMapKey: boolean;
  readonly currency: number;
  readonly xp: number;
  readonly canEatRation: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
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
  await harness.stepFrames(10);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.items') &&
    initial.hasMapKey === false &&
    initial.currency === 0 &&
    initial.pickupsRemaining === 4;

  // Sweep right through every pickup on the spawn row.
  await harness.keyDown('ArrowRight');
  const collected = await stepUntil(harness, (s) => s.pickupsRemaining === 0, 400);
  await harness.keyUp('ArrowRight');
  evidence.collected = collected;
  const collectOk =
    collected.hasMapKey === true && // world.flag effect
    collected.currency === 20 && // 2 gold pouches x progression.currency 10
    collected.items?.['ration'] === 2 && // quantityPerGrant 2
    collected.items?.['gold-pouch'] === 2 &&
    collected.items?.['map-key'] === 1 &&
    collected.canEatRation === true;

  // Consume: INTERACT eats one ration, applying its progression.xp effect.
  await harness.keyTap('KeyE');
  await harness.stepFrames(6);
  const afterOne = await state(harness);
  await harness.keyTap('KeyE');
  await harness.stepFrames(6);
  const afterTwo = await state(harness);
  evidence.afterOne = afterOne;
  evidence.afterTwo = afterTwo;
  const consumeOk =
    afterOne.items?.['ration'] === 1 &&
    afterOne.xp === 3 &&
    afterTwo.items?.['ration'] === undefined &&
    afterTwo.xp === 6 &&
    afterTwo.canEatRation === false;

  // Restart reinstalls: fresh services, pickups back, inventory cleared
  // (this preset's sw2d.items config does not persist).
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.hasMapKey === false &&
    afterRestart.currency === 0 &&
    afterRestart.xp === 0 &&
    afterRestart.pickupsRemaining === 4 &&
    (afterRestart.items === null || Object.keys(afterRestart.items).length === 0);

  const passed = startedOk && collectOk && consumeOk && restartOk;
  return { passed, details: { ...evidence, startedOk, collectOk, consumeOk, restartOk } };
}
