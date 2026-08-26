import { describe, expect, it } from 'vitest';
import { WORKSPACE_INSTALL_ARGS } from '../src/workspace.ts';

describe('workspace linking policy', () => {
  it('is offline and cannot rewrite package-lock.json', () => {
    expect(WORKSPACE_INSTALL_ARGS[0]).toBe('install');
    expect(WORKSPACE_INSTALL_ARGS).toContain('--offline');
    expect(WORKSPACE_INSTALL_ARGS).toContain('--no-package-lock');
    expect(WORKSPACE_INSTALL_ARGS).toContain('--no-audit');
    expect(WORKSPACE_INSTALL_ARGS).toContain('--no-fund');
  });
});
