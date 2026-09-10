import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 20 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different ADR-0018 presentations:
 * walk-and-capture photography vs click-to-stamp sandbox.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ToySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly shots: number;
  readonly captured: readonly string[];
  readonly selected: string;
  readonly blocks: number;
  readonly balls: number;
  readonly stamps: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly toy?: ToySnap;
}

interface PointerShell {
  readonly toy?: ToySnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snapPhoto(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function snapSandbox(harness: Harness): Promise<ToySnap | undefined> {
  return (await readShellState<PointerShell>(harness, 'game.pointer-shell')).toy;
}

async function holdUntil(
  harness: Harness,
  code: string,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 80,
  framesPerStep = 4,
): Promise<TopDownShell> {
  await harness.keyDown(code);
  try {
    let state = await snapPhoto(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snapPhoto(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return snapPhoto(harness);
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
  await harness.stepFrames(4);
}

async function photoRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapPhoto(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await snapPhoto(harness);

  const atBird = await holdUntil(harness, 'ArrowRight', (s) => s.toy?.nearId === 'bird');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const bird = await snapPhoto(harness);

  const atTree = await holdUntil(harness, 'ArrowRight', (s) => s.toy?.nearId === 'tree');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await snapPhoto(harness);

  const passed =
    initial.toy?.mode === 'photo' &&
    initial.toy.shots === 0 &&
    initial.x === 120 &&
    tooFar.toy?.lastResult === 'too-far' &&
    atBird.toy?.nearId === 'bird' &&
    bird.toy?.lastResult === 'shot-bird' &&
    bird.toy.captured.includes('bird') &&
    bird.toy.shots === 1 &&
    bird.toy.outcome === 'playing' &&
    atTree.toy?.nearId === 'tree' &&
    done.toy?.lastResult === 'shot-tree' &&
    done.toy.captured.includes('bird') &&
    done.toy.captured.includes('tree') &&
    done.toy.shots === 2 &&
    done.toy.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { x: initial.x, toy: initial.toy },
      tooFar: tooFar.toy,
      atBird: { x: atBird.x, toy: atBird.toy },
      bird: bird.toy,
      atTree: { x: atTree.x, toy: atTree.toy },
      done: done.toy,
    },
  };
}

async function sandboxRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapSandbox(harness);

  await clickAt(harness, 400, 280);
  const block = await snapSandbox(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const picked = await snapSandbox(harness);

  await clickAt(harness, 600, 280);
  const done = await snapSandbox(harness);

  const passed =
    initial?.mode === 'sandbox' &&
    initial.blocks === 0 &&
    initial.balls === 0 &&
    initial.selected === 'block' &&
    initial.outcome === 'playing' &&
    block?.lastResult === 'stamp-block' &&
    block.blocks === 1 &&
    block.balls === 0 &&
    block.outcome === 'playing' &&
    picked?.selected === 'ball' &&
    done?.lastResult === 'stamp-ball' &&
    done.blocks === 1 &&
    done.balls === 1 &&
    done.outcome === 'complete';
  return { passed, details: { initial, block, picked, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-20 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave20-photography-game', run: photoRun },
    { id: 'wave20-sandbox-playground', run: sandboxRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-20 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
