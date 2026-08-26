/**
 * The workbench QA harness.
 *
 * Reuses `@sw2d/qa`'s system-Chrome launcher rather than adding a second
 * browser stack, and adds what driving an *editor* needs that driving a game
 * does not: a real workbench host, DOM interaction helpers, and frame-aware
 * access to the game running inside the preview iframe.
 *
 * Journeys drive normal user-visible controls. The one unavoidable exception
 * is the file picker: a native file dialog cannot be automated, so tests call
 * `setInputFiles` on the very `<input type="file">` the visible "Choose
 * files…" button clicks. That is the standard way to test an upload and it is
 * still the real import path - no test-only flag, no hidden endpoint.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Frame, Page } from 'playwright-core';
import { launchHarness, type Harness } from '@sw2d/qa';
import { startHost, type HostHandle } from '../server/host.ts';

export const FIXTURES = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../fixtures');

export function fixture(...segments: readonly string[]): string {
  return path.join(FIXTURES, ...segments);
}

export interface WorkbenchSession {
  readonly host: HostHandle;
  readonly harness: Harness;
  readonly page: Page;
  /** Navigate to the workbench and wait for the home route to render. */
  open(): Promise<void>;
  click(selector: string): Promise<void>;
  /** Click the first control whose visible text matches exactly - the right choice for buttons and tabs. */
  clickText(text: string, within?: string): Promise<void>;
  /** Click the first control whose visible text contains `text` - for cards and rows, whose text includes badges and metadata. */
  clickContaining(text: string, within?: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  setFiles(selector: string, files: readonly string[]): Promise<void>;
  waitFor(selector: string, timeoutMs?: number): Promise<void>;
  waitForText(text: string, timeoutMs?: number): Promise<void>;
  /** Wait until no job is running - the editor's own idle signal. */
  waitForIdle(timeoutMs?: number): Promise<void>;
  /** Go home and open a project by its game id, through its card on the home route. */
  openProject(gameId: string): Promise<void>;
  /** The most recent job of a kind, read from the same endpoint the Activity panel reads. */
  lastJob(kind: string): Promise<{ status: string; error?: string; result?: unknown } | null>;
  /** Wait for a job of `kind` to exist and reach a terminal state, then return it. */
  waitForJob(kind: string, timeoutMs?: number): Promise<{ status: string; error?: string; result?: unknown }>;
  text(selector: string): Promise<string>;
  count(selector: string): Promise<number>;
  visibleText(): Promise<string>;
  /** The frame running the generated game inside the preview pane. */
  gameFrame(timeoutMs?: number): Promise<Frame>;
  consoleErrors(): readonly string[];
  close(): Promise<void>;
}

export async function startWorkbenchSession(): Promise<WorkbenchSession> {
  const host = await startHost({ production: true });
  const harness = await launchHarness();
  const page = harness.page;

  async function open(): Promise<void> {
    await page.goto(`${host.url}/`, { waitUntil: 'load' });
    await page.waitForSelector('.home__title, .topbar', { timeout: 20_000 });
  }

  async function click(selector: string): Promise<void> {
    await page.click(selector, { timeout: 15_000 });
  }

  const CLICKABLE = 'button, .card, .action, .tab, .lib-item, .scene-obj-row, .seed';

  async function clickMatching(text: string, within: string, exact: boolean): Promise<void> {
    const handle = await page.waitForFunction(
      ([label, scope, selector, isExact]) => {
        const root = document.querySelector(scope as string);
        if (!root) return null;
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector as string));
        const match = nodes.find((node) => {
          const content = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (isExact) return content === label;
          // Case-insensitive for the contains form: card titles are
          // title-cased display names, and a journey should name the thing,
          // not its capitalisation.
          return content.toLowerCase().includes(String(label).toLowerCase());
        });
        // A disabled control is not a click target; returning null keeps the
        // poll going until it becomes enabled rather than clicking into a void.
        if (!match || (match as HTMLButtonElement).disabled) return null;
        return match;
      },
      [text, within, CLICKABLE, exact] as const,
      { timeout: 20_000 },
    );
    // The editor repaints on every state change, so a handle found a moment
    // ago may already be detached. Re-find and retry rather than failing on a
    // race that a person would never notice.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await handle.asElement()?.click({ timeout: 5_000 });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/not attached|detached|stable/i.test(message) || attempt === 3) throw error;
        await page.waitForTimeout(300);
        await clickMatching(text, within, exact);
        return;
      }
    }
  }

  async function clickText(text: string, within = 'body'): Promise<void> {
    await clickMatching(text, within, true);
  }

  async function clickContaining(text: string, within = 'body'): Promise<void> {
    await clickMatching(text, within, false);
  }

  async function fill(selector: string, value: string): Promise<void> {
    await page.fill(selector, value, { timeout: 15_000 });
  }

  async function setFiles(selector: string, files: readonly string[]): Promise<void> {
    await page.setInputFiles(selector, [...files], { timeout: 15_000 });
  }

  async function waitFor(selector: string, timeoutMs = 20_000): Promise<void> {
    await page.waitForSelector(selector, { timeout: timeoutMs });
  }

  async function waitForText(text: string, timeoutMs = 30_000): Promise<void> {
    await page.waitForFunction((needle) => document.body.innerText.includes(needle as string), text, { timeout: timeoutMs });
  }

  async function waitForIdle(timeoutMs = 240_000): Promise<void> {
    // Reads the same `/api/jobs` the status bar reads, so "idle" here means
    // exactly what it means to the user.
    await page.waitForFunction(
      async () => {
        const token = document.querySelector<HTMLMetaElement>('meta[name="sw2d-session"]')?.content ?? '';
        const response = await fetch('/api/jobs', { headers: { 'x-sw2d-session': token } });
        const payload = (await response.json()) as { jobs: { status: string }[] };
        return payload.jobs.every((job) => job.status !== 'running' && job.status !== 'queued');
      },
      undefined,
      { timeout: timeoutMs, polling: 800 },
    );
  }

  async function text(selector: string): Promise<string> {
    return (await page.textContent(selector, { timeout: 15_000 })) ?? '';
  }

  async function count(selector: string): Promise<number> {
    return page.evaluate((sel) => document.querySelectorAll(sel as string).length, selector);
  }

  async function visibleText(): Promise<string> {
    return page.evaluate(() => document.body.innerText);
  }

  async function gameFrame(timeoutMs = 60_000): Promise<Frame> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        const ready = await frame.evaluate(() => Boolean((window as unknown as { __SW2D__?: unknown }).__SW2D__)).catch(() => false);
        if (ready) return frame;
      }
      if (Date.now() > deadline) throw new Error('The preview frame never reported a running SW2D runtime.');
      await page.waitForTimeout(500);
    }
  }

  async function openProject(gameId: string): Promise<void> {
    await open();
    await page.waitForTimeout(500);
    const handle = await page.waitForFunction(
      (id) => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'));
        // A workbench-created project shows a title-cased display name; a
        // project generated by the CLI and not yet adopted shows its raw
        // hyphenated id. Flatten both to the same shape before comparing.
        const flatten = (value: string): string => value.toLowerCase().replace(/[-\s]+/g, ' ').trim();
        const wanted = flatten(String(id));
        return cards.find((card) => flatten(card.textContent ?? '').includes(wanted)) ?? null;
      },
      gameId,
      { timeout: 20_000 },
    );
    await handle.asElement()?.click();
    await page.waitForSelector('.topbar', { timeout: 40_000 });
    await page.waitForTimeout(1000);
  }

  async function lastJob(kind: string): Promise<{ status: string; error?: string; result?: unknown } | null> {
    return page.evaluate(async (wanted) => {
      const token = document.querySelector<HTMLMetaElement>('meta[name="sw2d-session"]')?.content ?? '';
      const response = await fetch('/api/jobs', { headers: { 'x-sw2d-session': token } });
      const payload = (await response.json()) as { jobs: { kind: string; status: string; error?: string; result?: unknown }[] };
      return payload.jobs.find((job) => job.kind === wanted) ?? null;
    }, kind);
  }

  /**
   * Waits for a *named* job rather than for global idleness.
   *
   * `waitForIdle` can return in the gap between one job finishing and the next
   * being created, which makes an assertion race the work it is meant to be
   * waiting for. This waits for the job that was actually asked for.
   */
  async function waitForJob(kind: string, timeoutMs = 420_000): Promise<{ status: string; error?: string; result?: unknown }> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await lastJob(kind);
      if (job && job.status !== 'running' && job.status !== 'queued') return job;
      if (Date.now() > deadline) throw new Error(`No "${kind}" job reached a terminal state within ${timeoutMs}ms (last: ${job?.status ?? 'none'}).`);
      await page.waitForTimeout(700);
    }
  }

  return {
    host,
    harness,
    page,
    open,
    openProject,
    lastJob,
    waitForJob,
    click,
    clickText,
    clickContaining,
    fill,
    setFiles,
    waitFor,
    waitForText,
    waitForIdle,
    text,
    count,
    visibleText,
    gameFrame,
    consoleErrors: () => harness.consoleErrors(),
    close: async () => {
      await harness.close();
      await host.close();
    },
  };
}

/**
 * Reads the running game's debug snapshot from inside the preview frame.
 *
 * This is the oracle W16 binds against: `playerTextureKey` and
 * `playerTextureWidth` come from the sprite the game is actually drawing, not
 * from workbench metadata, so a passing assertion means the imported pixels
 * reached the renderer.
 */
export async function gameSnapshot(frame: Frame): Promise<Record<string, unknown>> {
  return frame.evaluate(() => (window as unknown as { __SW2D__: { snapshot(): Record<string, unknown> } }).__SW2D__.snapshot());
}

export async function stepGameFrames(frame: Frame, count: number): Promise<void> {
  await frame.evaluate((frames) => {
    const w = window as unknown as { __SW2D__: { phaser: { loop: { step(t: number): void; stop(): void } } }; __SW2D_QA_CLOCK__?: number };
    if (typeof w.__SW2D_QA_CLOCK__ !== 'number') {
      w.__SW2D__.phaser.loop.stop();
      w.__SW2D_QA_CLOCK__ = performance.now();
    }
    for (let i = 0; i < (frames as number); i++) {
      w.__SW2D_QA_CLOCK__ += 16.67;
      w.__SW2D__.phaser.loop.step(w.__SW2D_QA_CLOCK__);
    }
  }, count);
}

export async function tapGameKey(frame: Frame, code: string): Promise<void> {
  await frame.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keydown', { code: key as string, bubbles: true })), code);
  await stepGameFrames(frame, 2);
  await frame.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keyup', { code: key as string, bubbles: true })), code);
  await stepGameFrames(frame, 2);
}

/**
 * Presses Start until the runtime reports the play scene.
 *
 * The runtime boots to a title screen and the game-specific pack only installs
 * once a run starts. A single Space press can land before the title scene has
 * finished wiring its input, so this retries rather than reading a snapshot
 * that happens to be one frame too early.
 */
export async function startGame(frame: Frame, attempts = 8): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await stepGameFrames(frame, 6);
    const snapshot = await gameSnapshot(frame);
    if (snapshot['scene'] === 'sw2d.play') return snapshot;
    await tapGameKey(frame, 'Space');
    await stepGameFrames(frame, 12);
  }
  return gameSnapshot(frame);
}

export class JourneyFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JourneyFailure';
  }
}

export function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new JourneyFailure(message);
}

export function expectEqual<T>(actual: T, expected: T, what: string): void {
  if (actual !== expected) throw new JourneyFailure(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
