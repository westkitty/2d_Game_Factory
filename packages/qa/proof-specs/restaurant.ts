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
  readonly selectedId: string | null;
  readonly producing: { recipeId: string; remainingMs: number } | null;
  readonly lastResult: string | null;
  readonly frontWant: string | null;
}
interface Shell {
  readonly economy?: Economy;
}

async function selectRecipe(harness: Harness, read: () => Promise<Shell>, recipeId: string): Promise<void> {
  for (let i = 0; i < 6 && (await read()).economy?.selectedId !== recipeId; i++) await harness.keyTap('ArrowRight');
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = (await read()).economy;
  evidence.initial = initial;
  const startedOk = booted.scene === 'sw2d.play' && booted.installedPacks.includes('sw2d.economy') && initial?.mode === 'kitchen';

  // Serving with nothing cooked is refused.
  await harness.keyTap('Enter');
  const empty = (await read()).economy!;
  evidence.empty = { last: empty.lastResult, served: empty.served };
  const emptyOk = (empty.lastResult === 'no-stock' || empty.lastResult === 'no-customer') && empty.served === 0;

  // Cook-then-serve, three tickets: the kitchen loop, not a shop counter.
  const servings: { want: string | null; served: number; cash: number; last: string | null }[] = [];
  for (let n = 0; n < 3; n++) {
    const ticket = (await waitUntil(harness, read, (s) => (s.economy?.queue.length ?? 0) >= 1)).economy!;
    await selectRecipe(harness, read, `cook-${ticket.frontWant}`);
    await harness.keyTap('KeyK');
    const cooking = (await read()).economy!;
    if (n === 0) evidence.cooking = { producing: cooking.producing, last: cooking.lastResult };
    await waitUntil(harness, read, (s) => s.economy?.producing === null, 60, 3);
    await harness.keyTap('Enter');
    const after = (await read()).economy!;
    servings.push({ want: ticket.frontWant, served: after.served, cash: after.cash, last: after.lastResult });
  }
  evidence.servings = servings;
  const cookOk = (evidence.cooking as { producing: unknown }).producing !== null;
  const servedOk = servings[0]!.served === 1 && servings[2]!.served === 3 && servings[2]!.cash > servings[0]!.cash;

  // Pause/resume keeps the ledger; restart reinstalls a fresh kitchen.
  const paused = await pauseResume(harness);
  const resumed = (await read()).economy!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.served === 3;
  const run = await restartRun(harness);
  const fresh = (await read()).economy!;
  evidence.restart = { ...run, served: fresh.served, cash: fresh.cash, producing: fresh.producing };
  const restartOk = run.after === run.before + 1 && fresh.served === 0 && fresh.producing === null && fresh.cash === initial!.cash;

  const passed = startedOk && emptyOk && cookOk && servedOk && pauseOk && restartOk;
  return { passed, details: { ...evidence, startedOk, emptyOk, cookOk, servedOk, pauseOk, restartOk } };
}
