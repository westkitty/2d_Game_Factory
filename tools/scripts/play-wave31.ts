import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 31 play journeys against factory-generated games.
 * Closing-wall chase, two-unit box-select, sandbox pick-up/move.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ChaseSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly wallX: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PlatformShell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly chase?: ChaseSnap;
}

interface CommandSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: boolean;
  readonly selectedCount: number;
  readonly unitX: number;
  readonly unitY: number;
  readonly unit2X: number;
  readonly unit2Y: number;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly command?: CommandSnap;
}

interface ToySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: string;
  readonly blocks: number;
  readonly balls: number;
  readonly stamps: number;
  readonly held: string | null;
  readonly moved: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PointerShell {
  readonly toy?: ToySnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function pointerAt(
  harness: Harness,
  type: 'pointermove' | 'pointerdown' | 'pointerup',
  x: number,
  y: number,
): Promise<void> {
  await harness.page.evaluate(
    (p: { type: string; x: number; y: number }) => {
      const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser
        .canvas;
      const r = canvas.getBoundingClientRect();
      const clientX = r.left + (p.x / canvas.width) * r.width;
      const clientY = r.top + (p.y / canvas.height) * r.height;
      canvas.dispatchEvent(
        new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }),
      );
    },
    { type, x, y },
  );
}

async function clickAt(harness: Harness, x: number, y: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', x, y);
  await harness.stepFrames(4);
}

async function dragBox(harness: Harness, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x0, y0);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x0, y0);
  await harness.stepFrames(4);
  await pointerAt(harness, 'pointermove', x1, y1);
  await harness.stepFrames(6);
  await pointerAt(harness, 'pointerup', x1, y1);
  await harness.stepFrames(6);
}

async function chaseRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  await harness.keyDown('ArrowRight');
  let state = initial;
  for (let step = 0; step < 160 && state.chase?.outcome === 'playing'; step++) {
    await harness.stepFrames(4);
    state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  const passed =
    initial.chase?.mode === 'pursuit' &&
    initial.chase.outcome === 'playing' &&
    initial.chase.wallX < 40 &&
    initial.x < 200 &&
    state.chase?.outcome === 'complete' &&
    state.chase.lastResult === 'escaped' &&
    state.x >= 820 &&
    state.chase.wallX < state.x;
  return {
    passed,
    details: {
      initial: { x: initial.x, chase: initial.chase },
      done: { x: state.x, chase: state.chase },
    },
  };
}

async function rtsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await dragBox(harness, 160, 230, 250, 430);
  const boxed = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyDown('ArrowRight');
  let state = boxed;
  for (let step = 0; step < 160 && state.command?.outcome === 'playing'; step++) {
    await harness.stepFrames(4);
    state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const passed =
    initial.command?.mode === 'rts' &&
    initial.command.selected === false &&
    initial.command.selectedCount === 0 &&
    initial.command.unit2Y >= 380 &&
    boxed.command?.lastResult === 'boxed' &&
    boxed.command.selectedCount === 2 &&
    boxed.command.selected === true &&
    state.command?.outcome === 'complete' &&
    state.command.lastResult === 'seized' &&
    state.command.unitX >= 780 &&
    state.command.unit2X >= 780;
  return {
    passed,
    details: { initial: initial.command, boxed: boxed.command, done: state.command },
  };
}

async function sandboxRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await clickAt(harness, 400, 280);
  const block = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await clickAt(harness, 400, 280);
  const held = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await clickAt(harness, 500, 320);
  const moved = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await harness.keyTap('KeyK');
  await harness.stepFrames(4);
  const removed = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await clickAt(harness, 400, 280);
  const restamp = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const picked = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  await clickAt(harness, 600, 280);
  const done = (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
  const passed =
    initial?.mode === 'sandbox' &&
    initial.blocks === 0 &&
    initial.held === null &&
    initial.moved === 0 &&
    block?.lastResult === 'stamp-block' &&
    block.blocks === 1 &&
    held?.lastResult === 'hold-block' &&
    held.held === 'block' &&
    moved?.lastResult === 'move-block' &&
    moved.moved === 1 &&
    moved.held === null &&
    moved.blocks === 1 &&
    removed?.lastResult === 'remove-block' &&
    removed.blocks === 0 &&
    restamp?.lastResult === 'stamp-block' &&
    restamp.blocks === 1 &&
    picked?.selected === 'ball' &&
    done?.lastResult === 'stamp-ball' &&
    done.blocks === 1 &&
    done.balls === 1 &&
    done.outcome === 'complete';
  return { passed, details: { initial, block, held, moved, removed, restamp, picked, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-31 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave31-chase-platformer', run: chaseRun },
    { id: 'wave31-simple-rts', run: rtsRun },
    { id: 'wave31-sandbox-playground', run: sandboxRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-31 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
