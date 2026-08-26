import { describe, expect, it, vi } from 'vitest';

/**
 * `doctor` never mutates the project (packages/cli/src/commands/doctor.ts's
 * own doc comment) - so both cases here are safe to run directly against
 * the real repo state, no temp fixtures needed.
 */
describe('doctor command', () => {
  it('reports a healthy exit code (0) in this installed, buildable repo', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { run } = await import('../src/commands/doctor.ts');
      const code = await run();
      expect(code).toBe(0);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Node.js');
      expect(output).toContain('Schemas (@sw2d/schemas)');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('reports failure (1) when a required directory is missing', async () => {
    vi.resetModules();
    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs')>();
      return {
        ...actual,
        existsSync: (target: string) => (typeof target === 'string' && target.endsWith('packages/runtime') ? false : actual.existsSync(target)),
      };
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { run } = await import('../src/commands/doctor.ts');
      const code = await run();
      expect(code).toBe(1);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('[FAIL] Directory packages/runtime');
    } finally {
      logSpy.mockRestore();
      vi.doUnmock('node:fs');
      vi.resetModules();
    }
  });
});
