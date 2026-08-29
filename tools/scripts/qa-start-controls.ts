#!/usr/bin/env node
/**
 * Real-browser proof that a *generated* game gives the player an obvious way
 * to start it - both keyboard and a visible pointer control that belongs to
 * the game itself (not the Workbench).
 *
 * A normal game is created through the canonical factory, production-built,
 * and driven in system Chrome:
 *   - the title text names physical keys, never the word "CONFIRM";
 *   - the visible #start-overlay button is shown on the title (not gated on a
 *     coarse pointer) and hidden once a run begins;
 *   - Enter starts the run;
 *   - Space starts the run;
 *   - clicking the visible Start control starts the run;
 *   - the touch-control cluster (with its own CONFIRM button) is preserved;
 *   - pause / resume still works and does not immediately re-pause (ADR-0003);
 *   - no console errors, no external requests, lockfile unchanged.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGame, ensureWorkspaceInstalled, REPO_ROOT } from '@sw2d/cli/factory';
import { launchHarness, serveStatic } from '@sw2d/qa';
import { gameRoot, resolveContained } from '../../workbench/server/paths.ts';

const GAME_ID = 'qa-start-controls';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function fail(message: string): never {
  throw new Error(message);
}

type Harness = Awaited<ReturnType<typeof launchHarness>>;

async function sceneOf(harness: Harness): Promise<string> {
  return harness.evaluate(() => {
    const runtime = (window as unknown as { __SW2D__: { snapshot(): { scene?: string } } }).__SW2D__;
    return runtime.snapshot().scene ?? '';
  });
}

async function pausedOf(harness: Harness): Promise<boolean> {
  return harness.evaluate(() => {
    const runtime = (window as unknown as { __SW2D__: { snapshot(): { paused?: boolean } } }).__SW2D__;
    return Boolean(runtime.snapshot().paused);
  });
}

/** Text of every Phaser Text object currently in the title scene. */
async function titleTexts(harness: Harness): Promise<string[]> {
  return harness.evaluate(() => {
    const runtime = (window as unknown as {
      __SW2D__: { phaser: { scene: { getScene(key: string): { children: { list: Array<{ text?: string }> } } | null } } };
    }).__SW2D__;
    const scene = runtime.phaser.scene.getScene('sw2d.title');
    if (!scene) return [];
    return scene.children.list.map((child) => child.text ?? '').filter((t) => t.length > 0);
  });
}

async function overlayHidden(harness: Harness): Promise<boolean> {
  return harness.evaluate(() => {
    const el = document.querySelector<HTMLElement>('#start-overlay');
    if (!el) return true;
    // "hidden" = the attribute OR effectively not rendered.
    return Boolean(el.hidden) || getComputedStyle(el).display === 'none';
  });
}

async function domShape(harness: Harness): Promise<{ overlay: boolean; touchConfirm: boolean }> {
  return harness.evaluate(() => ({
    overlay: Boolean(document.querySelector('#game-root #start-overlay[data-sw2d-action="CONFIRM"]')),
    touchConfirm: Boolean(document.querySelector('#touch-controls [data-sw2d-action="CONFIRM"]')),
  }));
}

async function freshTitle(harness: Harness, url: string): Promise<void> {
  await harness.gotoAndWaitForRuntime(url, 20_000);
  for (let attempt = 0; attempt < 10; attempt++) {
    if ((await sceneOf(harness)) === 'sw2d.title') return;
    await harness.stepFrames(10);
  }
  fail('generated game never reached the title scene');
}

async function reachedPlay(harness: Harness, how: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if ((await sceneOf(harness)) === 'sw2d.play') return;
    await harness.stepFrames(10);
  }
  fail(`${how} did not start the run (scene stayed ${await sceneOf(harness)})`);
}

async function main(): Promise<void> {
  const lockPath = path.join(REPO_ROOT, 'package-lock.json');
  const lockBefore = sha256(readFileSync(lockPath));
  rmSync(gameRoot(GAME_ID), { recursive: true, force: true });

  let harness: Harness | null = null;
  let server: Awaited<ReturnType<typeof serveStatic>> | null = null;

  try {
    createGame({ gameId: GAME_ID, presetId: 'traditional-platformer' });
    await ensureWorkspaceInstalled();

    const vite = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
    const built = spawnSync(vite, ['build'], { cwd: gameRoot(GAME_ID), encoding: 'utf8' });
    if (built.status !== 0) fail(`production build failed:\n${built.stderr || built.stdout}`);

    server = await serveStatic(resolveContained(gameRoot(GAME_ID), 'dist'));
    harness = await launchHarness();
    const url = `${server.baseUrl}/`;

    // --- 1. title copy + visible control, before any input ------------------
    await freshTitle(harness, url);

    const texts = await titleTexts(harness);
    if (texts.length === 0) fail('title scene rendered no text');
    if (texts.some((t) => /CONFIRM/.test(t))) fail(`title still exposes the word "CONFIRM": ${JSON.stringify(texts)}`);
    if (!texts.some((t) => /PRESS ENTER OR SPACE TO START/.test(t))) {
      fail(`title start hint is not an understandable key instruction: ${JSON.stringify(texts)}`);
    }

    const shape = await domShape(harness);
    if (!shape.overlay) fail('generated game has no visible #start-overlay CONFIRM control inside #game-root');
    if (!shape.touchConfirm) fail('generated game lost its touch-control CONFIRM button');
    if (await overlayHidden(harness)) fail('#start-overlay is hidden on the title screen (desktop user sees no Start control)');

    // --- 2. Enter starts --------------------------------------------------
    await harness.keyTap('Enter');
    await reachedPlay(harness, 'Enter');
    if (!(await overlayHidden(harness))) fail('#start-overlay stayed visible over active gameplay after Enter');

    // --- 3. Space starts (fresh title) ----------------------------------
    await freshTitle(harness, url);
    await harness.keyTap('Space');
    await reachedPlay(harness, 'Space');

    // --- 4. clicking the visible Start control starts (fresh title) -----
    await freshTitle(harness, url);
    if (await overlayHidden(harness)) fail('#start-overlay hidden before the click test');
    await harness.page.click('#start-overlay', { timeout: 5_000 });
    await harness.stepFrames(6);
    await reachedPlay(harness, 'clicking #start-overlay');
    if (!(await overlayHidden(harness))) fail('#start-overlay stayed visible over gameplay after being clicked');

    // --- 5. pause / resume in the pointer-started run (ADR-0003) --------
    await harness.keyTap('KeyP');
    if (!(await pausedOf(harness))) fail('KeyP did not pause the run');
    await harness.keyTap('KeyP');
    await harness.stepFrames(8);
    if (await pausedOf(harness)) fail('KeyP resume immediately re-paused (edge double-consumption regression)');
    if ((await sceneOf(harness)) !== 'sw2d.play') fail('resume did not return to play');

    // --- 6. hygiene ----------------------------------------------------
    if (harness.consoleErrors().length > 0) fail(`browser console error: ${harness.consoleErrors()[0]}`);
    if (harness.externalRequests().length > 0) fail(`external request: ${harness.externalRequests()[0]}`);
    const lockAfter = sha256(readFileSync(lockPath));
    if (lockAfter !== lockBefore) fail('package-lock.json changed during the start-controls proof');

    console.log(
      'PASS start controls: generated game — title hint "PRESS ENTER OR SPACE TO START" (no "CONFIRM"), ' +
        'visible #start-overlay shown on title / hidden in play, Enter starts, Space starts, click starts, ' +
        'touch CONFIRM button preserved, pause/resume clean, no console errors/external requests, lockfile unchanged.',
    );
  } finally {
    await harness?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    rmSync(gameRoot(GAME_ID), { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
