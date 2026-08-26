import { describe, expect, it, vi } from 'vitest';

/**
 * `validate`/`build`/`pack` all run a real, multi-minute process ladder
 * (npm install, tsc, vite build, and for `validate` a real-browser smoke) -
 * exercised for real via manual CLI runs and tools/scripts/build-matrix.ts's
 * 13/13 real-build evidence (see docs/architecture/
 * PHASE8_OPUS_GATE_B_HANDOFF.md), not re-run here on every test pass.
 * This suite covers the fast, pure argument-validation path every one of
 * them takes before spawning any child process - the same guard clauses
 * new/add-level/add-theme already have dedicated tests for.
 */
describe('validate/build/pack argument validation (fast path, no child processes)', () => {
  it.each([
    ['validate', () => import('../src/commands/validate.ts')],
    ['build', () => import('../src/commands/build.ts')],
    ['pack', () => import('../src/commands/pack.ts')],
  ])('%s: prints usage and fails when the game id is missing', async (name, load) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { run } = await load();
    const code = await run([]);
    expect(code, name).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain(`Usage: npm run sw2d -- ${name}`);
    errSpy.mockRestore();
  });

  it.each([
    ['validate', () => import('../src/commands/validate.ts')],
    ['build', () => import('../src/commands/build.ts')],
    ['pack', () => import('../src/commands/pack.ts')],
  ])('%s: rejects an invalid slug before touching the filesystem', async (name, load) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { run } = await load();
    const code = await run(['Not_A_Slug']);
    expect(code, name).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toMatch(/slug/i);
    errSpy.mockRestore();
  });

  it.each([
    ['validate', () => import('../src/commands/validate.ts')],
    ['build', () => import('../src/commands/build.ts')],
    ['pack', () => import('../src/commands/pack.ts')],
  ])('%s: fails fast for a game that does not exist, before any install/build step', async (name, load) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { run } = await load();
    const code = await run(['no-such-game-at-all']);
    expect(code, name).toBe(1);
    expect(errSpy.mock.calls.join(' ')).toContain('does not exist');
    errSpy.mockRestore();
  });
});
