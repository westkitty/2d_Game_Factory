import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, pointerAt, readSnapshot, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Adversarial sweep over every committed proof game (Category-C convergence,
 * Phase 4). `npm run qa:proof` proves each preset's defining journey; this
 * script attacks the same production builds with the inputs a journey never
 * sends on purpose, and holds every game to the same oracle regardless of
 * genre:
 *
 *  - zero console errors / page errors, zero external requests;
 *  - the play scene survives and every shell debug contribution still
 *    produces (no `{ error }` entries);
 *  - restart is a real reinstall (`runIndex` advances) and the event-bus
 *    listener count does not grow across repeated restarts (leak oracle);
 *  - pause engages and releases with keys held through it.
 *
 * Probes: opposing movement axes held together with jump/fire/confirm spam;
 * PAUSE/CONFIRM spam; keys held through pause/resume; pointer move / press /
 * drag that leaves the canvas; pointer press outside the canvas; a viewport
 * resize mid-play; a 2 s single-frame clock jump (extreme but valid dt);
 * restart while fire/move keys are held and effects are live; three restarts
 * back to back. Run it after `npm run qa:proof` (it needs the built dists).
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface Extra {
  readonly [key: string]: unknown;
}

/** Total event-bus listener count from the snapshot's per-event record. */
function listenerTotal(snapshot: { readonly extra: Extra }): number {
  const listeners = (snapshot as unknown as { listeners?: Readonly<Record<string, number>> }).listeners;
  return listeners ? Object.values(listeners).reduce((sum, n) => sum + n, 0) : -1;
}

function contributionErrors(extra: Extra): string[] {
  return Object.entries(extra)
    .filter(([, value]) => value && typeof value === 'object' && 'error' in (value as Record<string, unknown>))
    .map(([key, value]) => `${key}: ${String((value as { error: unknown }).error)}`);
}

async function stepClockJump(harness: Harness, ms: number): Promise<void> {
  await harness.page.evaluate((jump) => {
    const w = window as unknown as { __SW2D__: { phaser: { loop: { step(t: number): void } } }; __SW2D_QA_CLOCK__?: number };
    if (typeof w.__SW2D_QA_CLOCK__ !== 'number') w.__SW2D_QA_CLOCK__ = performance.now();
    w.__SW2D_QA_CLOCK__ += jump;
    w.__SW2D__.phaser.loop.step(w.__SW2D_QA_CLOCK__);
  }, ms);
}

async function probe(harness: Harness): Promise<SmokeOutcome> {
  const failures: string[] = [];
  const check = (label: string, ok: boolean): void => {
    if (!ok) failures.push(label);
  };
  const snap = () => readSnapshot(harness);

  // The harness must own the clock from frame 1: Phaser's smoothed delta
  // must already be exactly one 16.67 ms frame, not an average that still
  // carries the real rAF frames from before the harness stopped the loop.
  await harness.stepFrames(1);
  const firstDelta = await harness.page.evaluate(() => (window as unknown as { __SW2D__: { phaser: { loop: { delta: number } } } }).__SW2D__.phaser.loop.delta);
  check(`first stepped delta is one fixed frame (got ${firstDelta})`, Math.abs(firstDelta - 16.67) < 0.01);

  await harness.keyTap('Space');
  await harness.stepFrames(12);
  const booted = await snap();
  check('boots into sw2d.play', booted.scene === 'sw2d.play');
  const shellKeys = Object.keys(booted.extra).filter((k) => k.startsWith('game.'));
  check('exactly one shell contribution', shellKeys.length === 1);
  check('no contribution errors at boot', contributionErrors(booted.extra).length === 0);

  // 1. Opposing axes held together + jump/fire/confirm spam.
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']) await harness.keyDown(code);
  for (let i = 0; i < 6; i++) {
    await harness.keyTap('Space');
    await harness.keyTap('KeyJ');
    await harness.keyTap('KeyK');
    await harness.keyTap('Enter');
  }
  await harness.stepFrames(20);
  const opposed = await snap();
  check('survives opposing axes + action spam', opposed.scene === 'sw2d.play' && contributionErrors(opposed.extra).length === 0);

  // 2. Pause with everything held; PAUSE/CONFIRM spam; resume with keys still held.
  await harness.keyTap('KeyP');
  await harness.stepFrames(2);
  const pausedHeld = await snap();
  check('pause engages with keys held', pausedHeld.paused);
  for (let i = 0; i < 8; i++) {
    await harness.keyTap('Escape');
    await harness.keyTap('Enter');
  }
  await harness.stepFrames(4);
  const afterSpam = await snap();
  if (afterSpam.paused) {
    await harness.keyTap('KeyP');
    await harness.stepFrames(2);
  }
  const resumed = await snap();
  check('pause/confirm spam leaves the game resumable', !resumed.paused && resumed.scene === 'sw2d.play');
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']) await harness.keyUp(code);
  await harness.stepFrames(4);

  // 3. Pointer: drag that leaves the canvas, press outside, move far outside.
  await pointerAt(harness, 'pointermove', 480, 270);
  await harness.stepFrames(1);
  await pointerAt(harness, 'pointerdown', 480, 270);
  await harness.stepFrames(1);
  for (const x of [700, 900, 1100, 1400]) {
    await pointerAt(harness, 'pointermove', x, 270);
    await harness.stepFrames(1);
  }
  await pointerAt(harness, 'pointerup', 1400, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', -80, -80);
  await pointerAt(harness, 'pointerdown', -80, -80);
  await harness.stepFrames(1);
  await pointerAt(harness, 'pointerup', -80, -80);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 480, 270);
  await harness.stepFrames(2);
  const pointered = await snap();
  check('survives off-canvas pointer traffic', pointered.scene === 'sw2d.play' && contributionErrors(pointered.extra).length === 0);

  // 4. Resize mid-play, then a 2 s clock jump in a single frame.
  await harness.page.setViewportSize({ width: 640, height: 400 });
  await harness.stepFrames(4);
  await harness.page.setViewportSize({ width: 1024, height: 768 });
  await harness.stepFrames(4);
  await stepClockJump(harness, 2000);
  await harness.stepFrames(4);
  const jumped = await snap();
  check('survives resize + 2 s dt', jumped.scene === 'sw2d.play' && contributionErrors(jumped.extra).length === 0);

  // 5. Restart while fire/move are held and effects are live; three restarts back to back.
  await harness.keyDown('ArrowRight');
  await harness.keyDown('KeyJ');
  await harness.stepFrames(10);
  const beforeRestarts = await snap();
  const runIndexBefore = beforeRestarts.runIndex;
  let listenersAfterFirst = -1;
  for (let i = 0; i < 3; i++) {
    await harness.keyTap('KeyP');
    await harness.stepFrames(3);
    await harness.keyTap('KeyK');
    await harness.stepFrames(12);
    await harness.keyTap('Space');
    await harness.stepFrames(6);
    const after = await snap();
    if (i === 0) listenersAfterFirst = listenerTotal(after);
    check(`restart ${i + 1} reinstalls`, after.runIndex === runIndexBefore + i + 1 && after.scene === 'sw2d.play' && !after.paused);
    check(`restart ${i + 1} keeps one shell contribution`, Object.keys(after.extra).filter((k) => k.startsWith('game.')).length === 1);
    check(`restart ${i + 1} contributions produce`, contributionErrors(after.extra).length === 0);
  }
  await harness.keyUp('ArrowRight');
  await harness.keyUp('KeyJ');
  await harness.stepFrames(4);
  const final = await snap();
  const listenersFinal = listenerTotal(final);
  check('listener count does not grow across restarts', listenersAfterFirst < 0 || listenersFinal <= listenersAfterFirst);

  return {
    passed: failures.length === 0,
    details: { failures, runIndex: final.runIndex, listenersAfterFirst, listenersFinal, shellKeys },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('No system Chrome found. Adversarial sweep cannot run - see `npm run sw2d -- doctor`.');
    return 1;
  }
  const filter = process.argv.slice(2);
  const proofsRoot = path.join(REPO_ROOT, 'proofs');
  const ids = readdirSync(proofsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(proofsRoot, e.name, 'dist', 'index.html')))
    .map((e) => e.name)
    .filter((id) => filter.length === 0 || filter.includes(id))
    .sort();
  if (ids.length === 0) {
    console.error('No built proofs found under proofs/*/dist - run `npm run qa:proof` first.');
    return 1;
  }
  let failed = 0;
  for (const id of ids) {
    process.stdout.write(`Attacking ${id}...\n`);
    const result = await runSmoke({ id, buildDir: path.join(proofsRoot, id, 'dist'), run: probe });
    if (!result.passed) failed += 1;
    console.log(
      `[${result.passed ? 'PASS' : 'FAIL'}] ${id}${
        result.passed ? '' : ` console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`
      }`,
    );
  }
  console.log(`\n${ids.length - failed}/${ids.length} proofs survived the adversarial sweep.`);
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
