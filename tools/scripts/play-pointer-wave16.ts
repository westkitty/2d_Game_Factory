import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 16 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different ADR-0018 presentations:
 * stroke polylines vs drag/drop wardrobe slots.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface PointerPlaySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly strokes: number;
  readonly strokeLength: number;
  readonly attached: readonly string[];
  readonly draggingId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PointerShell {
  readonly pointerPlay?: PointerPlaySnap;
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

async function dragFromTo(harness: Harness, x1: number, y1: number, x2: number, y2: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x1, y1);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x1, y1);
  await harness.stepFrames(2);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await pointerAt(harness, 'pointermove', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    await harness.stepFrames(1);
  }
  await pointerAt(harness, 'pointerup', x2, y2);
  await harness.stepFrames(4);
}

async function snapPlay(harness: Harness): Promise<PointerPlaySnap | undefined> {
  return (await readShellState<PointerShell>(harness, 'game.pointer-shell')).pointerPlay;
}

async function drawingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapPlay(harness);

  await dragFromTo(harness, 200, 200, 520, 200);
  const first = await snapPlay(harness);

  await dragFromTo(harness, 200, 320, 520, 320);
  const done = await snapPlay(harness);

  const passed =
    initial?.mode === 'draw' &&
    initial.strokes === 0 &&
    initial.outcome === 'playing' &&
    first?.lastResult === 'stroke' &&
    first.strokes === 1 &&
    first.outcome === 'playing' &&
    done?.lastResult === 'stroke' &&
    done.strokes === 2 &&
    done.outcome === 'complete';
  return { passed, details: { initial, first, done } };
}

async function wardrobeRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapPlay(harness);

  await dragFromTo(harness, 200, 160, 700, 200);
  const hat = await snapPlay(harness);

  await dragFromTo(harness, 200, 340, 700, 300);
  const done = await snapPlay(harness);

  const passed =
    initial?.mode === 'wardrobe' &&
    initial.attached.length === 0 &&
    initial.outcome === 'playing' &&
    hat?.lastResult === 'drop-hat' &&
    hat.attached.includes('hat') &&
    hat.attached.length === 1 &&
    hat.outcome === 'playing' &&
    done?.lastResult === 'drop-shirt' &&
    done.attached.includes('hat') &&
    done.attached.includes('shirt') &&
    done.attached.length === 2 &&
    done.outcome === 'complete';
  return { passed, details: { initial, hat, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-16 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave16-drawing-game', run: drawingRun },
    { id: 'wave16-dress-up-character-toy', run: wardrobeRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-16 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
