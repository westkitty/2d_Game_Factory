import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 13 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.simulation
 * presentations: plant/grow/harvest plots vs worker gather + construct.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface SimulationSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selectedIndex: number;
  readonly crops: number;
  readonly materials: number;
  readonly plots: readonly { readonly phase: string; readonly remainingMs: number }[];
  readonly workers: readonly { readonly busy: boolean; readonly remainingMs: number }[];
  readonly constructing: boolean;
  readonly constructRemainingMs: number;
  readonly built: boolean;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly jobCount: number;
}

interface UiShell {
  readonly simulation?: SimulationSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function waitJobs(harness: Harness): Promise<SimulationSnap> {
  await harness.stepFrames(50);
  const shell = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  return shell.simulation!;
}

async function farmRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const planted = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;
  const ripe0 = await waitJobs(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const harvested1 = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  const ripe1 = await waitJobs(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const harvested2 = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  const ripe2 = await waitJobs(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const done = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  const passed =
    initial?.mode === 'farm' &&
    initial.crops === 0 &&
    initial.plots[0]?.phase === 'empty' &&
    planted?.lastResult === 'planted' &&
    planted.plots[0]?.phase === 'growing' &&
    ripe0.plots[0]?.phase === 'ripe' &&
    harvested1?.crops === 1 &&
    harvested1.lastResult === 'harvested' &&
    ripe1.plots[1]?.phase === 'ripe' &&
    harvested2?.crops === 2 &&
    ripe2.plots[2]?.phase === 'ripe' &&
    done?.crops === 3 &&
    done.outcome === 'complete';
  return {
    passed,
    details: { initial, planted, ripe0, harvested1, ripe1, harvested2, ripe2, done },
  };
}

async function colonyRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const need = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;

  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const assigned0 = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;
  const gathered0 = await waitJobs(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  const gathered1 = await waitJobs(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const building = (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).simulation;
  const done = await waitJobs(harness);

  const passed =
    initial?.mode === 'colony' &&
    initial.materials === 0 &&
    initial.workers[0]?.busy === false &&
    initial.built === false &&
    need?.lastResult === 'need-materials' &&
    need.selectedIndex === 2 &&
    assigned0?.lastResult === 'assigned' &&
    assigned0.workers[0]?.busy === true &&
    gathered0.materials === 1 &&
    gathered0.workers[0]?.busy === false &&
    gathered1.materials === 2 &&
    building?.constructing === true &&
    building.lastResult === 'building' &&
    done.built === true &&
    done.outcome === 'complete';
  return {
    passed,
    details: { initial, need, assigned0, gathered0, gathered1, building, done },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-13 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave13-farming-lite', run: farmRun },
    { id: 'wave13-colony-lite', run: colonyRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-13 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
