import { describe, expect, it, vi } from 'vitest';
import {
  appModeBrowserCandidates,
  buildAppModeArgs,
  describeMissingBrowser,
  findAppModeBrowser,
  launchAppMode,
  shouldAutoLaunch,
} from '../server/browserLauncher.ts';

/**
 * `npm run app` wraps the workbench in a dedicated Chromium-family app
 * window rather than an ordinary browser tab. These pin the launcher's
 * decisions without ever spawning a real browser: browser discovery and argv
 * construction are pure, and spawning is only exercised through an injected
 * mock.
 */
describe('findAppModeBrowser', () => {
  it('picks Brave on macOS when only Brave is installed', () => {
    const bravePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    const browser = findAppModeBrowser({ platform: 'darwin', exists: (path) => path === bravePath });
    expect(browser).toEqual({ name: 'Brave', path: bravePath });
  });

  it('keeps the space in "Brave Browser.app" as a single path, not split', () => {
    const browser = findAppModeBrowser({ platform: 'darwin', exists: () => true });
    expect(browser?.path).toContain('Brave Browser.app');
    expect(browser?.path.split(' ').length).toBeGreaterThan(1);
  });

  it('falls back to Chrome, then Chromium, on macOS when Brave is absent', () => {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = findAppModeBrowser({ platform: 'darwin', exists: (path) => path === chromePath });
    expect(browser?.name).toBe('Google Chrome');
  });

  it('returns undefined when nothing is installed', () => {
    expect(findAppModeBrowser({ platform: 'darwin', exists: () => false })).toBeUndefined();
  });

  it('honours SW2D_APP_BROWSER_PATH over every built-in candidate', () => {
    const override = '/opt/custom/chromium-family';
    const browser = findAppModeBrowser({ platform: 'darwin', overridePath: override, exists: (path) => path === override });
    expect(browser).toEqual({ name: 'Custom (SW2D_APP_BROWSER_PATH)', path: override });
  });

  it('lists at least one candidate for every supported platform', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      expect(appModeBrowserCandidates(platform).length).toBeGreaterThan(0);
    }
  });
});

describe('buildAppModeArgs', () => {
  it('passes the URL through unchanged as a single --app= argv element', () => {
    expect(buildAppModeArgs('http://127.0.0.1:53706')).toEqual(['--app=http://127.0.0.1:53706']);
  });

  it('is not disturbed by ANSI escapes or shell-special characters in the URL', () => {
    const oddUrl = 'http://127.0.0.1:53706/?x=\x1b[32m&&rm -rf /';
    const args = buildAppModeArgs(oddUrl);
    expect(args).toEqual([`--app=${oddUrl}`]);
    expect(args).toHaveLength(1);
  });
});

describe('launchAppMode', () => {
  it('spawns the found browser with shell: false and the exact app-mode argv', () => {
    const spawnFn = vi.fn(() => ({ unref: vi.fn() }) as never);
    const bravePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    const result = launchAppMode('http://127.0.0.1:4000', {
      platform: 'darwin',
      exists: (path) => path === bravePath,
      spawnFn,
    });

    expect(result.launched).toBe(true);
    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(spawnFn).toHaveBeenCalledWith(
      bravePath,
      ['--app=http://127.0.0.1:4000'],
      expect.objectContaining({ shell: false, detached: true }),
    );
  });

  it('never falls back to an ordinary tab: no browser found means no spawn call and launched: false', () => {
    const spawnFn = vi.fn(() => ({ unref: vi.fn() }) as never);
    const result = launchAppMode('http://127.0.0.1:4000', { platform: 'darwin', exists: () => false, spawnFn });

    expect(result.launched).toBe(false);
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('gives a useful, actionable failure message when no wrapper browser exists', () => {
    const message = describeMissingBrowser('darwin');
    expect(message).toContain('Brave');
    expect(message).toContain('SW2D_APP_BROWSER_PATH');
    expect(message.toLowerCase()).toContain('still running');
  });
});

describe('shouldAutoLaunch', () => {
  it('launches only with a TTY and no --no-open', () => {
    expect(shouldAutoLaunch({ noOpen: false, isTTY: true })).toBe(true);
  });

  it('never launches a GUI when --no-open is set, even with a TTY (CI must stay headless)', () => {
    expect(shouldAutoLaunch({ noOpen: true, isTTY: true })).toBe(false);
  });

  it('never launches a GUI with no TTY, even without --no-open (e.g. piped/backgrounded runs)', () => {
    expect(shouldAutoLaunch({ noOpen: false, isTTY: false })).toBe(false);
  });
});
