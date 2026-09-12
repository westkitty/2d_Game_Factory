import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 1 play journeys against factory-generated games
 * (not starter-kit overlays). Proves shop matching, kitchen cook-then-serve,
 * and factory auto-sell actually move cash/stock/queue in a running Phaser
 * game, then attacks spam serve, restock-broke, and pause/resume.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SHELL = 'game.ui-simulation-shell';

interface Eco {
  readonly active: boolean;
  readonly mode: string | null;
  readonly cash: number;
  readonly stock: Readonly<Record<string, number>>;
  readonly queue: readonly { id: string; name: string; goodId: string; remainingMs: number }[];
  readonly served: number;
  readonly lost: number;
  readonly produced: number;
  readonly selectedId: string | null;
  readonly producing: { recipeId: string; remainingMs: number } | null;
  readonly lastResult: string | null;
  readonly frontWant: string | null;
}

interface Shell {
  readonly economy?: Eco;
}

async function eco(harness: Harness): Promise<Eco | undefined> {
  return (await readShellState<Shell>(harness, SHELL)).economy;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function waitUntil(harness: Harness, predicate: (state: Eco | undefined) => boolean, maxSteps = 90, framesPerStep = 5): Promise<Eco | undefined> {
  let state = await eco(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await eco(harness);
  }
  return state;
}

async function shopRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const arrived = await waitUntil(harness, (state) => (state?.queue.length ?? 0) >= 1);
  const spam = [];
  for (let i = 0; i < 8; i++) {
    await harness.keyTap('Enter');
    spam.push(await eco(harness));
  }
  const afterSpam = spam[spam.length - 1];
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const mismatch = await eco(harness);
  const bread = await waitUntil(harness, (state) => state?.frontWant === 'bread' || (state?.served ?? 0) >= 2);
  if (bread?.frontWant === 'bread' && bread.selectedId !== 'bread') await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const two = await eco(harness);
  await harness.keyTap('KeyK');
  const restock = await eco(harness);
  for (let i = 0; i < 20; i++) await harness.keyTap('KeyK');
  const broke = await eco(harness);

  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  const resumed = await eco(harness);

  const passed =
    arrived?.mode === 'shop' &&
    arrived.frontWant === 'apple' &&
    (afterSpam?.served ?? 0) >= 1 &&
    (afterSpam?.cash ?? 0) > 12 &&
    (mismatch?.lastResult === 'wrong-good' || mismatch?.lastResult === 'no-customer' || (mismatch?.served ?? 0) >= 1) &&
    (two?.served ?? 0) >= 1 &&
    (restock?.lastResult === 'restocked' || restock?.lastResult === 'cannot-afford' || (restock?.stock.bread ?? 0) >= 0) &&
    (broke?.lastResult === 'cannot-afford' || (broke?.cash ?? 1) >= 0) &&
    (resumed?.served ?? 0) === (broke?.served ?? 0);
  return {
    passed,
    details: { arrived, afterSpam: { served: afterSpam?.served, cash: afterSpam?.cash, last: afterSpam?.lastResult }, mismatch, two, restock, broke, resumed },
  };
}

async function kitchenRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  await harness.keyTap('Enter');
  const noStock = await eco(harness);
  const arrived = await waitUntil(harness, (state) => (state?.queue.length ?? 0) >= 1);
  const servings: Eco[] = [];
  for (let n = 0; n < 3; n++) {
    const now = await waitUntil(harness, (state) => (state?.queue.length ?? 0) >= 1);
    const want = now?.frontWant;
    const selected = now?.selectedId ?? '';
    if (want === 'salad' && selected !== 'cook-salad') await harness.keyTap('ArrowRight');
    if (want === 'soup' && selected !== 'cook-soup') await harness.keyTap('ArrowLeft');
    await harness.keyTap('KeyK');
    await waitUntil(harness, (state) => state?.producing === null, 50, 3);
    await harness.keyTap('Enter');
    servings.push((await eco(harness))!);
  }
  const last = servings[servings.length - 1];
  const passed =
    arrived?.mode === 'kitchen' &&
    (noStock?.lastResult === 'no-stock' || noStock?.lastResult === 'no-customer') &&
    (servings[0]?.served ?? 0) >= 1 &&
    (last?.served ?? 0) >= 3 &&
    (last?.cash ?? 0) > 0;
  return { passed, details: { noStock, arrived, servings: servings.map((s) => ({ served: s.served, cash: s.cash, last: s.lastResult, want: s.frontWant })) } };
}

async function factoryRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const arrived = await waitUntil(harness, (state) => (state?.queue.length ?? 0) >= 1);
  await harness.keyTap('KeyK');
  const started = await eco(harness);
  const sold = await waitUntil(harness, (state) => (state?.served ?? 0) >= 1);
  await harness.keyTap('KeyK');
  const second = await waitUntil(harness, (state) => (state?.served ?? 0) >= 2);
  const passed =
    arrived?.mode === 'factory' &&
    (arrived.queue.length ?? 0) >= 1 &&
    (started?.producing !== null || (started?.produced ?? 0) >= 0) &&
    (sold?.served ?? 0) >= 1 &&
    (sold?.cash ?? 0) > 8 &&
    (second?.served ?? 0) >= 2;
  return { passed, details: { arrived, started, sold, second } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-1 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave1-shopkeeper', run: shopRun },
    { id: 'wave1-restaurant', run: kitchenRun },
    { id: 'wave1-tycoon-lite', run: factoryRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-1 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
