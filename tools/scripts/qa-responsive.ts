#!/usr/bin/env node
/**
 * `npm run qa:responsive` (Phase 11 section 9) - a bounded, reproducible
 * real-browser responsive suite over all 19 committed user-facing runtime
 * surfaces (2 starter pages + 12 smoke demos + 5 deep proofs), at two
 * coarse-pointer viewport contexts: 375x812 portrait and 844x390 landscape.
 *
 * This is NOT real-device testing - it emulates viewport size, device pixel
 * ratio, `pointer: coarse`, and touch input through Chromium via
 * `playwright-core`'s device emulation. Real hardware (a physical phone or
 * tablet) is not exercised; `docs/qa/QA_MATRIX.md` and this script's own
 * summary say so explicitly.
 *
 * Every surface shares one DOM contract (packages/cli/src/templates/
 * index.html.template, mirrored byte-for-byte into every committed demo/
 * proof/starter index.html): a `#game-root` canvas mount and a
 * `#touch-controls` panel of `.touch-button` elements shown when
 * `pointer: coarse` is detected. That shared contract is what makes one
 * generic checker meaningful across all 19 surfaces instead of one
 * hand-written check per game.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findSystemChrome } from '../../packages/qa/src/browserPath.ts';
import { serveStatic } from '../../packages/qa/src/staticServer.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface Surface {
  readonly id: string;
  readonly buildCwd: string;
  readonly buildDir: string;
  readonly entryPath: string;
  /** true for the two non-canvas/DOM-heavy management/narrative surfaces - checked for DOM layout, not canvas fit. */
  readonly domHeavy?: boolean;
}

const DEMO_IDS = [
  'traditional-platformer',
  'chase-platformer',
  'metroidvania',
  'twin-stick-shooter',
  'stealth-game',
  'bullet-hell',
  'top-down-racer',
  'sokoban',
  'tower-defense',
  'turn-based-tactics',
  'idle-incremental',
  'visual-novel',
] as const;

const PROOF_IDS = ['chase-platformer', 'twin-stick-shooter', 'tower-defense', 'sokoban', 'idle-incremental'] as const;

const DOM_HEAVY = new Set(['idle-incremental', 'visual-novel']);

function surfaces(): Surface[] {
  const demo: Surface[] = DEMO_IDS.map((id) => ({
    id: `demo:${id}`,
    buildCwd: path.join(REPO_ROOT, 'demos', id),
    buildDir: path.join(REPO_ROOT, 'demos', id, 'dist'),
    entryPath: 'index.html',
    ...(DOM_HEAVY.has(id) ? { domHeavy: true } : {}),
  }));
  const starter: Surface[] = [
    { id: 'starter:foundation', buildCwd: path.join(REPO_ROOT, 'starter'), buildDir: path.join(REPO_ROOT, 'starter', 'dist'), entryPath: 'index.html' },
    { id: 'starter:tiled-proof', buildCwd: path.join(REPO_ROOT, 'starter'), buildDir: path.join(REPO_ROOT, 'starter', 'dist'), entryPath: 'tiled-proof.html' },
  ];
  const proof: Surface[] = PROOF_IDS.map((id) => ({
    id: `proof:${id}`,
    buildCwd: path.join(REPO_ROOT, 'proofs', id),
    buildDir: path.join(REPO_ROOT, 'proofs', id, 'dist'),
    entryPath: 'index.html',
    ...(DOM_HEAVY.has(id) ? { domHeavy: true } : {}),
  }));
  return [...demo, ...starter, ...proof];
}

interface Viewport {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

const VIEWPORTS: readonly Viewport[] = [
  { name: '375x812 portrait', width: 375, height: 812 },
  { name: '844x390 landscape', width: 844, height: 390 },
];

function build(surface: Surface): { ok: boolean; detail: string } {
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const result = spawnSync(viteBin, ['build'], { cwd: surface.buildCwd, encoding: 'utf8' });
  const ok = result.status === 0;
  return { ok, detail: ok ? '' : (result.stderr || result.stdout || `exit ${result.status}`) };
}

interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

interface PageMetrics {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly canvasRect: { width: number; height: number; right: number; bottom: number; left: number; top: number } | null;
  readonly touchControlsVisible: boolean;
  readonly touchButtonRects: Array<{ width: number; height: number; left: number; top: number; right: number; bottom: number }>;
  readonly touchButtonCount: number;
}

async function readMetrics(page: import('playwright-core').Page): Promise<PageMetrics> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-root canvas');
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
    const controls = document.querySelector('#touch-controls');
    const buttons = [...document.querySelectorAll<HTMLElement>('.touch-button')];
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      canvasRect: canvasRect
        ? { width: canvasRect.width, height: canvasRect.height, right: canvasRect.right, bottom: canvasRect.bottom, left: canvasRect.left, top: canvasRect.top }
        : null,
      touchControlsVisible: controls ? !(controls as HTMLElement).hidden : false,
      touchButtonRects: buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
      touchButtonCount: buttons.length,
    };
  });
}

function checkMetrics(surface: Surface, metrics: PageMetrics): CheckResult[] {
  const checks: CheckResult[] = [];
  const EPS = 2;

  checks.push({
    name: 'no horizontal page overflow',
    ok: metrics.scrollWidth <= metrics.innerWidth + EPS,
    detail: `scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth}`,
  });

  if (!surface.domHeavy) {
    checks.push({
      name: 'canvas fits viewport',
      ok:
        metrics.canvasRect !== null &&
        metrics.canvasRect.right <= metrics.innerWidth + EPS &&
        metrics.canvasRect.bottom <= metrics.innerHeight + EPS &&
        metrics.canvasRect.left >= -EPS &&
        metrics.canvasRect.top >= -EPS,
      detail: metrics.canvasRect ? JSON.stringify(metrics.canvasRect) : 'no <canvas> found under #game-root',
    });
  }

  if (metrics.touchControlsVisible) {
    const clipped = metrics.touchButtonRects.filter((r) => r.left < -EPS || r.top < -EPS || r.right > metrics.innerWidth + EPS || r.bottom > metrics.innerHeight + EPS);
    checks.push({
      name: 'touch controls visible and unclipped',
      ok: metrics.touchButtonRects.length > 0 && clipped.length === 0,
      detail: `${metrics.touchButtonRects.length} button(s), ${clipped.length} clipped`,
    });

    const undersized = metrics.touchButtonRects.filter((r) => r.width < 44 || r.height < 44);
    const belowProjectStandard = metrics.touchButtonRects.filter((r) => r.width < 56 || r.height < 56);
    checks.push({
      name: 'touch targets >= 44x44 (project standard is 56x56)',
      ok: undersized.length === 0,
      detail: undersized.length === 0 ? (belowProjectStandard.length === 0 ? 'all >= 56x56' : `${belowProjectStandard.length} button(s) below the 56x56 project standard but >= 44x44 floor`) : `${undersized.length} button(s) below the 44x44 floor`,
    });

    let overlapping = 0;
    for (let i = 0; i < metrics.touchButtonRects.length; i++) {
      for (let j = i + 1; j < metrics.touchButtonRects.length; j++) {
        const a = metrics.touchButtonRects[i]!;
        const b = metrics.touchButtonRects[j]!;
        const overlap = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (overlap) overlapping++;
      }
    }
    checks.push({ name: 'no control-panel button overlaps another', ok: overlapping === 0, detail: `${overlapping} overlapping pair(s)` });
  } else {
    checks.push({ name: 'touch controls visible and unclipped', ok: false, detail: '#touch-controls is hidden under a coarse-pointer, touch-capable context - pointer:coarse detection did not activate it' });
  }

  return checks;
}

async function verifySurface(surface: Surface, browser: import('playwright-core').Browser): Promise<{ id: string; checks: CheckResult[] }> {
  const server = await serveStatic(surface.buildDir);
  const checks: CheckResult[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: VIEWPORTS[0]!.width, height: VIEWPORTS[0]!.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const consoleErrors: string[] = [];
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${server.baseUrl}/${surface.entryPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(300); // let the runtime's coarse-pointer/touch-controls-visibility logic settle.

    const portraitMetrics = await readMetrics(page);
    checks.push(...checkMetrics(surface, portraitMetrics).map((c) => ({ ...c, name: `[${VIEWPORTS[0]!.name}] ${c.name}` })));

    // Resize in-place (no reload) to landscape - proves a viewport switch
    // does not duplicate listeners/DOM controls, not just that landscape
    // alone looks fine.
    await page.setViewportSize({ width: VIEWPORTS[1]!.width, height: VIEWPORTS[1]!.height });
    await page.waitForTimeout(300);
    const landscapeMetrics = await readMetrics(page);
    checks.push(...checkMetrics(surface, landscapeMetrics).map((c) => ({ ...c, name: `[${VIEWPORTS[1]!.name}] ${c.name}` })));

    checks.push({
      name: 'switching viewport does not duplicate touch-control DOM nodes',
      ok: landscapeMetrics.touchButtonCount === portraitMetrics.touchButtonCount,
      detail: `portrait=${portraitMetrics.touchButtonCount} landscape=${landscapeMetrics.touchButtonCount}`,
    });

    checks.push({ name: 'zero console errors across both viewports', ok: consoleErrors.length === 0, detail: consoleErrors.length === 0 ? '0 errors' : `${consoleErrors.length} error(s): ${consoleErrors[0]}` });

    await context.close();
  } finally {
    await server.close();
  }
  return { id: surface.id, checks };
}

async function main(): Promise<number> {
  const executablePath = findSystemChrome();
  if (!executablePath) {
    console.error('No system Chrome found. qa:responsive cannot run - see `npm run sw2d -- doctor`.');
    return 1;
  }

  const targets = surfaces();
  console.log(`Building ${targets.length} surface(s)...`);
  for (const surface of targets) {
    const built = build(surface);
    if (!built.ok) {
      console.error(`Build failed for ${surface.id}:\n${built.detail}`);
      return 1;
    }
  }

  const browser = await chromium.launch({ executablePath, headless: true });
  const results: Array<{ id: string; checks: CheckResult[] }> = [];
  try {
    for (const surface of targets) {
      console.log(`Checking ${surface.id}...`);
      results.push(await verifySurface(surface, browser));
    }
  } finally {
    await browser.close();
  }

  console.log('\n--- qa:responsive summary (emulated viewport/touch via Chromium - NOT real-device hardware) ---');
  let allOk = true;
  for (const result of results) {
    const failed = result.checks.filter((c) => !c.ok);
    const ok = failed.length === 0;
    allOk &&= ok;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${result.id}`);
    for (const check of failed) console.log(`    - ${check.name}: ${check.detail}`);
  }
  const passCount = results.filter((r) => r.checks.every((c) => c.ok)).length;
  console.log(`\n${passCount}/${results.length} surfaces passed (${VIEWPORTS.map((v) => v.name).join(', ')}).`);
  return allOk ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
