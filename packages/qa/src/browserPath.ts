import { existsSync } from 'node:fs';

/**
 * Locate a system-installed Chrome/Chromium executable.
 *
 * Deliberately does not download or bundle a browser: `playwright-core`
 * (unlike the full `playwright` package) has no postinstall browser
 * download, and this factory's resource policy prefers a system-browser
 * path where practical (MASTER_PROJECT.md section 16). `PLAYWRIGHT_CHROME_PATH`
 * overrides everything, for CI environments with a browser in a
 * non-standard location.
 */
export function findSystemChrome(): string | undefined {
  const override = process.env.PLAYWRIGHT_CHROME_PATH;
  if (override && existsSync(override)) return override;

  const candidates: readonly string[] =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

  return candidates.find((candidate) => existsSync(candidate));
}
