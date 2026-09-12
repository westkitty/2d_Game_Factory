import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 14 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.narrative
 * presentations: menu-verb IF vs walk-and-inspect clues.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface NarrativeSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly nodeId: string | null;
  readonly text: string;
  readonly selectedIndex: number;
  readonly selectedVerb: string | null;
  readonly flags: readonly string[];
  readonly seen: readonly string[];
  readonly choices: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: string;
}

interface UiShell {
  readonly narrative?: NarrativeSnap;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly narrative?: NarrativeSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function fictionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).narrative;

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const locked = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).narrative;

  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const looked = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).narrative;

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const done = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).narrative;

  const passed =
    initial?.mode === 'fiction' &&
    initial.nodeId === 'start' &&
    initial.selectedVerb === 'LOOK' &&
    initial.outcome === 'playing' &&
    locked?.lastResult === 'locked' &&
    locked.selectedVerb === 'TAKE' &&
    locked.outcome === 'playing' &&
    looked?.lastResult === 'looked' &&
    looked.flags.includes('saw-note') &&
    looked.seen.includes('note') &&
    looked.nodeId === 'looked' &&
    done?.lastResult === 'escaped' &&
    done.ending === 'escaped' &&
    done.choices.includes('take') &&
    done.outcome === 'complete';
  return { passed, details: { initial, locked, looked, done } };
}

async function snapCase(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
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
    let state = await snapCase(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snapCase(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return snapCase(harness);
}

async function caseRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapCase(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await snapCase(harness);

  const atPrint = await holdUntil(harness, 'ArrowRight', (s) => s.narrative?.nearId === 'print');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const print = await snapCase(harness);

  const atPhoto = await holdUntil(harness, 'ArrowRight', (s) => s.narrative?.nearId === 'photo');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const photo = await snapCase(harness);

  const atDesk = await holdUntil(harness, 'ArrowRight', (s) => s.narrative?.nearId === 'desk');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await snapCase(harness);

  const passed =
    initial.narrative?.mode === 'case' &&
    initial.narrative.seen.length === 0 &&
    initial.x === 120 &&
    tooFar.narrative?.lastResult === 'too-far' &&
    atPrint.narrative?.nearId === 'print' &&
    print.narrative?.lastResult === 'inspected' &&
    print.narrative.seen.includes('print') &&
    atPhoto.narrative?.nearId === 'photo' &&
    photo.narrative?.lastResult === 'inspected' &&
    photo.narrative.seen.includes('photo') &&
    photo.narrative.seen.length === 2 &&
    atDesk.narrative?.nearId === 'desk' &&
    done.narrative?.lastResult === 'deduced' &&
    done.narrative.ending === 'closed' &&
    done.narrative.choices.includes('deduce') &&
    done.narrative.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { x: initial.x, narrative: initial.narrative },
      tooFar: tooFar.narrative,
      atPrint: { x: atPrint.x, narrative: atPrint.narrative },
      print: print.narrative,
      atPhoto: { x: atPhoto.x, narrative: atPhoto.narrative },
      photo: photo.narrative,
      atDesk: { x: atDesk.x, narrative: atDesk.narrative },
      done: done.narrative,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-14 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave14-interactive-fiction-hybrid', run: fictionRun },
    { id: 'wave14-investigation-game', run: caseRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-14 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
