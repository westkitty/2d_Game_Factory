/**
 * App-mode browser wrapper.
 *
 * `npm run app` should feel like launching a dedicated local application, not
 * opening a browser tab - so instead of the OS `open`/`xdg-open` used by plain
 * `npm run dev`, this finds a Chromium-family browser and launches it with
 * `--app=<url>`, which drops the tab strip, address bar and bookmarks bar and
 * gives the workbench its own window. Brave is preferred (the user's
 * browser); Chrome/Chromium are accepted fallbacks. Nothing here downloads or
 * bundles a browser - same policy as `packages/qa/src/browserPath.ts`.
 *
 * Command construction (`buildAppModeArgs`, `findAppModeBrowser`,
 * `shouldAutoLaunch`) is pure and separate from spawning so it is fully
 * testable without ever opening a GUI.
 */

import { existsSync } from 'node:fs';
import { type ChildProcess, spawn } from 'node:child_process';

export interface AppModeBrowser {
  readonly name: string;
  readonly path: string;
}

const MAC_CANDIDATES: readonly AppModeBrowser[] = [
  { name: 'Brave', path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
  { name: 'Google Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  { name: 'Chromium', path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
];

const LINUX_CANDIDATES: readonly AppModeBrowser[] = [
  { name: 'Brave', path: '/usr/bin/brave-browser' },
  { name: 'Brave', path: '/usr/bin/brave' },
  { name: 'Google Chrome', path: '/usr/bin/google-chrome' },
  { name: 'Google Chrome', path: '/usr/bin/google-chrome-stable' },
  { name: 'Chromium', path: '/usr/bin/chromium' },
  { name: 'Chromium', path: '/usr/bin/chromium-browser' },
];

const WIN_CANDIDATES: readonly AppModeBrowser[] = [
  { name: 'Brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
  { name: 'Brave', path: 'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
  { name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'Google Chrome', path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' },
];

/** Exported for tests: the exact search order for a given platform, no filesystem access. */
export function appModeBrowserCandidates(platform: NodeJS.Platform): readonly AppModeBrowser[] {
  if (platform === 'darwin') return MAC_CANDIDATES;
  if (platform === 'win32') return WIN_CANDIDATES;
  return LINUX_CANDIDATES;
}

export interface FindBrowserOptions {
  readonly platform?: NodeJS.Platform;
  /** Overrides everything - `SW2D_APP_BROWSER_PATH` in practice, for a non-standard install. */
  readonly overridePath?: string;
  /** Injectable for tests, so "is a browser installed" never depends on the machine running the suite. */
  readonly exists?: (path: string) => boolean;
}

export function findAppModeBrowser(options: FindBrowserOptions = {}): AppModeBrowser | undefined {
  const exists = options.exists ?? existsSync;
  if (options.overridePath && exists(options.overridePath)) {
    return { name: 'Custom (SW2D_APP_BROWSER_PATH)', path: options.overridePath };
  }
  const platform = options.platform ?? process.platform;
  return appModeBrowserCandidates(platform).find((candidate) => exists(candidate.path));
}

/**
 * The exact argv Chromium needs for a dedicated app window at `url`.
 *
 * A single `--app=<url>` argv element, never a shell string, so no amount of
 * odd content in `url` (spaces, `&&`, ANSI bytes) gets reinterpreted - Node's
 * `spawn` with an args array and `shell: false` passes argv straight through
 * without a shell ever parsing it.
 */
export function buildAppModeArgs(url: string): readonly string[] {
  return [`--app=${url}`];
}

export function describeMissingBrowser(platform: NodeJS.Platform = process.platform): string {
  const names = Array.from(new Set(appModeBrowserCandidates(platform).map((candidate) => candidate.name))).join(', ');
  return (
    `No app-mode browser found (looked for: ${names}). ` +
    'Install Brave (preferred) or Google Chrome/Chromium, or set SW2D_APP_BROWSER_PATH to a ' +
    'Chromium-family executable. The workbench is still running - open the URL above in any browser tab.'
  );
}

export interface LaunchResult {
  readonly launched: boolean;
  readonly browser?: AppModeBrowser;
  readonly child?: ChildProcess;
  readonly message: string;
}

export interface LaunchOptions extends FindBrowserOptions {
  /** Injectable for tests, so a launch attempt never actually starts a browser process. */
  readonly spawnFn?: typeof spawn;
}

/**
 * Launches `url` in a dedicated app-mode window.
 *
 * Deliberately has no ordinary-tab fallback: if no Chromium-family browser is
 * found, this returns `launched: false` with an actionable message instead of
 * silently opening a normal tab and letting the caller believe the app-mode
 * wrapper succeeded.
 */
export function launchAppMode(url: string, options: LaunchOptions = {}): LaunchResult {
  const browser = findAppModeBrowser(options);
  if (!browser) {
    return { launched: false, message: describeMissingBrowser(options.platform ?? process.platform) };
  }
  const spawnFn = options.spawnFn ?? spawn;
  const child = spawnFn(browser.path, [...buildAppModeArgs(url)], { shell: false, detached: true, stdio: 'ignore' });
  child.unref();
  return { launched: true, browser, child, message: `Opened ${browser.name} in app mode at ${url}` };
}

export interface AutoLaunchDecision {
  readonly noOpen?: boolean;
  readonly isTTY?: boolean;
}

/**
 * Whether the launcher should attempt to open anything at all.
 *
 * Kept as a pure decision separate from `launchAppMode` so CI's `--no-open`
 * path is testable on its own: a run with `noOpen: true` (or no TTY, e.g. a
 * backgrounded/piped invocation) must never reach a spawn call, in app mode
 * or plain-open mode alike.
 */
export function shouldAutoLaunch(decision: AutoLaunchDecision): boolean {
  return decision.noOpen !== true && decision.isTTY === true;
}
