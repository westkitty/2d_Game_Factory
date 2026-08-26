import { existsSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from '../src/commands/new.ts';
import { GAMES_ROOT } from '../src/paths.ts';

const GAME_ID = 'cli-test-new-game';
const TARGET = `${GAMES_ROOT}/${GAME_ID}`;

describe('new command', () => {
  afterEach(() => {
    rmSync(TARGET, { recursive: true, force: true });
  });

  it('prints usage and fails when the game id is missing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run(['--preset', 'sokoban']);
    expect(code).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('Usage: npm run sw2d -- new');
    errSpy.mockRestore();
  });

  it('prints usage and fails when --preset is missing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run([GAME_ID]);
    expect(code).toBe(1);
    errSpy.mockRestore();
  });

  it('rejects an invalid slug', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run(['Not_A_Slug', '--preset', 'sokoban']);
    expect(code).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toMatch(/slug/i);
    errSpy.mockRestore();
  });

  it('rejects an unknown preset id', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run([GAME_ID, '--preset', 'not-a-real-preset']);
    expect(code).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('list-presets');
    errSpy.mockRestore();
  });

  it('generates a real game from a valid preset', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await run([GAME_ID, '--preset', 'sokoban']);
    expect(code).toBe(0);
    expect(existsSync(TARGET)).toBe(true);
    expect(existsSync(`${TARGET}/content/game.json`)).toBe(true);
    expect(existsSync(`${TARGET}/package.json`)).toBe(true);
    logSpy.mockRestore();
  });

  it('refuses to overwrite an existing game directory', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run([GAME_ID, '--preset', 'sokoban'])).toBe(0);
    const secondCode = await run([GAME_ID, '--preset', 'sokoban']);
    expect(secondCode).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toMatch(/already exists/i);
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
