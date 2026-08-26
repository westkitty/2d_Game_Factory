import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runNew } from '../src/commands/new.ts';
import { run as runAddTheme } from '../src/commands/addTheme.ts';
import { GAMES_ROOT } from '../src/paths.ts';

const GAME_ID = 'cli-test-add-theme-game';
const TARGET = `${GAMES_ROOT}/${GAME_ID}`;

describe('add-theme command', () => {
  beforeEach(async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runNew([GAME_ID, '--preset', 'traditional-platformer']);
    logSpy.mockRestore();
  });

  afterEach(() => {
    rmSync(TARGET, { recursive: true, force: true });
  });

  it('prints usage and fails when args are missing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddTheme([GAME_ID])).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('Usage: npm run sw2d -- add-theme');
    errSpy.mockRestore();
  });

  it('rejects an invalid theme id', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddTheme([GAME_ID, 'Not_Valid'])).toBe(1);
    errSpy.mockRestore();
  });

  it('fails for a game that does not exist', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddTheme(['no-such-game', 'night'])).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('does not exist');
    errSpy.mockRestore();
  });

  it('writes a real, self-validated theme manifest', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await runAddTheme([GAME_ID, 'night']);
    expect(code).toBe(0);
    expect(existsSync(`${TARGET}/content/themes/night/theme.json`)).toBe(true);
    logSpy.mockRestore();
  });

  it('refuses to overwrite an existing theme', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddTheme([GAME_ID, 'night'])).toBe(0);
    const secondCode = await runAddTheme([GAME_ID, 'night']);
    expect(secondCode).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toMatch(/already exists/i);
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
