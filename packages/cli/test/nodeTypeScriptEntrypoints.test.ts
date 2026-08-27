import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

interface RootPackageJson {
  readonly engines?: { readonly node?: string };
  readonly scripts?: Readonly<Record<string, string>>;
}

function rootPackage(): RootPackageJson {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as RootPackageJson;
}

describe('Node TypeScript command entrypoints', () => {
  it('keeps every direct .ts process runnable on the declared Node 22.12 minimum', () => {
    const pkg = rootPackage();
    expect(pkg.engines?.node).toBe('>=22.12.0');

    const directTypeScript = Object.entries(pkg.scripts ?? {}).flatMap(([name, command]) =>
      command
        .split(/\s*(?:&&|\|\||;)\s*/)
        .filter((segment) => segment.startsWith('node ') && /(?:^|\s)[^\s]+\.ts(?:\s|$)/.test(segment))
        .map((segment) => ({ name, segment })),
    );

    expect(directTypeScript.length).toBeGreaterThan(0);
    for (const { name, segment } of directTypeScript) {
      expect(segment, `${name} launches TypeScript without Node 22.12 type stripping`).toMatch(
        /^node --experimental-strip-types\s/,
      );
    }
  });

  it('materializes ignored batch fixtures and builds the workbench before real-browser QA starts', () => {
    const command = rootPackage().scripts?.['qa:workbench'];
    expect(command).toBe(
      'node --experimental-strip-types workbench/qa/prepareBatchFixture.ts && npm run workbench:build && node --experimental-strip-types workbench/qa/runWorkbenchQa.ts',
    );
  });

  it('runs the workbench Pack subprocess through Node 22.12 type stripping', () => {
    const source = readFileSync(path.join(REPO_ROOT, 'workbench/server/factoryService.ts'), 'utf8');
    expect(source).toContain(
      "['--experimental-strip-types', resolveContained(REPO_ROOT, 'packages', 'cli', 'src', 'bin.ts'), 'pack', gameId]",
    );
  });
});
