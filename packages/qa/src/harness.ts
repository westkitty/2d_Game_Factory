import { chromium, type Browser, type ConsoleMessage, type Page, type Request } from 'playwright-core';
import { findSystemChrome } from './browserPath.ts';

export class NoBrowserAvailableError extends Error {
  constructor() {
    super(
      'No system Chrome was found (checked the platform default install path and PLAYWRIGHT_CHROME_PATH). ' +
        'Browser smoke is unavailable - install Chrome, or set PLAYWRIGHT_CHROME_PATH.',
    );
    this.name = 'NoBrowserAvailableError';
  }
}

export interface Harness {
  readonly page: Page;
  /** Navigate and wait until the runtime's debug global (window.__SW2D__) exists. */
  gotoAndWaitForRuntime(url: string, timeoutMs?: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  /**
   * Advance the Phaser game loop exactly `count` frames at a fixed 16.67 ms
   * step.
   *
   * This is the *only* thing that advances the loop: `gotoAndWaitForRuntime`
   * stops Phaser's own requestAnimationFrame driver first (see
   * `#stopRequestAnimationFrameLoop`). Without that, the game kept running in
   * real wall-clock time between every CDP round trip and manual steps merely
   * added to it - so "deterministic frame stepping" was not true, and specs
   * with tight margins (top-down-racer's equal-and-opposite steering taps)
   * failed intermittently. Phase 9 / Gate B found and fixed that.
   */
  stepFrames(count: number): Promise<void>;
  /** Dispatch a real keydown+keyup for `code`, stepping a couple of frames between each so the semantic input layer's edge detection sees it. */
  keyTap(code: string): Promise<void>;
  keyDown(code: string): Promise<void>;
  keyUp(code: string): Promise<void>;
  consoleErrors(): readonly string[];
  /** Every request whose origin differs from the page's own - the offline/same-origin oracle. */
  externalRequests(): readonly string[];
  close(): Promise<void>;
}

/** Launches the system-installed Chrome via playwright-core - never a bundled/downloaded browser (packages/qa/src/browserPath.ts). Throws NoBrowserAvailableError if none is found. */
export async function launchHarness(): Promise<Harness> {
  const executablePath = findSystemChrome();
  if (!executablePath) throw new NoBrowserAvailableError();

  const browser: Browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  const consoleErrorMessages: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrorMessages.push(message.text());
  });
  page.on('pageerror', (error: Error) => {
    consoleErrorMessages.push(String(error));
  });

  const requestUrls: string[] = [];
  page.on('request', (request: Request) => {
    requestUrls.push(request.url());
  });

  let pageOrigin = '';

  async function gotoAndWaitForRuntime(url: string, timeoutMs = 10_000): Promise<void> {
    pageOrigin = new URL(url).origin;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean((window as unknown as { __SW2D__?: unknown }).__SW2D__), undefined, {
      timeout: timeoutMs,
    });
    await stopRequestAnimationFrameLoop();
  }

  /**
   * Hand the frame clock to the harness.
   *
   * Phaser's `TimeStep` drives itself from `requestAnimationFrame`. Calling
   * `loop.step(t)` by hand does not replace that driver, it races it: between
   * two `page.evaluate` calls the browser keeps painting, so the game advances
   * by however many real frames the round trip happened to take. Measured on
   * this harness before the fix: ~60 frames per second of drift with zero
   * `stepFrames` calls. `loop.stop()` tears down the rAF callback (and the
   * timeout fallback) while leaving `step()` callable, which is exactly the
   * split this harness wants - after this, frame count is a pure function of
   * how many frames a spec asked for.
   */
  async function stopRequestAnimationFrameLoop(): Promise<void> {
    await page.evaluate(() => {
      const loop = (window as unknown as { __SW2D__: { phaser: { loop: { stop(): void } } } }).__SW2D__.phaser.loop;
      loop.stop();
    });
  }

  function evaluate<T>(fn: () => T): Promise<T> {
    return page.evaluate(fn);
  }

  async function stepFrames(count: number): Promise<void> {
    await page.evaluate((frames) => {
      const runtime = (window as unknown as { __SW2D__: { phaser: { loop: { step(t: number): void } } } }).__SW2D__;
      let t = performance.now();
      for (let i = 0; i < frames; i++) {
        t += 16.67;
        runtime.phaser.loop.step(t);
      }
    }, count);
  }

  async function keyDown(code: string): Promise<void> {
    await page.evaluate((keyCode) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode, bubbles: true }));
    }, code);
  }

  async function keyUp(code: string): Promise<void> {
    await page.evaluate((keyCode) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode, bubbles: true }));
    }, code);
  }

  async function keyTap(code: string): Promise<void> {
    await keyDown(code);
    await stepFrames(2);
    await keyUp(code);
    await stepFrames(2);
  }

  function consoleErrors(): readonly string[] {
    return consoleErrorMessages;
  }

  function externalRequests(): readonly string[] {
    return requestUrls.filter((url) => new URL(url).origin !== pageOrigin);
  }

  async function close(): Promise<void> {
    await browser.close();
  }

  return { page, gotoAndWaitForRuntime, evaluate, stepFrames, keyDown, keyUp, keyTap, consoleErrors, externalRequests, close };
}
