import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ResourceGovernanceError, SchemaValidationError, validateResourceManifest } from '@sw2d/schemas';
import { run as runProcess } from '../exec.ts';
import { REPO_ROOT, GAMES_ROOT, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';
import { ensureWorkspaceInstalled } from '../workspace.ts';
import { computeChecksums, formatSha256Sums } from '../releasePackaging/checksums.ts';
import { buildReleaseManifest } from '../releasePackaging/releaseManifest.ts';
import { formatThirdPartyNoticesText, resolveShippedDependencies } from '../releasePackaging/notices.ts';

/**
 * `sw2d pack <game-id>` - the release packer (Phase 11 section 5). Builds a
 * generated game with a real `vite build`, then produces a self-contained
 * static release candidate: the built game plus a deterministic
 * RELEASE_MANIFEST.json, a SHA-256 SHA256SUMS covering every shipped file,
 * and mechanically-derived THIRD_PARTY_NOTICES.txt. A resource governance
 * failure (missing/invalid manifest, or any non-approved record) blocks
 * packaging before a release candidate is ever produced - "unapproved
 * resources cannot silently package" is enforced here, not left as a log
 * line to notice later.
 */

interface ResourcePolicyFile {
  readonly defaults: { readonly acceptableLicenses: readonly string[] };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export async function run(args: readonly string[]): Promise<number> {
  const gameId = args[0];
  if (!gameId) {
    console.error('Usage: npm run sw2d -- pack <game-id>');
    return 1;
  }
  try {
    assertValidSlug('game id', gameId);
  } catch (error) {
    if (error instanceof InvalidSlugError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  const gamePath = resolveUnder(GAMES_ROOT, gameId);
  if (!existsSync(gamePath)) {
    console.error(`Game "${gameId}" does not exist. Run: npm run sw2d -- new ${gameId} --preset <preset-id>`);
    return 1;
  }

  // Resource governance runs before any build step: an unapproved or
  // malformed resource manifest must block packaging outright, not merely
  // be logged after an expensive build already ran.
  const resourceManifestPath = path.join(gamePath, 'resources', 'RESOURCE_MANIFEST.json');
  if (!existsSync(resourceManifestPath)) {
    console.error(`Refusing to pack "${gameId}": resources/RESOURCE_MANIFEST.json is missing.`);
    return 1;
  }
  const policy = readJson<ResourcePolicyFile>(path.join(REPO_ROOT, 'resource-policy.json'));
  let resourceRecordCount = 0;
  try {
    const manifestData = readJson<unknown>(resourceManifestPath);
    const manifest = validateResourceManifest(`games/${gameId}/resources/RESOURCE_MANIFEST.json`, manifestData, {
      acceptableLicenses: policy.defaults.acceptableLicenses,
    });
    resourceRecordCount = manifest.records.length;
    const nonApproved = manifest.records.filter((r) => r.status !== 'approved');
    if (nonApproved.length > 0) {
      console.error(
        `Refusing to pack "${gameId}": ${nonApproved.length} resource record(s) are not approved: ` +
          nonApproved.map((r) => `${r.id} (${r.status})`).join(', '),
      );
      return 1;
    }
  } catch (error) {
    if (error instanceof SchemaValidationError || error instanceof ResourceGovernanceError) {
      console.error(`Refusing to pack "${gameId}": ${error.message}`);
      return 1;
    }
    throw error;
  }

  await ensureWorkspaceInstalled();

  const buildResult = await runProcess('npx', ['vite', 'build'], { cwd: gamePath });
  if (buildResult.code !== 0) {
    console.error(`Build failed for "${gameId}":`);
    console.error(buildResult.stderr || buildResult.stdout);
    return 1;
  }

  const distDir = path.join(gamePath, 'dist');
  const packDir = path.join(gamePath, 'pack');
  // Clean packing, not incremental - a stale file from a previous pack must
  // never survive into this one.
  rmSync(packDir, { recursive: true, force: true });
  // dist/ already contains only build output (Vite never emits source, tests
  // or node_modules into it), so copying it verbatim already satisfies
  // MASTER_PROJECT.md section 9's "exclude source/tests/node_modules".
  cpSync(distDir, packDir, { recursive: true });

  const offlineResult = await runProcess('node', ['tools/scripts/check-offline-build.mjs', `games/${gameId}/pack`], {
    cwd: REPO_ROOT,
  });
  console.log(offlineResult.stdout);
  if (offlineResult.code !== 0) {
    console.error(offlineResult.stderr);
    console.error(`Pack produced but failed the offline guard for "${gameId}".`);
    return 1;
  }

  // File inventory of the shipped game build, before this command adds its
  // own release evidence files (RELEASE_MANIFEST.json, THIRD_PARTY_NOTICES.txt,
  // SHA256SUMS) on top.
  const shippedFileInventory = (await computeChecksums(packDir)).map((e) => e.relativePath);

  const gamePackageJson = readJson<{ dependencies?: Record<string, string>; sw2d?: { presetId?: string } }>(
    path.join(gamePath, 'package.json'),
  );
  const factoryPackageJson = readJson<{ version: string; license: string }>(path.join(REPO_ROOT, 'package.json'));
  const presetId = gamePackageJson.sw2d?.presetId ?? 'unknown';

  const shippedDependencies = resolveShippedDependencies(REPO_ROOT, Object.keys(gamePackageJson.dependencies ?? {}));
  writeFileSync(path.join(packDir, 'THIRD_PARTY_NOTICES.txt'), formatThirdPartyNoticesText(shippedDependencies), 'utf8');

  const releaseManifest = buildReleaseManifest({
    gameId,
    presetId,
    factoryVersion: factoryPackageJson.version,
    packagingMode: 'static-vite-build',
    fileInventory: shippedFileInventory,
    projectLicenseStatus: factoryPackageJson.license,
    resourceGovernance: { manifestValid: true, recordCount: resourceRecordCount, allApproved: true },
  });
  writeFileSync(path.join(packDir, 'RELEASE_MANIFEST.json'), JSON.stringify(releaseManifest, null, 2) + '\n', 'utf8');

  // SHA256SUMS covers every file now in packDir, computed last so it never
  // has to include a checksum for itself.
  const checksumEntries = await computeChecksums(packDir);
  writeFileSync(path.join(packDir, 'SHA256SUMS'), formatSha256Sums(checksumEntries), 'utf8');

  console.log(`Packed "${gameId}" -> games/${gameId}/pack/ (clean, static, offline-guard-passed, checksummed).`);
  return 0;
}
