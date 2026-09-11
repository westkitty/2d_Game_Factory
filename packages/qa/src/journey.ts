import type { Harness } from './harness.ts';
import { readShellState, readSnapshot } from './snapshot.ts';

/**
 * Shared journey verbs for committed proof specs (Category-C convergence).
 *
 * Every generated shell boots the same way (CONFIRM on the start scene), is
 * paused the same way (PAUSE) and is restarted the same way (SECONDARY_ACTION
 * from the pause overlay - `PauseScene.ts`). The first twenty-three proof
 * specs each re-typed those key sequences; the Category-C proofs share them
 * here so a change to the runtime's pause/restart contract fails in one
 * place. Nothing here asserts anything - a spec still owns its oracle.
 */

/** CONFIRM on the start scene, then settle. */
export async function startPlay(harness: Harness, settleFrames = 8): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(settleFrames);
}

/** Step the deterministic clock until `predicate` holds or the budget runs out; returns the last state read. */
export async function waitUntil<T>(
  harness: Harness,
  read: () => Promise<T>,
  predicate: (state: T) => boolean,
  maxSteps = 90,
  framesPerStep = 5,
): Promise<T> {
  let state = await read();
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await read();
  }
  return state;
}

/** Hold one or more keys until `predicate` holds (or the budget runs out), then release them in reverse order. */
export async function holdUntil<T>(
  harness: Harness,
  codes: readonly string[],
  read: () => Promise<T>,
  predicate: (state: T) => boolean,
  maxSteps = 140,
  framesPerStep = 4,
): Promise<T> {
  for (const code of codes) await harness.keyDown(code);
  try {
    return await waitUntil(harness, read, predicate, maxSteps, framesPerStep);
  } finally {
    for (const code of [...codes].reverse()) await harness.keyUp(code);
    await harness.stepFrames(2);
  }
}

/** PAUSE, settle, PAUSE again. Returns the paused snapshot's `paused` flag so a spec can assert the overlay really engaged. */
export async function pauseResume(harness: Harness): Promise<{ readonly pausedDuring: boolean; readonly pausedAfter: boolean }> {
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  const pausedDuring = (await readSnapshot(harness)).paused;
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  const pausedAfter = (await readSnapshot(harness)).paused;
  return { pausedDuring, pausedAfter };
}

/** PAUSE then SECONDARY_ACTION on the pause overlay: a real scene reinstall (`runIndex` advances). Returns the run index before and after. */
export async function restartRun(harness: Harness, settleFrames = 12): Promise<{ readonly before: number; readonly after: number }> {
  const before = (await readSnapshot(harness)).runIndex;
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(settleFrames);
  const after = (await readSnapshot(harness)).runIndex;
  return { before, after };
}

/** Dispatch a synthetic pointer event at canvas-space coordinates (the generated pointer shells read the spatial pointer from these). */
export async function pointerAt(
  harness: Harness,
  type: 'pointermove' | 'pointerdown' | 'pointerup',
  x: number,
  y: number,
): Promise<void> {
  await harness.page.evaluate(
    (p: { type: string; x: number; y: number }) => {
      const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
      const r = canvas.getBoundingClientRect();
      const clientX = r.left + (p.x / canvas.width) * r.width;
      const clientY = r.top + (p.y / canvas.height) * r.height;
      canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
    },
    { type, x, y },
  );
}

/** move → down → up at one canvas point, settling two frames between each. */
export async function clickAt(harness: Harness, x: number, y: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', x, y);
  await harness.stepFrames(2);
}

/** Read one shell's debug contribution, typed by the caller. */
export function shellReader<T>(harness: Harness, shellPackId: string): () => Promise<T> {
  return () => readShellState<T>(harness, shellPackId);
}
