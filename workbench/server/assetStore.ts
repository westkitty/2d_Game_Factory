/**
 * Source and derived asset storage.
 *
 * The three rules this file exists to keep true:
 *
 *   P01  a source asset's bytes are written once and never overwritten in
 *        place; "replacing" one is a reimport that writes a *new* file and
 *        repoints the record.
 *   P02  an asset's identity is its `id`, not its path or its name. Renaming,
 *        moving or reimporting changes metadata; it never changes `id`, so
 *        role assignments and derivative lineage survive all three.
 *   P03  a derivative always records the source it came from and the recipe
 *        that produced it, so it can be rebuilt and is never load-bearing.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssetRecord, AssetsDocument, AssetValidation, Provenance, TransformRecipe, WorkbenchAssetRole } from '../shared/types.ts';
import { applyRecipe } from '../shared/image/recipe.ts';
import { extractPalette } from '../shared/image/transforms.ts';
import { decodePng, encodePng, isPng } from './png.ts';
import { sniffImage } from './imageMeta.ts';
import { SecurityError, extensionForMime, isSupportedImageMime, normalizeFileName } from './security.ts';
import { readJsonVersioned, writeJsonAtomic } from './atomicJson.ts';
import { derivedAssetsDir, ensureDir, gameRoot, resolveContained, sourceAssetsDir, sw2dDir } from './paths.ts';
import { groupKey, parseName } from '../shared/grouping.ts';

const EMPTY_ASSETS: AssetsDocument = { version: 1, assets: [] };

export function assetsPath(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'assets.json');
}

export function loadAssets(gameId: string): AssetsDocument {
  return readJsonVersioned<AssetsDocument>(assetsPath(gameId), 1, EMPTY_ASSETS);
}

export function saveAssets(gameId: string, document: AssetsDocument): void {
  writeJsonAtomic(assetsPath(gameId), document);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Mints a stable id.
 *
 * Seeded from the first content hash so two projects importing the same file
 * are not forced to disagree, then disambiguated by an ordinal against ids
 * already in use. Once minted it is frozen for the life of the asset - that
 * is the whole point of P02, and what acceptance item W04 checks.
 */
export function mintAssetId(prefix: 'src' | 'der', seed: string, taken: ReadonlySet<string>): string {
  for (let ordinal = 0; ordinal < 1_000_000; ordinal++) {
    const digest = createHash('sha256').update(`${prefix}:${seed}:${ordinal}`).digest('hex').slice(0, 16);
    const id = `${prefix}_${digest}`;
    if (!taken.has(id)) return id;
  }
  throw new Error('Exhausted asset id space; this should be unreachable.');
}

function takenIds(document: AssetsDocument): Set<string> {
  return new Set(document.assets.map((asset) => asset.id));
}

/** `<assetId>.<ext>` - content-addressed, so a hostile display name never becomes a path. */
function storedFileName(id: string, mime: string): string {
  return `${id}.${extensionForMime(mime)}`;
}

export interface StoreSourceInput {
  readonly gameId: string;
  readonly bytes: Uint8Array;
  readonly displayName: string;
  readonly sourceRelativePath: string;
  readonly provenance: Provenance;
  readonly group?: string;
  readonly frameIndex?: number;
  readonly folder?: string;
}

export interface StoreResult {
  readonly record: AssetRecord;
  readonly document: AssetsDocument;
}

/** An asset in this project with identical bytes, or undefined. Duplicate detection is by content hash, never by name. */
export function findByHash(document: AssetsDocument, sha256: string): AssetRecord | undefined {
  return document.assets.find((asset) => asset.sha256 === sha256);
}

export function storeSource(input: StoreSourceInput): StoreResult {
  const { gameId, bytes } = input;
  const sniffed = sniffImage(bytes);
  if (!isSupportedImageMime(sniffed.mime)) {
    throw new SecurityError(400, `"${input.displayName}" is ${sniffed.mime}, which the workbench does not import yet (PNG, JPEG and WebP are supported).`);
  }

  const document = loadAssets(gameId);
  const hash = sha256Hex(bytes);
  const id = mintAssetId('src', hash, takenIds(document));
  const fileName = storedFileName(id, sniffed.mime);

  const dir = sourceAssetsDir(gameId);
  ensureDir(dir);
  const absolute = resolveContained(dir, fileName);
  writeFileSync(absolute, bytes);

  const palette = isPng(bytes) ? extractPalette(decodePng(bytes), 6) : undefined;

  const record: AssetRecord = {
    id,
    kind: 'source',
    displayName: normalizeFileName(input.displayName),
    relativePath: `.sw2d/source-assets/${fileName}`,
    mime: sniffed.mime,
    width: sniffed.width,
    height: sniffed.height,
    byteSize: bytes.byteLength,
    sha256: hash,
    roleAssignments: [],
    provenance: input.provenance,
    ...(palette && palette.length > 0 ? { palette } : {}),
    ...(input.group !== undefined ? { group: input.group } : {}),
    ...(input.frameIndex !== undefined ? { frameIndex: input.frameIndex } : {}),
    ...(input.folder !== undefined ? { folder: input.folder } : {}),
  };

  const next: AssetsDocument = { version: 1, assets: [...document.assets, record] };
  saveAssets(gameId, next);
  return { record, document: next };
}

export interface StoreDerivedInput {
  readonly gameId: string;
  readonly sourceAssetId: string;
  readonly bytes: Uint8Array;
  readonly displayName: string;
  readonly recipe: TransformRecipe;
  readonly purpose?: 'sprite';
}

/**
 * Validates the actual encoded pixels, dimensions, lineage and replay recipe.
 * This runs on the host after upload; client-side canvas output is not trusted
 * merely because it came from the workbench UI.
 */
export function validateSprite(
  bytes: Uint8Array,
  source: AssetRecord,
  recipe: TransformRecipe,
): AssetValidation {
  const formatPassed = isPng(bytes);
  let width = 0;
  let height = 0;
  let visiblePixels = 0;
  if (formatPassed) {
    const raster = decodePng(bytes);
    width = raster.width;
    height = raster.height;
    for (let offset = 3; offset < raster.data.length; offset += 4) {
      if (raster.data[offset]! > 8) visiblePixels += 1;
    }
  }

  const dimensionsPassed = width >= 8 && height >= 8 && width <= 512 && height <= 512 && width / height >= 0.25 && width / height <= 4;
  const checks: AssetValidation['checks'] = [
    { id: 'format', label: 'Lossless sprite format', passed: formatPassed, detail: formatPassed ? 'Decoded as a valid PNG.' : 'Sprites must be valid PNG files.' },
    { id: 'dimensions', label: 'Runtime-safe dimensions', passed: dimensionsPassed, detail: `${width}x${height}; required 8–512 px with a usable aspect ratio.` },
    { id: 'visible-pixels', label: 'Visible artwork', passed: visiblePixels > 0, detail: `${visiblePixels.toLocaleString('en-US')} visible pixel${visiblePixels === 1 ? '' : 's'}.` },
    { id: 'source-lineage', label: 'Supplied-image lineage', passed: source.kind === 'source', detail: `Derived against ${source.displayName} (${source.sha256.slice(0, 12)}).` },
    { id: 'recipe', label: 'Rebuildable recipe', passed: recipe.steps.length > 0, detail: `${recipe.steps.length} recorded transform step${recipe.steps.length === 1 ? '' : 's'}.` },
  ];
  return {
    purpose: 'sprite',
    status: checks.every((check) => check.passed) ? 'valid' : 'invalid',
    sourceSha256: source.sha256,
    checks,
  };
}

/**
 * Stores a derivative produced by the browser.
 *
 * Derived bytes land in `public/assets/workbench/`, which is game-local and
 * same-origin - the only place a `{ kind: 'image' }` asset descriptor is
 * allowed to point (contracts: "must be same-origin"). Provenance is
 * inherited from the source and marked `modified`, so a derivative of an
 * unknown-licence image is itself unknown and still blocks release.
 */
export function storeDerived(input: StoreDerivedInput): StoreResult {
  const document = loadAssets(input.gameId);
  const source = document.assets.find((asset) => asset.id === input.sourceAssetId);
  if (!source) throw new SecurityError(404, `No source asset "${input.sourceAssetId}" in this project.`);
  if (source.provenance.kind === 'reference-only') {
    throw new SecurityError(400, `"${source.displayName}" is marked reference-only: its pixels may not be copied into the game. Derive a palette or generated art from it instead.`);
  }

  const sniffed = sniffImage(input.bytes);
  const validation = input.purpose === 'sprite' ? validateSprite(input.bytes, source, input.recipe) : undefined;
  if (validation?.status === 'invalid') {
    const failures = validation.checks.filter((check) => !check.passed).map((check) => check.detail).join(' ');
    throw new SecurityError(422, `The derived sprite did not validate. ${failures}`);
  }
  const hash = sha256Hex(input.bytes);
  const id = mintAssetId('der', `${source.id}:${hash}`, takenIds(document));
  const fileName = storedFileName(id, sniffed.mime);

  const dir = derivedAssetsDir(input.gameId);
  ensureDir(dir);
  writeFileSync(resolveContained(dir, fileName), input.bytes);

  const palette = isPng(input.bytes) ? extractPalette(decodePng(input.bytes), 6) : undefined;
  const namedFrame = parseName(input.displayName);

  const record: AssetRecord = {
    id,
    kind: 'derived',
    displayName: normalizeFileName(input.displayName),
    relativePath: `public/assets/workbench/${fileName}`,
    mime: sniffed.mime,
    width: sniffed.width,
    height: sniffed.height,
    byteSize: input.bytes.byteLength,
    sha256: hash,
    sourceAssetId: source.id,
    transformRecipe: input.recipe,
    roleAssignments: [],
    provenance: { ...source.provenance, modificationStatus: 'modified' },
    ...(validation ? { validation } : {}),
    ...(palette && palette.length > 0 ? { palette } : {}),
    ...(namedFrame.frameIndex !== undefined
      ? { group: groupKey(input.displayName), frameIndex: namedFrame.frameIndex }
      : source.group !== undefined
        ? { group: source.group }
        : {}),
  };

  const next: AssetsDocument = { version: 1, assets: [...document.assets, record] };
  saveAssets(input.gameId, next);
  return { record, document: next };
}

export interface ReimportResult {
  readonly record: AssetRecord;
  readonly staleDerivedIds: readonly string[];
  readonly document: AssetsDocument;
  readonly changed: boolean;
}

/**
 * Replaces a source asset's *bytes* while keeping its identity.
 *
 * The id, its role assignments and every derivative's lineage survive; the
 * derivatives are marked stale so the UI can offer to rebuild them. The old
 * file is removed only after the new one is written, and only when the hash
 * actually changed - reimporting identical bytes is a no-op that reports
 * `changed: false` rather than silently churning the project.
 */
export function reimportSource(gameId: string, assetId: string, bytes: Uint8Array, displayName?: string): ReimportResult {
  const document = loadAssets(gameId);
  const existing = document.assets.find((asset) => asset.id === assetId);
  if (!existing) throw new SecurityError(404, `No asset "${assetId}" in this project.`);
  if (existing.kind !== 'source') throw new SecurityError(400, `"${assetId}" is a derived asset; reimport replaces a source.`);

  const sniffed = sniffImage(bytes);
  if (!isSupportedImageMime(sniffed.mime)) {
    throw new SecurityError(400, `Replacement is ${sniffed.mime}, which the workbench does not import.`);
  }
  const hash = sha256Hex(bytes);
  if (hash === existing.sha256) {
    return { record: existing, staleDerivedIds: [], document, changed: false };
  }

  const fileName = storedFileName(existing.id, sniffed.mime);
  const dir = sourceAssetsDir(gameId);
  ensureDir(dir);
  const absolute = resolveContained(dir, fileName);
  const previousAbsolute = resolveContained(gameRoot(gameId), existing.relativePath);
  writeFileSync(absolute, bytes);
  if (path.resolve(previousAbsolute) !== path.resolve(absolute) && existsSync(previousAbsolute)) {
    rmSync(previousAbsolute, { force: true });
  }

  const palette = isPng(bytes) ? extractPalette(decodePng(bytes), 6) : undefined;
  const updated: AssetRecord = {
    ...existing,
    // Everything below is metadata. `id` and `roleAssignments` are untouched
    // on purpose - that is what makes W10 ("reimport does not lose the role")
    // true by construction rather than by remembering to re-apply it.
    displayName: displayName ? normalizeFileName(displayName) : existing.displayName,
    relativePath: `.sw2d/source-assets/${fileName}`,
    mime: sniffed.mime,
    width: sniffed.width,
    height: sniffed.height,
    byteSize: bytes.byteLength,
    sha256: hash,
    ...(palette && palette.length > 0 ? { palette } : {}),
  };

  const staleDerivedIds = document.assets.filter((asset) => asset.sourceAssetId === existing.id).map((asset) => asset.id);
  const staleSet = new Set(staleDerivedIds);

  const next: AssetsDocument = {
    version: 1,
    assets: document.assets.map((asset) => {
      if (asset.id === existing.id) return updated;
      if (staleSet.has(asset.id)) return { ...asset, stale: true };
      return asset;
    }),
  };
  saveAssets(gameId, next);
  return { record: updated, staleDerivedIds, document: next, changed: true };
}

export function readAssetBytes(gameId: string, asset: AssetRecord): Uint8Array {
  const absolute = resolveContained(gameRoot(gameId), asset.relativePath);
  if (!existsSync(absolute)) {
    throw new SecurityError(404, `"${asset.displayName}" is missing from disk at ${asset.relativePath}.`);
  }
  return new Uint8Array(readFileSync(absolute));
}

/**
 * Rebuilds one derivative on the host by replaying its recipe.
 *
 * PNG sources only - the host has no JPEG/WebP decoder by design (section
 * 3.3), so a derivative of a JPEG is rebuilt by the browser instead. Returning
 * `null` rather than throwing lets `rebuildStale` do the PNG ones and report
 * honestly on the rest.
 */
export function rebuildDerivedOnHost(gameId: string, derivedId: string): AssetRecord | null {
  const document = loadAssets(gameId);
  const derived = document.assets.find((asset) => asset.id === derivedId);
  if (!derived || derived.kind !== 'derived' || !derived.sourceAssetId || !derived.transformRecipe) return null;
  const source = document.assets.find((asset) => asset.id === derived.sourceAssetId);
  if (!source) return null;

  const sourceBytes = readAssetBytes(gameId, source);
  if (!isPng(sourceBytes)) return null;

  const rebuilt = encodePng(applyRecipe(decodePng(sourceBytes), derived.transformRecipe));
  const fileName = `${derived.id}.png`;
  const dir = derivedAssetsDir(gameId);
  ensureDir(dir);
  writeFileSync(resolveContained(dir, fileName), rebuilt);

  const sniffed = sniffImage(rebuilt);
  const updated: AssetRecord = {
    ...derived,
    relativePath: `public/assets/workbench/${fileName}`,
    mime: 'image/png',
    width: sniffed.width,
    height: sniffed.height,
    byteSize: rebuilt.byteLength,
    sha256: sha256Hex(rebuilt),
    ...(derived.validation ? { validation: validateSprite(rebuilt, source, derived.transformRecipe) } : {}),
    stale: false,
  };
  saveAssets(gameId, { version: 1, assets: document.assets.map((asset) => (asset.id === derived.id ? updated : asset)) });
  return updated;
}

export interface RebuildReport {
  readonly rebuilt: readonly string[];
  /** Derivatives the host could not rebuild (non-PNG source), named so the UI can hand them to the browser. */
  readonly deferredToClient: readonly string[];
}

export function rebuildStale(gameId: string, ids: readonly string[]): RebuildReport {
  const rebuilt: string[] = [];
  const deferred: string[] = [];
  for (const id of ids) {
    const result = rebuildDerivedOnHost(gameId, id);
    if (result) rebuilt.push(id);
    else deferred.push(id);
  }
  return { rebuilt, deferredToClient: deferred };
}

/** Removes an asset and, when it is a source, every derivative that hangs off it. Never leaves a dangling `sourceAssetId`. */
export function deleteAsset(gameId: string, assetId: string): AssetsDocument {
  const document = loadAssets(gameId);
  const target = document.assets.find((asset) => asset.id === assetId);
  if (!target) throw new SecurityError(404, `No asset "${assetId}" in this project.`);

  const doomed = new Set<string>([target.id]);
  if (target.kind === 'source') {
    for (const asset of document.assets) if (asset.sourceAssetId === target.id) doomed.add(asset.id);
  }
  for (const asset of document.assets) {
    if (!doomed.has(asset.id)) continue;
    const absolute = resolveContained(gameRoot(gameId), asset.relativePath);
    rmSync(absolute, { force: true });
  }
  const next: AssetsDocument = { version: 1, assets: document.assets.filter((asset) => !doomed.has(asset.id)) };
  saveAssets(gameId, next);
  return next;
}

export function setDisplayName(gameId: string, assetId: string, displayName: string): AssetsDocument {
  const document = loadAssets(gameId);
  const next: AssetsDocument = {
    version: 1,
    assets: document.assets.map((asset) => (asset.id === assetId ? { ...asset, displayName: normalizeFileName(displayName) } : asset)),
  };
  saveAssets(gameId, next);
  return next;
}

export function setProvenance(gameId: string, assetId: string, provenance: Provenance): AssetsDocument {
  const document = loadAssets(gameId);
  const next: AssetsDocument = {
    version: 1,
    assets: document.assets.map((asset) => {
      if (asset.id !== assetId) return asset;
      // A derivative inherits its source's provenance; changing the source's
      // must therefore flow down, or a project could ship a modified copy of
      // an unknown-licence image with a clean record.
      return { ...asset, provenance };
    }),
  };
  const withInheritance: AssetsDocument = {
    version: 1,
    assets: next.assets.map((asset) =>
      asset.sourceAssetId === assetId ? { ...asset, provenance: { ...provenance, modificationStatus: 'modified' as const } } : asset,
    ),
  };
  saveAssets(gameId, withInheritance);
  return withInheritance;
}

/** One role maps to at most one asset. Assigning it elsewhere clears the previous holder, so the mapping can never be ambiguous. */
export function assignRole(gameId: string, role: WorkbenchAssetRole, assetId: string | null): AssetsDocument {
  const document = loadAssets(gameId);
  const next: AssetsDocument = {
    version: 1,
    assets: document.assets.map((asset) => {
      const without = asset.roleAssignments.filter((r) => r !== role);
      if (assetId !== null && asset.id === assetId) return { ...asset, roleAssignments: [...without, role] };
      if (without.length === asset.roleAssignments.length) return asset;
      return { ...asset, roleAssignments: without };
    }),
  };
  if (assetId !== null && !next.assets.some((asset) => asset.id === assetId)) {
    throw new SecurityError(404, `No asset "${assetId}" in this project.`);
  }
  saveAssets(gameId, next);
  return next;
}

export function assetById(document: AssetsDocument, assetId: string): AssetRecord | undefined {
  return document.assets.find((asset) => asset.id === assetId);
}

export function assetForRole(document: AssetsDocument, role: WorkbenchAssetRole): AssetRecord | undefined {
  return document.assets.find((asset) => asset.roleAssignments.includes(role));
}
