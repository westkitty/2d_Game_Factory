import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Mechanically derives the set of third-party npm packages actually shipped
 * in a generated game's production build, by walking the real dependency
 * graph starting from that game's own `package.json` `dependencies` - not a
 * second hand-maintained list (Phase 11 section 6: "derive them mechanically
 * from installed production dependency metadata"). `@sw2d/*` workspace
 * packages are project code, not third-party notices material, but their own
 * `dependencies` (never `devDependencies` - those never reach a browser
 * bundle) are real transitive third-party surface and must be walked too.
 */

export interface ShippedDependency {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly repository: string | undefined;
  readonly licenseText: string | undefined;
}

function workspacePackageDir(repoRoot: string, packageName: string): string | undefined {
  const shortName = packageName.replace('@sw2d/', '');
  const candidate = path.join(repoRoot, 'packages', shortName);
  return existsSync(path.join(candidate, 'package.json')) ? candidate : undefined;
}

function readPackageJson(dir: string): { name: string; version?: string; license?: string; repository?: unknown; dependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

function repositoryUrlOf(repository: unknown): string | undefined {
  if (typeof repository === 'string') return repository;
  if (repository && typeof repository === 'object' && 'url' in repository) {
    const url = (repository as { url?: unknown }).url;
    return typeof url === 'string' ? url.replace(/^git\+/, '').replace(/\.git$/, '') : undefined;
  }
  return undefined;
}

function findLicenseText(nodeModulesDir: string, packageName: string): string | undefined {
  const dir = path.join(nodeModulesDir, packageName);
  if (!existsSync(dir)) return undefined;
  const licenseFile = readdirSync(dir).find((f) => /^licen[sc]e/i.test(f));
  return licenseFile ? readFileSync(path.join(dir, licenseFile), 'utf8').trim() : undefined;
}

/**
 * Walk `startDependencyNames` (a generated game's `package.json`
 * `dependencies` keys) through the real `@sw2d/*` workspace graph to the
 * third-party leaves, resolving each leaf's installed metadata from
 * `node_modules`. Returns the shipped set, deduped and sorted by name.
 */
export function resolveShippedDependencies(repoRoot: string, startDependencyNames: readonly string[]): ShippedDependency[] {
  const nodeModulesDir = path.join(repoRoot, 'node_modules');
  const seen = new Set<string>();
  const thirdParty = new Map<string, ShippedDependency>();
  const queue = [...startDependencyNames];

  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);

    const workspaceDir = workspacePackageDir(repoRoot, name);
    if (workspaceDir) {
      const pkg = readPackageJson(workspaceDir);
      for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push(dep);
      continue;
    }

    const installedDir = path.join(nodeModulesDir, name);
    if (!existsSync(path.join(installedDir, 'package.json'))) {
      throw new Error(`Cannot resolve shipped dependency "${name}": not a workspace package and not found under node_modules.`);
    }
    const pkg = readPackageJson(installedDir);
    thirdParty.set(name, {
      name,
      version: pkg.version ?? 'unknown',
      license: pkg.license ?? 'unknown',
      repository: repositoryUrlOf(pkg.repository),
      licenseText: findLicenseText(nodeModulesDir, name),
    });
    // A third-party package's own runtime dependencies are shipped too.
    for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push(dep);
  }

  return [...thirdParty.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Plain-text THIRD_PARTY_NOTICES for a release pack - one section per shipped dependency, full license text when available. */
export function formatThirdPartyNoticesText(deps: readonly ShippedDependency[]): string {
  if (deps.length === 0) return 'THIRD-PARTY NOTICES\n\nNo third-party code is shipped in this build.\n';
  const sections = deps.map((d) => {
    const header = `${d.name} ${d.version} - ${d.license}`;
    const lines = [header, '='.repeat(header.length)];
    if (d.repository) lines.push(d.repository);
    lines.push('');
    lines.push(d.licenseText ?? '(license text not bundled with the installed package)');
    return lines.join('\n');
  });
  return `THIRD-PARTY NOTICES\n\n${sections.join('\n\n')}\n`;
}

/**
 * A shipped third-party visual asset, as recorded in the game's
 * resources/RESOURCE_MANIFEST.json.
 */
export interface ShippedAsset {
  readonly originalSource?: string;
  readonly license: string;
  readonly attributionRequired: boolean;
  readonly modificationStatus: 'unmodified' | 'modified' | 'generated';
  readonly localPath: string;
}

/**
 * Human-readable credits for bundled third-party artwork, grouped by source.
 *
 * Derived mechanically from the resource manifest the workbench/CLI already
 * maintains from real provenance - not a hand-kept list. Every file named here
 * is local to the build; the running game makes no network request for it.
 */
export function formatThirdPartyAssetNoticesText(assets: readonly ShippedAsset[]): string {
  if (assets.length === 0) {
    return 'THIRD-PARTY ASSET NOTICES\n\nNo third-party visual assets are bundled in this build. All artwork is project-owned or generated locally.\n';
  }
  const bySource = new Map<string, ShippedAsset[]>();
  for (const asset of assets) {
    const key = asset.originalSource ?? '(source not recorded)';
    const bucket = bySource.get(key) ?? [];
    bucket.push(asset);
    bySource.set(key, bucket);
  }
  const sections = [...bySource.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([source, group]) => {
      const first = group[0]!;
      const lines = [`Source: ${source}`];
      lines.push(`  Licence: ${first.license}`);
      lines.push(`  Attribution: ${first.attributionRequired ? 'required - see the source page for the credit line' : 'not required'}`);
      const mods = [...new Set(group.map((a) => a.modificationStatus))].join(', ');
      lines.push(`  Modifications: ${mods}`);
      lines.push('  Files:');
      for (const asset of group.slice().sort((a, b) => a.localPath.localeCompare(b.localPath))) lines.push(`    ${asset.localPath}`);
      return lines.join('\n');
    });
  return `THIRD-PARTY ASSET NOTICES\n\nThis build bundles the following third-party visual assets. Every file is\nlocal to the game; the running game makes no network request for them.\n\n${sections.join('\n\n')}\n`;
}
