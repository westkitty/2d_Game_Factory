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
  it('keeps direct .ts entrypoints runnable on the declared Node 22.12 minimum', () => {
    const pkg = rootPackage();
    expect(pkg.engines?.node).toBe('>=22.12.0');

    const directTypeScript = Object.entries(pkg.scripts ?? {}).filter(([, command]) =>
      command.startsWith('node ') && /(?:^|\s)[^\s]+\.ts(?:\s|$)/.test(command),
    );

    expect(directTypeScript.length).toBeGreaterThan(0);
    for (const [name, command] of directTypeScript) {
      expect(command, `${name} launches TypeScript without Node 22.12 type stripping`).toMatch(
        /^node --experimental-strip-types\s/,
      );
    }
  });
});
