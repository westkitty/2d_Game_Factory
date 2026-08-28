import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('root validation contract', () => {
  it('builds both user-facing applications before reporting green', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
    expect(packageJson.scripts.validate).toContain('npm run workbench:build');
    expect(packageJson.scripts.validate).toContain('npm run build');
  });
});
