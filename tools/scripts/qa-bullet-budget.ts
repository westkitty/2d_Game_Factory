#!/usr/bin/env node
/**
 * Bullet-hell projectile budget benchmark (Final Product Completion, Wave 3
 * - matrix L12).
 *
 * Generates the canonical bullet-hell game through the factory, builds it,
 * and lets it run on the browser's own requestAnimationFrame loop while its
 * content boss keeps hundreds of bullets live. It samples real frame deltas
 * and the live projectile count, and reports the pool statistics (sprites
 * allocated at peak vs spawns served from the pool). Numbers are for this
 * machine and this browser; the pass criteria are the *supported budget*
 * documented in docs/qa/QA_MATRIX.md:
 *
 *   - peak live projectiles >= BUDGET_LIVE (the workload really is dense);
 *   - mean FPS >= MIN_MEAN_FPS while that dense;
 *   - pool reuse >= 80 % of spawns after the first second (allocation stops
 *     growing once the peak is reached).
 *
 * Optional argv: `--live <n>` / `--fps <n>` override the thresholds;
 * `--stress` doubles every emitter's count and halves its period in the
 * generated content (an informational ceiling run, not the supported budget).
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { findSystemChrome, serveStatic } from '@sw2d/qa';
import { PRESETS } from '@sw2d/presets';
import { buildGameFiles, writeGameFiles } from '../../packages/cli/src/generator/generate.ts';
import { run } from '../../packages/cli/src/exec.ts';
import { GAMES_ROOT, REPO_ROOT } from '../../packages/cli/src/paths.ts';
import { ensureWorkspaceInstalled } from '../../packages/cli/src/workspace.ts';

const BUDGET_LIVE = Number(process.argv[process.argv.indexOf('--live') + 1] || 0) || 400;
const MIN_MEAN_FPS = Number(process.argv[process.argv.indexOf('--fps') + 1] || 0) || 55;
const SAMPLE_MS = 8000;
const STRESS = process.argv.includes('--stress');

async function key(page: Page, type: 'keydown' | 'keyup', code: string): Promise<void> {
  await page.evaluate(({ t, c }) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true })), { t: type, c: code });
}

interface Sample {
  readonly frames: number;
  readonly meanFps: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly peakLive: number;
  readonly meanLive: number;
  readonly spawned: number;
  readonly poolAllocated: number;
  readonly poolReused: number;
}

async function sample(page: Page, ms: number): Promise<Sample> {
  return page.evaluate(
    (windowMs) =>
      new Promise<Sample>((resolve) => {
        const deltas: number[] = [];
        const lives: number[] = [];
        let last = performance.now();
        const start = last;
        const read = () => {
          const snap = (window as unknown as { __SW2D__: { snapshot(): { extra: Record<string, { battle?: { projectilesLive: number; projectilesSpawned: number; poolAllocated: number; poolReused: number } }> } } }).__SW2D__.snapshot();
          const shell = Object.values(snap.extra).find((v) => v && typeof v === 'object' && 'battle' in v);
          return shell?.battle ?? { projectilesLive: 0, projectilesSpawned: 0, poolAllocated: 0, poolReused: 0 };
        };
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          lives.push(read().projectilesLive);
          if (now - start < windowMs) requestAnimationFrame(tick);
          else {
            const sorted = [...deltas].sort((a, b) => a - b);
            const total = deltas.reduce((s, d) => s + d, 0);
            const b = read();
            resolve({
              frames: deltas.length,
              meanFps: Math.round((deltas.length / total) * 1000 * 10) / 10,
              p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 100) / 100,
              maxMs: Math.round(sorted[sorted.length - 1]! * 100) / 100,
              peakLive: Math.max(...lives),
              meanLive: Math.round(lives.reduce((s, l) => s + l, 0) / lives.length),
              spawned: b.projectilesSpawned,
              poolAllocated: b.poolAllocated,
              poolReused: b.poolReused,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function main(): Promise<number> {
  const executablePath = findSystemChrome();
  if (!executablePath) {
    console.error('No system Chrome found - bullet budget benchmark cannot run.');
    return 1;
  }
  await ensureWorkspaceInstalled();
  const preset = PRESETS.find((p) => p.id === 'bullet-hell')!;
  const gameId = 'budget-bullet-hell';
  const gamePath = path.join(GAMES_ROOT, gameId);
  rmSync(gamePath, { recursive: true, force: true });
  const files = new Map(buildGameFiles(gameId, preset));
  if (STRESS) {
    const doc = JSON.parse(files.get('content/encounters.json')!) as { encounters: Array<{ phases: Array<{ emitters?: Array<{ everyMs: number; pattern: { count?: number } }> }> }> };
    for (const enc of doc.encounters) for (const phase of enc.phases) for (const e of phase.emitters ?? []) {
      e.everyMs = Math.max(30, Math.round(e.everyMs / 2));
      if (typeof e.pattern.count === 'number') e.pattern.count *= 2;
    }
    files.set('content/encounters.json', JSON.stringify(doc, null, 2) + '\n');
  }
  writeGameFiles(files, gamePath);
  try {
    const built = await run(path.join(REPO_ROOT, 'node_modules', '.bin', 'vite'), ['build'], { cwd: gamePath });
    if (built.code !== 0 || !existsSync(path.join(gamePath, 'dist', 'index.html'))) {
      console.error(`build failed: ${built.stderr || built.stdout}`);
      return 1;
    }
    const server = await serveStatic(path.join(gamePath, 'dist'));
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-precise-memory-info'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
      await page.goto(`${server.baseUrl}/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean((window as unknown as { __SW2D__?: unknown }).__SW2D__));
      await page.waitForTimeout(300);
      await key(page, 'keydown', 'Space');
      await page.waitForTimeout(60);
      await key(page, 'keyup', 'Space');
      // Stand still and do not shoot: the boss's own patterns are the workload.
      await page.waitForTimeout(2500);
      const play = await sample(page, SAMPLE_MS);
      const reusePct = play.spawned > 0 ? Math.round((play.poolReused / play.spawned) * 1000) / 10 : 0;
      const denseEnough = play.peakLive >= BUDGET_LIVE;
      const fastEnough = play.meanFps >= MIN_MEAN_FPS;
      const pooled = reusePct >= 80;
      const ok = denseEnough && fastEnough && pooled;
      console.log(`Chrome ${browser.version()} · ${process.platform} ${process.arch} · ${SAMPLE_MS} ms sample after a 2.5 s warm-up${STRESS ? ' · STRESS (2x emitters)' : ''}`);
      console.log(
        `[${ok ? 'PASS' : 'FAIL'}] bullet-hell budget: peak live ${play.peakLive} (mean ${play.meanLive}) · ${play.meanFps} fps mean · p95 ${play.p95Ms} ms · max ${play.maxMs} ms · spawned ${play.spawned} · pool allocated ${play.poolAllocated}, reused ${play.poolReused} (${reusePct}%)`,
      );
      console.log(`thresholds: live >= ${BUDGET_LIVE} (${denseEnough ? 'ok' : 'FAIL'}), mean fps >= ${MIN_MEAN_FPS} (${fastEnough ? 'ok' : 'FAIL'}), pool reuse >= 80% (${pooled ? 'ok' : 'FAIL'})`);
      console.log(JSON.stringify({ chrome: browser.version(), platform: `${process.platform}-${process.arch}`, budgetLive: BUDGET_LIVE, minMeanFps: MIN_MEAN_FPS, play, reusePct, ok }));
      return ok ? 0 : 1;
    } finally {
      await browser.close();
      await server.close();
    }
  } finally {
    rmSync(gamePath, { recursive: true, force: true });
  }
}

process.exitCode = await main();
