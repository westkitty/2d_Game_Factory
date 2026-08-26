import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/paths.ts';

/**
 * MASTER_PROJECT.md section 20.2 requires a provenance record for *every*
 * nontrivial direct dependency - not only the ones that reach a production
 * build. `pack`'s own `THIRD_PARTY_NOTICES.txt` is already mechanically
 * derived from the shipped graph (see notices.test.ts), so a shipped
 * dependency cannot go unrecorded in a release artifact. The repository-level
 * record was the remaining hand-maintained surface, and it had in fact
 * drifted twice: Phase 11 found `ajv`/`ajv-formats` missing, Phase 12 found
 * `playwright-core` and `@types/node` missing.
 *
 * This suite closes that surface the same way: the required set is derived
 * from every workspace `package.json` on disk, never hand-listed here, so
 * adding a dependency without recording it fails loudly instead of silently
 * producing an incomplete provenance record.
 */

interface DependencyRecord {
  readonly name: string;
  readonly exactVersion: string;
  readonly canonicalSource: string;
  readonly license: string;
  readonly purpose: string;
  readonly shippedInBuild: boolean;
  readonly hasInstallScripts: boolean;
  readonly introducesNetworkOrTelemetry: boolean;
  readonly removalPath: string;
}

const MANIFEST_PATH = path.join(REPO_ROOT, 'docs/resources/CODE_RESOURCE_MANIFEST.json');

function readManifest(): { readonly dependencies: readonly DependencyRecord[] } {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { dependencies: DependencyRecord[] };
}

/** Every committed workspace manifest. `games/` is generated and gitignored, so it is never a source of truth. */
function workspacePackageJsonPaths(): readonly string[] {
  const paths = [path.join(REPO_ROOT, 'package.json'), path.join(REPO_ROOT, 'starter/package.json')];
  for (const group of ['packages', 'demos', 'proofs']) {
    const root = path.join(REPO_ROOT, group);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(root, entry.name, 'package.json');
      if (existsSync(candidate)) paths.push(candidate);
    }
  }
  return paths;
}

/** name -> the exact version range(s) declared for it anywhere in the workspace. */
function declaredThirdPartyDependencies(): ReadonlyMap<string, ReadonlySet<string>> {
  const found = new Map<string, Set<string>>();
  for (const manifestPath of workspacePackageJsonPaths()) {
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const block of [pkg.dependencies, pkg.devDependencies]) {
      for (const [name, version] of Object.entries(block ?? {})) {
        if (name.startsWith('@sw2d/')) continue; // a workspace package is never third-party
        const versions = found.get(name) ?? new Set<string>();
        versions.add(version);
        found.set(name, versions);
      }
    }
  }
  return found;
}

describe('docs/resources/CODE_RESOURCE_MANIFEST.json', () => {
  it('records every third-party dependency any workspace package.json declares', () => {
    const recorded = new Set(readManifest().dependencies.map((d) => d.name));
    const missing = [...declaredThirdPartyDependencies().keys()].filter((name) => !recorded.has(name));
    expect(missing, 'undocumented direct dependencies - add a record per MASTER_PROJECT.md 20.2').toEqual([]);
  });

  it('records no dependency the workspace does not actually declare', () => {
    const declared = declaredThirdPartyDependencies();
    const stale = readManifest().dependencies.map((d) => d.name).filter((name) => !declared.has(name));
    expect(stale, 'manifest records a dependency nothing declares any more').toEqual([]);
  });

  it("each record's exactVersion matches the version the workspace declares", () => {
    const declared = declaredThirdPartyDependencies();
    for (const record of readManifest().dependencies) {
      const versions = declared.get(record.name);
      if (!versions) continue; // covered by the staleness test above
      expect([...versions], record.name).toContain(record.exactVersion);
    }
  });

  it('each record carries every field section 20.2 requires', () => {
    for (const record of readManifest().dependencies) {
      expect(record.name, 'name').toBeTruthy();
      expect(record.exactVersion, `${record.name}.exactVersion`).toMatch(/^\d+\.\d+\.\d+/);
      expect(record.canonicalSource, `${record.name}.canonicalSource`).toMatch(/^https?:\/\//);
      expect(record.license, `${record.name}.license`).toBeTruthy();
      expect(record.purpose, `${record.name}.purpose`).toBeTruthy();
      expect(typeof record.shippedInBuild, `${record.name}.shippedInBuild`).toBe('boolean');
      expect(typeof record.hasInstallScripts, `${record.name}.hasInstallScripts`).toBe('boolean');
      expect(typeof record.introducesNetworkOrTelemetry, `${record.name}.introducesNetworkOrTelemetry`).toBe('boolean');
      expect(record.removalPath, `${record.name}.removalPath`).toBeTruthy();
    }
  });

  it('every recorded license is one resource-policy.json accepts', () => {
    const policy = JSON.parse(readFileSync(path.join(REPO_ROOT, 'resource-policy.json'), 'utf8')) as {
      defaults: { acceptableLicenses: string[] };
    };
    for (const record of readManifest().dependencies) {
      expect(policy.defaults.acceptableLicenses, record.name).toContain(record.license);
    }
  });

  it('no recorded dependency introduces network/telemetry behaviour or install scripts', () => {
    for (const record of readManifest().dependencies) {
      expect(record.introducesNetworkOrTelemetry, record.name).toBe(false);
      expect(record.hasInstallScripts, record.name).toBe(false);
    }
  });
});
