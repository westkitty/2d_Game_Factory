import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Nav {
  readonly active: boolean;
  readonly mode: string | null;
  readonly runnersAlive: number;
  readonly blockedCount: number;
  readonly baseHp: number;
  readonly outcome: string;
  readonly lastResult: string | null;
}
interface Shell {
  readonly navigation?: Nav;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const spawned = await waitUntil(harness, read, (s) => (s.navigation?.runnersAlive ?? 0) >= 1, 40, 3);
  evidence.spawned = spawned.navigation;
  const startedOk =
    booted.installedPacks.includes('sw2d.encounters') &&
    booted.installedPacks.includes('sw2d.combat') &&
    spawned.navigation?.mode === 'lane' &&
    (spawned.navigation.runnersAlive ?? 0) >= 1;

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const blocked = await read();
  evidence.blocked = blocked.navigation;
  const blockedOk = (blocked.navigation?.blockedCount ?? 0) >= 1;

  const done = await waitUntil(
    harness,
    read,
    (s) => s.navigation?.outcome === 'complete' || s.navigation?.outcome === 'failed' || (s.navigation?.runnersAlive ?? 9) < (spawned.navigation?.runnersAlive ?? 0),
    180,
    4,
  );
  evidence.done = done.navigation;
  const progressOk =
    done.navigation?.outcome === 'complete' ||
    done.navigation?.outcome === 'failed' ||
    (done.navigation?.runnersAlive ?? 9) < (spawned.navigation?.runnersAlive ?? 0) ||
    (done.navigation?.baseHp ?? 3) < 3;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, navigation: fresh.navigation };
  const restartOk = run.after === run.before + 1 && (fresh.navigation?.blockedCount ?? 1) === 0 && fresh.navigation?.outcome === 'playing';

  const passed = startedOk && blockedOk && progressOk && restartOk;
  return { passed, details: { ...evidence, startedOk, blockedOk, progressOk, restartOk } };
}
