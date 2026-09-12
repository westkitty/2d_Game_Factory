import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { findSystemChrome, serveStatic } from '@sw2d/qa';

/**
 * Real-time desktop performance pass (Category-C convergence, Phase 7).
 *
 * `qa:proof` and `qa:adversarial` drive a deterministic frame clock, which
 * proves behaviour but says nothing about real frame pacing. This script
 * lets each representative production build run on the browser's own
 * requestAnimationFrame loop, holds a genre-typical input pattern for a
 * fixed window, and samples the frame deltas the game actually gets, then
 * restarts the run five times and reads the JS heap before/after to catch
 * runaway allocation. Numbers are for this machine and this browser -
 * they are recorded, not promised (no mobile claim is made from them).
 *
 * The only hard failures are gross pathologies: mean FPS under 30 during
 * play, or the heap growing by more than half across five restarts.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface Workload {
  readonly id: string;
  readonly label: string;
  /** Keys held during the sample window. */
  readonly hold: readonly string[];
  /** Keys tapped every ~200 ms during the window. */
  readonly tap: readonly string[];
}

const WORKLOADS: readonly Workload[] = [
  { id: 'traditional-platformer', label: 'platformer (world objectives)', hold: ['ArrowRight'], tap: ['Space'] },
  { id: 'twin-stick-shooter', label: 'top-down combat (waves + projectiles)', hold: ['ArrowRight', 'Numpad6', 'KeyJ'], tap: [] },
  { id: 'bullet-hell', label: 'bullet-heavy encounter', hold: ['KeyJ'], tap: ['ArrowLeft', 'ArrowRight'] },
  { id: 'lane-defense', label: 'strategy / navigation re-path', hold: [], tap: ['Enter', 'ArrowUp', 'ArrowDown'] },
  { id: 'grappling-platformer', label: 'Matter physics + constraint', hold: ['ArrowRight'], tap: ['KeyK', 'Space'] },
  { id: 'kart-racer', label: 'vehicle / racing', hold: ['ArrowUp', 'ArrowRight'], tap: ['Enter'] },
  { id: 'shopkeeper', label: 'UI / simulation ledger', hold: [], tap: ['Enter', 'ArrowRight', 'KeyK'] },
  { id: 'dungeon-crawler', label: 'generated room graph + combat', hold: ['ArrowRight'], tap: ['KeyJ'] },
];

const SAMPLE_MS = 6000;
const RESTARTS = 5;

interface Sample {
  readonly frames: number;
  readonly meanFps: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly longFrames: number;
}

async function sampleFrames(page: Page, ms: number): Promise<Sample> {
  return page.evaluate(
    (windowMs) =>
      new Promise<Sample>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - start < windowMs) requestAnimationFrame(tick);
          else {
            const sorted = [...deltas].sort((a, b) => a - b);
            const total = deltas.reduce((s, d) => s + d, 0);
            resolve({
              frames: deltas.length,
              meanFps: Math.round((deltas.length / total) * 1000 * 10) / 10,
              p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 100) / 100,
              maxMs: Math.round(sorted[sorted.length - 1]! * 100) / 100,
              longFrames: deltas.filter((d) => d > 50).length,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function heapMb(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
  });
}

async function key(page: Page, type: 'keydown' | 'keyup', code: string): Promise<void> {
  await page.evaluate(([t, c]) => window.dispatchEvent(new KeyboardEvent(t!, { code: c!, bubbles: true })), [type, code]);
}

async function runWorkload(page: Page, baseUrl: string, workload: Workload): Promise<Record<string, unknown>> {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as unknown as { __SW2D__?: unknown }).__SW2D__));
  await page.waitForTimeout(300);
  await key(page, 'keydown', 'Space');
  await page.waitForTimeout(60);
  await key(page, 'keyup', 'Space');
  await page.waitForTimeout(400);
  await key(page, 'keydown', 'Enter');
  await page.waitForTimeout(60);
  await key(page, 'keyup', 'Enter');

  for (const code of workload.hold) await key(page, 'keydown', code);
  const tapper = setInterval(() => {
    for (const code of workload.tap) {
      void key(page, 'keydown', code).then(() => setTimeout(() => void key(page, 'keyup', code), 40));
    }
  }, 200);
  const heapBefore = await heapMb(page);
  const play = await sampleFrames(page, SAMPLE_MS);
  clearInterval(tapper);
  for (const code of workload.hold) await key(page, 'keyup', code);

  const heapAfterPlay = await heapMb(page);
  for (let i = 0; i < RESTARTS; i++) {
    await key(page, 'keydown', 'KeyP');
    await page.waitForTimeout(50);
    await key(page, 'keyup', 'KeyP');
    await page.waitForTimeout(100);
    await key(page, 'keydown', 'KeyK');
    await page.waitForTimeout(50);
    await key(page, 'keyup', 'KeyK');
    await page.waitForTimeout(400);
    await key(page, 'keydown', 'Space');
    await page.waitForTimeout(50);
    await key(page, 'keyup', 'Space');
    await page.waitForTimeout(300);
  }
  const idle = await sampleFrames(page, 2000);
  const heapAfterRestarts = await heapMb(page);
  const snapshot = await page.evaluate(() => {
    const s = (window as unknown as { __SW2D__: { snapshot(): { runIndex: number; scene: string; listeners: Record<string, number> } } }).__SW2D__.snapshot();
    return { runIndex: s.runIndex, scene: s.scene, listeners: Object.values(s.listeners).reduce((a, b) => a + b, 0) };
  });
  const heapGrowth = heapBefore && heapAfterRestarts ? Math.round(((heapAfterRestarts - heapBefore) / heapBefore) * 1000) / 10 : null;
  const pathological = play.meanFps < 30 || (heapGrowth !== null && heapGrowth > 50);
  return {
    id: workload.id,
    label: workload.label,
    play,
    idleAfterRestarts: idle,
    heapMb: { before: heapBefore, afterPlay: heapAfterPlay, afterRestarts: heapAfterRestarts, growthPct: heapGrowth },
    ...snapshot,
    pathological,
  };
}

async function main(): Promise<number> {
  const executablePath = findSystemChrome();
  if (!executablePath) {
    console.error('No system Chrome found - performance pass cannot run.');
    return 1;
  }
  const filter = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-precise-memory-info'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const version = browser.version();
  const results: Record<string, unknown>[] = [];
  let pathological = 0;
  console.log(`Chrome ${version} · ${process.platform} ${process.arch} · viewport 1024x768 · ${SAMPLE_MS} ms play sample · ${RESTARTS} restarts`);
  for (const workload of WORKLOADS) {
    if (filter.length > 0 && !filter.includes(workload.id)) continue;
    const buildDir = path.join(REPO_ROOT, 'proofs', workload.id, 'dist');
    if (!existsSync(path.join(buildDir, 'index.html'))) {
      console.log(`[SKIP] ${workload.id} - not built (run npm run qa:proof first)`);
      continue;
    }
    const server = await serveStatic(buildDir);
    try {
      const result = await runWorkload(page, server.baseUrl, workload);
      results.push(result);
      if (result.pathological) pathological += 1;
      const p = result.play as Sample;
      const h = result.heapMb as { before: number | null; afterRestarts: number | null; growthPct: number | null };
      console.log(
        `[${result.pathological ? 'FAIL' : 'OK'}] ${workload.id.padEnd(24)} ${String(p.meanFps).padStart(5)} fps mean · p95 ${p.p95Ms} ms · max ${p.maxMs} ms · long(>50ms) ${p.longFrames}/${p.frames} · heap ${h.before}→${h.afterRestarts} MB (${h.growthPct ?? '?'}%) · runIndex ${String(result.runIndex)} · listeners ${String(result.listeners)}`,
      );
    } finally {
      await server.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify({ chrome: version, platform: `${process.platform}-${process.arch}`, results }, null, 1));
  return pathological === 0 ? 0 : 1;
}

process.exitCode = await main();
