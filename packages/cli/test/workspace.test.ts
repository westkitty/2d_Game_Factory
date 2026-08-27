import { describe, expect, it } from 'vitest';
import { WORKSPACE_REQUIRED_PATHS, ensureWorkspaceInstalled } from '../src/workspace.ts';

describe('generated-game dependency policy', () => {
  it('uses the already-installed factory root instead of running npm per game', async () => {
    expect(WORKSPACE_REQUIRED_PATHS).toContain('node_modules/@sw2d/runtime/package.json');
    expect(WORKSPACE_REQUIRED_PATHS).toContain('node_modules/phaser/package.json');
    expect(WORKSPACE_REQUIRED_PATHS).toContain('node_modules/typescript/package.json');
    await expect(ensureWorkspaceInstalled()).resolves.toBeUndefined();
  });
});
