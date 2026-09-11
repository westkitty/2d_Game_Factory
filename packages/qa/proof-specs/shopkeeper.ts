import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Economy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly cash: number;
  readonly stock: Readonly<Record<string, number>>;
  readonly queue: readonly { id: string; goodId: string }[];
  readonly served: number;
  readonly lost: number;
  readonly selectedId: string | null;
  readonly lastResult: string | null;
  readonly frontWant: string | null;
}
interface Shell {
  readonly economy?: Economy;
}

/** Cycle the selection until it matches `goodId` (bounded - the catalog is small). */
async function selectGood(harness: Harness, read: () => Promise<Shell>, goodId: string): Promise<void> {
  for (let i = 0; i < 6 && (await read()).economy?.selectedId !== goodId; i++) {
    await harness.keyTap('ArrowRight');
  }
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = (await read()).economy;
  evidence.initial = initial;
  const startedOk = booted.scene === 'sw2d.play' && booted.installedPacks.includes('sw2d.economy') && initial?.active === true && initial.mode === 'shop';

  // A customer arrives with a demand; serving the matching good settles cash.
  const arrived = (await waitUntil(harness, read, (s) => (s.economy?.queue.length ?? 0) >= 1)).economy!;
  evidence.arrived = { want: arrived.frontWant, cash: arrived.cash, queue: arrived.queue.length };
  await selectGood(harness, read, arrived.frontWant!);
  await harness.keyTap('Enter');
  const served = (await read()).economy!;
  evidence.served = { served: served.served, cash: served.cash, last: served.lastResult };
  const serveOk = served.served === 1 && served.cash > arrived.cash && served.lastResult === 'served';

  // Serve spam with nobody at the counter is refused, not double-charged.
  for (let i = 0; i < 6; i++) await harness.keyTap('Enter');
  const spam = (await read()).economy!;
  evidence.spam = { served: spam.served, cash: spam.cash, last: spam.lastResult };
  const spamOk = spam.served <= served.served + 1 && (spam.lastResult === 'no-customer' || spam.lastResult === 'served');

  // Restock costs cash; restocking past the wallet is refused.
  await selectGood(harness, read, 'bread');
  await harness.keyTap('KeyK');
  const restocked = (await read()).economy!;
  evidence.restocked = { bread: restocked.stock.bread, cash: restocked.cash, last: restocked.lastResult };
  const restockOk = restocked.lastResult === 'restocked' && restocked.cash < spam.cash;
  for (let i = 0; i < 24; i++) await harness.keyTap('KeyK');
  const broke = (await read()).economy!;
  evidence.broke = { bread: broke.stock.bread, cash: broke.cash, last: broke.lastResult };
  const brokeOk = broke.lastResult === 'cannot-afford' && broke.cash >= 0;

  // A second customer served after the restock; pause/resume preserves the ledger.
  const second = (await waitUntil(harness, read, (s) => (s.economy?.queue.length ?? 0) >= 1)).economy!;
  await selectGood(harness, read, second.frontWant!);
  await harness.keyTap('Enter');
  const twice = (await read()).economy!;
  evidence.twice = { served: twice.served, cash: twice.cash, last: twice.lastResult };
  const twiceOk = twice.served >= 2 || twice.lastResult === 'no-stock';
  const paused = await pauseResume(harness);
  const resumed = (await read()).economy!;
  evidence.pause = { ...paused, served: resumed.served, cash: resumed.cash };
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.served === twice.served && resumed.cash === twice.cash;

  // Restart reinstalls a fresh economy.
  const run = await restartRun(harness);
  const fresh = (await read()).economy!;
  evidence.restart = { ...run, served: fresh.served, cash: fresh.cash };
  const restartOk = run.after === run.before + 1 && fresh.served === 0 && fresh.cash === initial!.cash;

  const passed = startedOk && serveOk && spamOk && restockOk && brokeOk && twiceOk && pauseOk && restartOk;
  return { passed, details: { ...evidence, startedOk, serveOk, spamOk, restockOk, brokeOk, twiceOk, pauseOk, restartOk } };
}
