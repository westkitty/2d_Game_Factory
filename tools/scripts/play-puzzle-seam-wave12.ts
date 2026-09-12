import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 12 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.puzzle code-seam
 * presentations: Matter ball-in-goal vs gated note/key inspect.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface PuzzleSnap {
  readonly kind: string | null;
  readonly solved: boolean;
  readonly inGoal: boolean;
  readonly note: boolean;
  readonly key: boolean;
  readonly lastResult: string | null;
  readonly ball: { readonly x: number; readonly y: number } | null;
}

interface PointerShell {
  readonly lastResult?: string | null;
  readonly nudges?: number;
  readonly hoveredId?: string | null;
  readonly puzzle?: PuzzleSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function pointerAt(harness: Harness, type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number): Promise<void> {
  await harness.page.evaluate((p: { type: string; x: number; y: number }) => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + (p.x / canvas.width) * r.width;
    const clientY = r.top + (p.y / canvas.height) * r.height;
    canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
  }, { type, x, y });
}

async function clickAt(harness: Harness, x: number, y: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', x, y);
  await harness.stepFrames(2);
}

async function physicsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  await harness.stepFrames(30);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  await harness.keyTap('KeyJ');
  await harness.stepFrames(90);
  const landed = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  const passed =
    initial.puzzle?.kind === 'physics-goal' &&
    initial.puzzle.solved === false &&
    (initial.puzzle.ball?.x ?? 999) < 400 &&
    landed.puzzle?.solved === true &&
    landed.puzzle.inGoal === true &&
    (landed.puzzle.ball?.x ?? 0) >= 740;
  return {
    passed,
    details: {
      initial: initial.puzzle,
      landed: landed.puzzle,
      nudges: landed.nudges,
    },
  };
}

async function escapeRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  await clickAt(harness, 480, 280);
  const locked = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  await clickAt(harness, 240, 280);
  const note = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  await clickAt(harness, 480, 280);
  const unlocked = await readShellState<PointerShell>(harness, 'game.pointer-shell');

  const passed =
    initial.puzzle?.kind === 'escape-locks' &&
    initial.puzzle.note === false &&
    initial.puzzle.key === false &&
    initial.puzzle.solved === false &&
    locked.puzzle?.lastResult === 'locked' &&
    locked.puzzle.solved === false &&
    note.puzzle?.note === true &&
    note.puzzle.key === false &&
    unlocked.puzzle?.key === true &&
    unlocked.puzzle.solved === true;
  return {
    passed,
    details: {
      initial: initial.puzzle,
      locked: locked.puzzle,
      note: note.puzzle,
      unlocked: unlocked.puzzle,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-12 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave12-physics-puzzle', run: physicsRun },
    { id: 'wave12-escape-room', run: escapeRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-12 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
