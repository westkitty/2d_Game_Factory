import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 21 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.combat presentations:
 * walk-and-strike room clear vs intercept raiders marching on a base.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface CombatSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerHealth: number;
  readonly baseHealth: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly combat?: CombatSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snap(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function holdUntil(
  harness: Harness,
  code: string,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 90,
  framesPerStep = 4,
): Promise<TopDownShell> {
  await harness.keyDown(code);
  try {
    let state = await snap(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snap(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return snap(harness);
}

async function strikeTwice(harness: Harness): Promise<TopDownShell> {
  await harness.keyTap('KeyJ');
  await harness.stepFrames(12);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(12);
  return snap(harness);
}

async function roomRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const miss = await snap(harness);

  const atGrunt = await holdUntil(harness, 'ArrowRight', (s) => s.combat?.nearId === 'grunt');
  const afterGrunt = await strikeTwice(harness);

  const atBrute = await holdUntil(harness, 'ArrowRight', (s) => s.combat?.nearId === 'brute');
  const done = await strikeTwice(harness);

  const passed =
    initial.combat?.mode === 'room' &&
    initial.combat.foesAlive === 2 &&
    initial.combat.playerHealth === 5 &&
    initial.x === 140 &&
    miss.combat?.lastResult === 'miss' &&
    atGrunt.combat?.nearId === 'grunt' &&
    afterGrunt.combat?.foesAlive === 1 &&
    afterGrunt.combat.lastResult === 'kill-grunt' &&
    afterGrunt.combat.outcome === 'playing' &&
    atBrute.combat?.nearId === 'brute' &&
    done.combat?.foesAlive === 0 &&
    done.combat.lastResult === 'cleared' &&
    done.combat.outcome === 'complete' &&
    done.combat.playerHealth === 5;
  return {
    passed,
    details: {
      initial: { x: initial.x, combat: initial.combat },
      miss: miss.combat,
      atGrunt: { x: atGrunt.x, combat: atGrunt.combat },
      afterGrunt: afterGrunt.combat,
      atBrute: { x: atBrute.x, combat: atBrute.combat },
      done: done.combat,
    },
  };
}

async function holdRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const miss = await snap(harness);

  const atFirst = await holdUntil(harness, 'ArrowLeft', (s) => s.combat?.nearId === 'raider' || s.combat?.nearId === 'raider-2');
  const firstId = atFirst.combat?.nearId;
  const afterFirst = await strikeTwice(harness);

  const atSecond = await holdUntil(
    harness,
    atFirst.y < 270 ? 'ArrowDown' : 'ArrowUp',
    (s) => Boolean(s.combat?.nearId && s.combat.nearId !== firstId),
  );
  const done = await strikeTwice(harness);

  const passed =
    initial.combat?.mode === 'hold' &&
    initial.combat.foesAlive === 2 &&
    initial.combat.baseHealth === 3 &&
    initial.x === 480 &&
    miss.combat?.lastResult === 'miss' &&
    (firstId === 'raider' || firstId === 'raider-2') &&
    afterFirst.combat?.foesAlive === 1 &&
    afterFirst.combat.outcome === 'playing' &&
    Boolean(atSecond.combat?.nearId) &&
    done.combat?.foesAlive === 0 &&
    done.combat.outcome === 'complete' &&
    done.combat.baseHealth === 3;
  return {
    passed,
    details: {
      initial: { x: initial.x, combat: initial.combat },
      miss: miss.combat,
      atFirst: { x: atFirst.x, y: atFirst.y, combat: atFirst.combat },
      afterFirst: afterFirst.combat,
      atSecond: { x: atSecond.x, y: atSecond.y, combat: atSecond.combat },
      done: done.combat,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-21 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave21-dungeon-crawler', run: roomRun },
    { id: 'wave21-base-defense', run: holdRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-21 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
