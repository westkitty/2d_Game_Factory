import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 30 play journeys against factory-generated games.
 * Wall / territory / pinball / camera / codex / targeting leftovers.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ParkourSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface WallSnap {
  readonly sliding: boolean;
  readonly wallId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PlatformShell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly parkour?: ParkourSnap;
  readonly wall?: WallSnap;
}

interface CommandSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: boolean;
  readonly unitX: number;
  readonly unitY: number;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly command?: CommandSnap;
  readonly look?: LookSnap;
  readonly toy?: ToySnap;
  readonly narrative?: NarrativeSnap;
}

interface LookSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly inspected: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PointerShell {
  readonly look?: LookSnap;
}

interface PhysicsSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly ballX: number;
  readonly ballY: number;
  readonly score: number;
  readonly flips: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface UiShell {
  readonly physicsPlay?: PhysicsSnap;
  readonly strategy?: StrategySnap;
}

interface ToySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly shots: number;
  readonly captured: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface NarrativeSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly seen: readonly string[];
  readonly choices: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: string;
}

interface StrategySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly team: string | null;
  readonly turnNumber: number;
  readonly selected: string | null;
  readonly cursorCol: number;
  readonly unitCol: number;
  readonly unitRow: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TargetingSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly enemiesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface GridShell {
  readonly col: number;
  readonly row: number;
  readonly strategy?: StrategySnap;
  readonly targeting?: TargetingSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function holdUntil<T>(
  harness: Harness,
  codes: readonly string[],
  read: () => Promise<T>,
  predicate: (state: T) => boolean,
  maxSteps = 140,
  framesPerStep = 4,
): Promise<T> {
  for (const code of codes) await harness.keyDown(code);
  try {
    let state = await read();
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await read();
    }
    return state;
  } finally {
    for (const code of [...codes].reverse()) await harness.keyUp(code);
    await harness.stepFrames(2);
  }
}

async function precisionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  await harness.keyDown('ArrowRight');
  let state = initial;
  let jumped = false;
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    if (!jumped && state.x >= 210 && state.x <= 270 && state.onGround) {
      await harness.keyTap('Space');
      jumped = true;
    }
    await harness.stepFrames(4);
    state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  const passed = Boolean(
    initial.parkour?.mode === 'precision' &&
    initial.parkour.outcome === 'playing' &&
    initial.x < 200 &&
    Boolean(initial.wall) &&
    state.parkour?.outcome === 'complete' &&
    state.parkour.lastResult === 'finished' &&
    state.x >= 820
  );
  return { passed, details: { initial: { x: initial.x, parkour: initial.parkour, wall: initial.wall }, done: { x: state.x, parkour: state.parkour, wall: state.wall } } };
}

async function climbRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  await harness.keyDown('ArrowRight');
  let state = initial;
  const jumpedAt = new Set<number>();
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    const band = state.x < 220 ? 1 : state.x < 360 ? 2 : 3;
    if (state.onGround && !jumpedAt.has(band) && band < 3) {
      await harness.keyTap('Space');
      jumpedAt.add(band);
    }
    await harness.stepFrames(4);
    state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  const passed = Boolean(
    initial.parkour?.mode === 'climb' &&
    initial.parkour.outcome === 'playing' &&
    initial.y > 400 &&
    Boolean(initial.wall) &&
    state.parkour?.outcome === 'complete' &&
    state.parkour.lastResult === 'summit' &&
    state.y <= 410 &&
    state.x >= 400
  );
  return {
    passed,
    details: { initial: { x: initial.x, y: initial.y, parkour: initial.parkour, wall: initial.wall }, done: { x: state.x, y: state.y, parkour: state.parkour, wall: state.wall } },
  };
}

async function rtsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const read = () => readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const initial = await read();
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const selected = await read();
  const done = await holdUntil(harness, ['ArrowRight'], read, (s) => s.command?.outcome === 'complete');
  const passed = Boolean(
    initial.command?.mode === 'rts' &&
    initial.command.selected === false &&
    initial.command.outcome === 'playing' &&
    selected.command?.selected === true &&
    selected.command.lastResult === 'selected' &&
    done.command?.outcome === 'complete' &&
    done.command.lastResult === 'seized' &&
    done.command.unitX >= 780
  );
  return { passed, details: { initial: initial.command, selected: selected.command, done: done.command } };
}

async function zoneRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const read = () => readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const initial = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 270);
  await harness.stepFrames(30);
  const ownedA = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 690);
  await harness.stepFrames(30);
  const done = await read();
  const passed = Boolean(
    initial.command?.mode === 'zone' &&
    initial.command.owned === 0 &&
    initial.command.outcome === 'playing' &&
    (ownedA.command?.owned ?? 0) >= 1 &&
    done.command?.outcome === 'complete' &&
    done.command.owned === 2 &&
    done.command.lastResult === 'owned'
  );
  return { passed, details: { initial: initial.command, ownedA: ownedA.command, done: done.command } };
}

async function tableRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  let live = initial;
  for (let i = 0; i < 200 && live.physicsPlay?.outcome !== 'complete'; i++) {
    const ballY = live.physicsPlay?.ballY ?? 0;
    const ballX = live.physicsPlay?.ballX ?? 480;
    if ((live.physicsPlay?.score ?? 0) < 2 && ballY > 280) {
      await harness.keyTap(ballX < 480 ? 'KeyJ' : 'KeyK');
    }
    await harness.stepFrames(3);
    live = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  }
  const done = live.physicsPlay;
  const passed = Boolean(
    initial.physicsPlay?.mode === 'table' &&
    initial.physicsPlay.outcome === 'playing' &&
    done?.mode === 'table' &&
    done.outcome === 'complete' &&
    done.score >= 2
  );
  return { passed, details: { initial: initial.physicsPlay, done } };
}

async function museumRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const read = () => readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const initial = await read();
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.look?.nearId === 'plinth' || s.x >= 240);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const one = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.look?.nearId === 'bust' || s.x >= 660);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const done = await read();
  const passed = Boolean(
    initial.look?.mode === 'museum' &&
    initial.look.inspected === 0 &&
    initial.look.outcome === 'playing' &&
    tooFar.look?.lastResult === 'too-far' &&
    (one.look?.inspected ?? 0) >= 1 &&
    done.look?.outcome === 'complete' &&
    done.look.inspected === 2 &&
    done.look.lastResult === 'read'
  );
  return { passed, details: { initial: initial.look, tooFar: tooFar.look, one: one.look, done: done.look } };
}

async function railRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');
  let live = initial;
  for (let step = 0; step < 200 && live.look?.outcome !== 'complete'; step++) {
    if (live.look?.nearId) await harness.keyTap('KeyJ');
    await harness.stepFrames(4);
    live = await readShellState<PointerShell>(harness, 'game.pointer-shell');
  }
  const passed = Boolean(
    initial.look?.mode === 'rail' &&
    initial.look.foesAlive === 2 &&
    initial.look.outcome === 'playing' &&
    live.look?.outcome === 'complete' &&
    live.look.foesAlive === 0 &&
    live.look.lastResult === 'cleared'
  );
  return { passed, details: { initial: initial.look, done: live.look } };
}

async function photoRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const read = () => readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const initial = await read();
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await read();
  const atBird = await holdUntil(harness, ['ArrowRight'], read, (s) => s.toy?.nearId === 'bird');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const bird = await read();
  const atTree = await holdUntil(harness, ['ArrowRight'], read, (s) => s.toy?.nearId === 'tree');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await read();
  const passed = Boolean(
    initial.toy?.mode === 'photo' &&
    initial.toy.shots === 0 &&
    initial.x === 120 &&
    tooFar.toy?.lastResult === 'too-far' &&
    atBird.toy?.nearId === 'bird' &&
    bird.toy?.lastResult === 'shot-bird' &&
    bird.toy.captured.includes('bird') &&
    atTree.toy?.nearId === 'tree' &&
    done.toy?.lastResult === 'shot-tree' &&
    done.toy.captured.includes('tree') &&
    done.toy.shots === 2 &&
    done.toy.outcome === 'complete'
  );
  return { passed, details: { initial: { x: initial.x, toy: initial.toy }, tooFar: tooFar.toy, bird: bird.toy, done: done.toy } };
}

async function caseRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const read = () => readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const initial = await read();
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'print');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const print = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'photo');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const photo = await read();
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'desk');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await read();
  const passed = Boolean(
    initial.narrative?.mode === 'case' &&
    initial.narrative.seen.length === 0 &&
    tooFar.narrative?.lastResult === 'too-far' &&
    print.narrative?.lastResult === 'inspected' &&
    print.narrative.seen.includes('print') &&
    photo.narrative?.seen.includes('photo') &&
    done.narrative?.lastResult === 'deduced' &&
    done.narrative.ending === 'closed' &&
    done.narrative.outcome === 'complete'
  );
  return { passed, details: { initial: initial.narrative, print: print.narrative, photo: photo.narrative, done: done.narrative } };
}

async function towerRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<GridShell>(harness, 'game.grid-shell');
  let live = initial;
  for (let step = 0; step < 120 && live.targeting?.outcome === 'playing'; step++) {
    await harness.stepFrames(4);
    live = await readShellState<GridShell>(harness, 'game.grid-shell');
  }
  const passed = Boolean(
    initial.targeting?.mode === 'tower' &&
      initial.targeting.outcome === 'playing' &&
      (initial.targeting.enemiesAlive ?? 0) >= 1 &&
      live.targeting?.outcome === 'complete' &&
      live.targeting.enemiesAlive === 0,
  );
  return { passed, details: { initial: initial.targeting, done: live.targeting } };
}

async function battlerRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  let live = initial;
  for (let step = 0; step < 120 && live.strategy?.outcome === 'playing'; step++) {
    await harness.stepFrames(4);
    live = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  }
  const passed = Boolean(
    initial.strategy?.mode === 'battler' &&
    initial.strategy.outcome === 'playing' &&
    live.strategy?.outcome === 'complete' &&
    live.strategy.lastResult === 'won'
  );
  return { passed, details: { initial: initial.strategy, done: live.strategy } };
}

async function tacticsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const snap = () => readShellState<GridShell>(harness, 'game.grid-shell');
  const initial = await snap();
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const aimed = await snap();
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const empty = await snap();
  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(4);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const selected = await snap();
  for (let i = 0; i < 4; i++) {
    await harness.keyTap('ArrowRight');
    await harness.stepFrames(4);
  }
  const done = await snap();
  const passed = Boolean(
    initial.strategy?.mode === 'tactics' &&
    initial.strategy.selected === null &&
    initial.strategy.outcome === 'playing' &&
    aimed.strategy?.lastResult === 'aim' &&
    empty.strategy?.lastResult === 'empty' &&
    selected.strategy?.lastResult === 'selected' &&
    selected.strategy.selected === 'scout' &&
    done.strategy?.lastResult === 'seized' &&
    done.strategy.unitCol === 12 &&
    done.strategy.outcome === 'complete'
  );
  return { passed, details: { initial: initial.strategy, aimed: aimed.strategy, empty: empty.strategy, selected: selected.strategy, done: done.strategy } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-30 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave30-precision-platformer', run: precisionRun },
    { id: 'wave30-climbing-game', run: climbRun },
    { id: 'wave30-simple-rts', run: rtsRun },
    { id: 'wave30-territory-control', run: zoneRun },
    { id: 'wave30-pinball-lite', run: tableRun },
    { id: 'wave30-museum-exhibit', run: museumRun },
    { id: 'wave30-rail-shooter', run: railRun },
    { id: 'wave30-photography-game', run: photoRun },
    { id: 'wave30-investigation-game', run: caseRun },
    { id: 'wave30-tower-defense', run: towerRun },
    { id: 'wave30-auto-battler', run: battlerRun },
    { id: 'wave30-turn-based-tactics', run: tacticsRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-30 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
