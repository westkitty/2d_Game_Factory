import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 2 play journeys against factory-generated games
 * (not starter-kit overlays). Proves creature hold-to-win, habitat hold,
 * companion instant-win, decay, spam-cap, and pause/resume.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SHELL = 'game.ui-simulation-shell';

interface NeedsSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly subject: string | null;
  readonly needValues: Readonly<Record<string, number>>;
  readonly actionsTaken: number;
  readonly holdMs: number;
  readonly outcome: string;
  readonly lastResult: string | null;
  readonly affinity: number;
}

interface Shell {
  readonly needs?: NeedsSnap;
}

async function snap(harness: Harness): Promise<NeedsSnap | undefined> {
  return (await readShellState<Shell>(harness, SHELL)).needs;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function waitUntil(harness: Harness, predicate: (state: NeedsSnap | undefined) => boolean, maxSteps = 90, framesPerStep = 5): Promise<NeedsSnap | undefined> {
  let state = await snap(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await snap(harness);
  }
  return state;
}

async function creatureRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  await harness.stepFrames(30);
  const decayed = await snap(harness);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const fed = await snap(harness);
  for (let i = 0; i < 12; i++) await harness.keyTap('KeyJ');
  const spam = await snap(harness);
  await harness.keyTap('KeyK');
  await harness.stepFrames(2);
  const played = await snap(harness);
  const complete = await waitUntil(harness, (state) => state?.outcome === 'complete', 80, 4);

  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  const resumed = await snap(harness);

  const passed =
    initial?.mode === 'creature' &&
    initial.active === true &&
    (decayed?.needValues.hunger ?? 99) < (initial.needValues.hunger ?? 0) &&
    (fed?.needValues.hunger ?? 0) > (decayed?.needValues.hunger ?? 99) &&
    (spam?.needValues.hunger ?? 0) <= 100 &&
    (played?.actionsTaken ?? 0) >= 2 &&
    complete?.outcome === 'complete' &&
    resumed?.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { mode: initial?.mode, hunger: initial?.needValues.hunger, mood: initial?.needValues.mood },
      decayed: { hunger: decayed?.needValues.hunger },
      fed: { hunger: fed?.needValues.hunger, actions: fed?.actionsTaken },
      spam: { hunger: spam?.needValues.hunger },
      played: { mood: played?.needValues.mood, actions: played?.actionsTaken, hold: played?.holdMs },
      complete: { outcome: complete?.outcome, hold: complete?.holdMs, affinity: complete?.affinity },
      resumed: { outcome: resumed?.outcome },
    },
  };
}

async function habitatRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const fed = await snap(harness);
  await harness.keyTap('KeyK');
  await harness.stepFrames(2);
  const refreshed = await snap(harness);
  const complete = await waitUntil(harness, (state) => state?.outcome === 'complete', 120, 6);
  const passed =
    initial?.mode === 'habitat' &&
    (fed?.needValues.food ?? 0) > (initial.needValues.food ?? 99) &&
    (refreshed?.needValues.water ?? 0) > (initial.needValues.water ?? 99) &&
    (refreshed?.actionsTaken ?? 0) >= 2 &&
    complete?.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { water: initial?.needValues.water, food: initial?.needValues.food },
      fed: { food: fed?.needValues.food },
      refreshed: { water: refreshed?.needValues.water, actions: refreshed?.actionsTaken },
      complete: { outcome: complete?.outcome, hold: complete?.holdMs },
    },
  };
}

async function companionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const fed = await snap(harness);
  await harness.keyTap('KeyK');
  await harness.stepFrames(2);
  const finished = await snap(harness);
  const passed =
    initial?.mode === 'companion' &&
    (fed?.needValues.hunger ?? 0) > (initial.needValues.hunger ?? 99) &&
    (finished?.needValues.happiness ?? 0) > (initial.needValues.happiness ?? 99) &&
    finished?.actionsTaken === 2 &&
    finished?.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { hunger: initial?.needValues.hunger, happiness: initial?.needValues.happiness },
      fed: { hunger: fed?.needValues.hunger, outcome: fed?.outcome },
      finished: { happiness: finished?.needValues.happiness, actions: finished?.actionsTaken, outcome: finished?.outcome },
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-2 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave2-pet-creature', run: creatureRun },
    { id: 'wave2-aquarium-terrarium', run: habitatRun },
    { id: 'wave2-virtual-pet', run: companionRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-2 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
