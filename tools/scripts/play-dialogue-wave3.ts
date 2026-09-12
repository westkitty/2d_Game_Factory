import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 3 play journeys against factory-generated games
 * (not starter-kit overlays). Proves novel branching endings and
 * adventure hotspot inspect / gated exit.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface DialogueSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly kind: string;
  readonly step: number;
  readonly selectedIndex: number;
  readonly branch: string | null;
  readonly ending: string | null;
  readonly outcome: string;
  readonly flags: readonly string[];
  readonly lastResult: string | null;
}

interface UiShell {
  readonly dialogue?: DialogueSnap;
}

interface PointerShell {
  readonly dialogue?: DialogueSnap;
  readonly hoveredId: string | null;
}

async function uiSnap(harness: Harness): Promise<DialogueSnap | undefined> {
  return (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).dialogue;
}

async function pointerSnap(harness: Harness): Promise<PointerShell> {
  return readShellState<PointerShell>(harness, 'game.pointer-shell');
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
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

async function novelRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  await harness.keyTap('ArrowRight');
  const choosing = await uiSnap(harness);
  await harness.keyTap('Space');
  const branched = await uiSnap(harness);
  await harness.keyTap('Space');
  const midnight = await uiSnap(harness);

  await harness.keyTap('KeyP');
  await harness.stepFrames(3);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  const dawn = await uiSnap(harness);

  const passed =
    choosing?.mode === 'novel' &&
    choosing.step === 2 &&
    choosing.selectedIndex === 1 &&
    branched?.branch === 'keep-the-secret' &&
    midnight?.ending === 'midnight-ending' &&
    midnight.outcome === 'complete' &&
    dawn?.ending === 'dawn-ending' &&
    dawn.outcome === 'complete';
  return { passed, details: { choosing, branched, midnight, dawn } };
}

async function adventureRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await pointerSnap(harness);
  await clickAt(harness, 720, 280);
  const locked = await pointerSnap(harness);
  await clickAt(harness, 240, 280);
  const noteOpen = await pointerSnap(harness);
  await harness.keyTap('Space');
  const noteDone = await pointerSnap(harness);
  await clickAt(harness, 480, 280);
  await harness.keyTap('Space');
  const clockDone = await pointerSnap(harness);
  await clickAt(harness, 720, 280);
  const doorOpen = await pointerSnap(harness);
  await harness.keyTap('Space');
  const escaped = await pointerSnap(harness);

  const passed =
    initial.dialogue?.mode === 'adventure' &&
    initial.dialogue.kind === 'idle' &&
    (locked.dialogue?.lastResult === 'locked' || (locked.dialogue?.flags.length ?? 0) === 0) &&
    noteOpen.dialogue?.flags.includes('saw-note') === true &&
    noteDone.dialogue?.kind === 'idle' &&
    clockDone.dialogue?.flags.includes('saw-clock') === true &&
    doorOpen.dialogue?.kind === 'end' &&
    escaped.dialogue?.ending === 'escaped' &&
    escaped.dialogue.outcome === 'complete';
  return {
    passed,
    details: {
      initial: initial.dialogue,
      locked: locked.dialogue,
      noteOpen: noteOpen.dialogue,
      noteDone: noteDone.dialogue,
      clockDone: clockDone.dialogue,
      doorOpen: doorOpen.dialogue,
      escaped: escaped.dialogue,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-3 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave3-visual-novel', run: novelRun },
    { id: 'wave3-point-and-click', run: adventureRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-3 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
