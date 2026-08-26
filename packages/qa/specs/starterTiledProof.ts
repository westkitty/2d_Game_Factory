import { readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface TiledLevelExtra {
  readonly player: { readonly x: number; readonly y: number };
  readonly collectiblesCollected: number;
  readonly hazardsTouched: number;
  readonly checkpointActive: string | null;
  readonly cleared: boolean;
}

async function state(harness: Harness): Promise<TiledLevelExtra> {
  const snapshot = await readSnapshot(harness);
  return snapshot.extra['starter.tiled-level'] as TiledLevelExtra;
}

/**
 * Automates the Phase 6 Tiled/content-pipeline proof journey
 * (tiled-proof.html): every position in content/levels/intro.json - the
 * checkpoint, collectible, hazard, and exit - is real Tiled object data
 * flowing through the normalizer and entity registry, not hard-coded
 * coordinates in this shell pack (starter/src/game-specific/
 * tiledLevelPack.ts's own file comment). The whole ground-level walk from
 * spawn (x=60) to the exit (x=900) needs no jump - the ground strip runs
 * the full level width.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  const boot = await readSnapshot(harness);
  const bootProven = boot.scene === 'sw2d.title';

  await harness.keyTap('Space'); // CONFIRM -> title to play
  await harness.stepFrames(5);
  const spawnShell = await state(harness);
  const movementSourcedFromTiledProven = spawnShell.player.x < 70; // matches PlayerSpawn x=60 in intro.json

  await harness.keyDown('ArrowRight');

  let checkpointShell = spawnShell;
  for (let i = 0; i < 100 && !checkpointShell.checkpointActive; i++) {
    await harness.stepFrames(5);
    checkpointShell = await state(harness);
  }
  const checkpointProven = checkpointShell.checkpointActive === 'checkpoint-1';

  let collectibleShell = checkpointShell;
  for (let i = 0; i < 100 && collectibleShell.collectiblesCollected < 1; i++) {
    await harness.stepFrames(5);
    collectibleShell = await state(harness);
  }
  const collectibleProven = collectibleShell.collectiblesCollected >= 1;

  let hazardShell = collectibleShell;
  for (let i = 0; i < 100 && hazardShell.hazardsTouched < 1; i++) {
    await harness.stepFrames(5);
    hazardShell = await state(harness);
  }
  const hazardProven = hazardShell.hazardsTouched >= 1;

  let exitShell = hazardShell;
  for (let i = 0; i < 200 && !exitShell.cleared; i++) {
    await harness.stepFrames(5);
    exitShell = await state(harness);
  }
  await harness.keyUp('ArrowRight');
  const exitProven = exitShell.cleared === true;

  return {
    passed: bootProven && movementSourcedFromTiledProven && checkpointProven && collectibleProven && hazardProven && exitProven,
    details: {
      boot,
      spawnShell,
      checkpointShell,
      collectibleShell,
      hazardShell,
      exitShell,
      bootProven,
      movementSourcedFromTiledProven,
      checkpointProven,
      collectibleProven,
      hazardProven,
      exitProven,
    },
  };
}
