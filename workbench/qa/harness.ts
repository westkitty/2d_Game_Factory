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
          return isExact ? content === label : content.includes(label as string);
        });
        // A disabled control is not a click target; returning null keeps the
        // poll going until it becomes enabled rather than clicking into a void.
        if (!match || (match as HTMLButtonElement).disabled) return null;
        return match;
      },
      [text, within, CLICKABLE, exact] as const,
      { timeout: 20_000 },
    );
    await handle.asElement()?.click();
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

  return {
    host,
    harness,
    page,
    open,
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
