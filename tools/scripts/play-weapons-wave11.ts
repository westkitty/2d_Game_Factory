import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 11 play journeys against factory-generated games
 * (not starter-kit overlays). Proves vehicle heading-fire vs pointer
 * cursor-aimed fire through existing sw2d.weapons.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface WeaponSnap {
  readonly weaponId: string | null;
  readonly ammo: number | null;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
}

interface VehicleShell {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed?: number;
  readonly weapon?: WeaponSnap | null;
}

interface PointerShell {
  readonly activations?: number;
  readonly pointerWorldX?: number;
  readonly pointerWorldY?: number;
  readonly weapon?: WeaponSnap | null;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function asteroidsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<VehicleShell>(harness, 'game.vehicle-shell');

  await harness.keyDown('ArrowUp');
  await harness.stepFrames(20);
  const moved = await readShellState<VehicleShell>(harness, 'game.vehicle-shell');
  await harness.keyUp('ArrowUp');
  await harness.stepFrames(2);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(8);
  const fired = await readShellState<VehicleShell>(harness, 'game.vehicle-shell');

  const passed =
    initial.weapon?.weaponId === 'sidearm' &&
    (initial.weapon.projectilesSpawned ?? 0) === 0 &&
    ((moved.speed ?? 0) > 8 || Math.hypot(moved.x - initial.x, moved.y - initial.y) > 8) &&
    (fired.weapon?.projectilesSpawned ?? 0) >= 1;
  return {
    passed,
    details: {
      initial: { x: initial.x, y: initial.y, weapon: initial.weapon },
      moved: { x: moved.x, y: moved.y, speed: moved.speed },
      fired: fired.weapon,
    },
  };
}

async function galleryRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  await harness.keyTap('KeyJ');
  await harness.stepFrames(8);
  const fired = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  const passed =
    initial.weapon?.weaponId === 'sidearm' &&
    (initial.weapon.projectilesSpawned ?? 0) === 0 &&
    (fired.weapon?.projectilesSpawned ?? 0) >= 1;
  return {
    passed,
    details: {
      initial: { pointerWorldX: initial.pointerWorldX, pointerWorldY: initial.pointerWorldY, weapon: initial.weapon },
      fired: fired.weapon,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-11 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave11-asteroids-shooter', run: asteroidsRun },
    { id: 'wave11-gallery-shooter', run: galleryRun },
  ] as const;
  let failed = 0;
  for (const game of games) {
    process.stdout.write(`Playing ${game.id}...\n`);
    const result = await runSmoke({
      id: game.id,
      buildDir: path.join(REPO_ROOT, 'games', game.id, 'dist'),
      run: game.run,
    });
    const ok = result.passed;
    if (!ok) failed += 1;
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] ${game.id} console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`,
    );
  }
  console.log(`\n${games.length - failed}/${games.length} Wave-11 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
