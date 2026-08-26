import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runNew } from '../src/commands/new.ts';
import { run as runAddLevel } from '../src/commands/addLevel.ts';
import { GAMES_ROOT } from '../src/paths.ts';

const GAME_ID = 'cli-test-add-level-game';
const TARGET = `${GAMES_ROOT}/${GAME_ID}`;

describe('add-level command', () => {
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
    expect(await runAddLevel([GAME_ID])).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('Usage: npm run sw2d -- add-level');
    errSpy.mockRestore();
  });

  it('rejects an invalid level id', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddLevel([GAME_ID, 'Not_Valid'])).toBe(1);
    errSpy.mockRestore();
  });

  it('fails for a game that does not exist', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddLevel(['no-such-game', 'bonus'])).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('does not exist');
    errSpy.mockRestore();
  });

  it('writes a real, self-validated level document', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await runAddLevel([GAME_ID, 'bonus']);
    expect(code).toBe(0);
    expect(existsSync(`${TARGET}/content/levels/bonus.json`)).toBe(true);
    logSpy.mockRestore();
  });

  it('refuses to overwrite an existing level', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runAddLevel([GAME_ID, 'bonus'])).toBe(0);
    const secondCode = await runAddLevel([GAME_ID, 'bonus']);
    expect(secondCode).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toMatch(/already exists/i);
    logSpy.mockRestore();
    errSpy.mockRestore();
  });
});
