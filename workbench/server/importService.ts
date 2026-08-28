/**
 * The Import Inbox's host half (principle P05: import is staged).
 *
 * Nothing an intake produces enters the project directly. Files land in a
 * disposable staging directory under `.sw2d/cache/`, are analysed there, and
 * become assets only when the user commits a plan they have seen and can
 * correct. Every intake route - one file, many files, a dropped folder, a ZIP
 * - produces the same `ImportPlan` and goes through the same `commitImport`,
 * which is how Construct's breadth of entry points is copied without copying
 * the risk of each one behaving differently.
 *
 * Staged bytes go to disk immediately rather than being held in memory. A
 * 96 MiB batch buffered in the host is exactly the all-at-once shape failure
 * condition F17 names.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { ImageAnalysis, ImportBatch, ImportPlan, IgnoredFile, Provenance, StagedFile, WorkbenchAssetRole } from '../shared/types.ts';
import { WORKBENCH_ASSET_ROLES } from '../shared/types.ts';
import { folderOf, groupByName, parseName, roleHintsFromName } from '../shared/grouping.ts';
import { alphaBounds, extractPalette, hasAlpha, looksLikePixelArt, suggestGrids } from '../shared/image/transforms.ts';
import { decodePng, isPng } from './png.ts';
import { sniffImage } from './imageMeta.ts';
import { LIMITS, SecurityError, isSupportedImageMime, normalizeFileName, normalizeRelativePath } from './security.ts';
import { cacheDir, ensureDir, resolveContained } from './paths.ts';
import { loadAssets, sha256Hex, storeSource } from './assetStore.ts';
import { appendImportBatch } from './projectStore.ts';
import { looksLikeZip, readZip } from './zip.ts';

function stagingRoot(gameId: string): string {
  return resolveContained(cacheDir(gameId), 'staging');
}

function batchDir(gameId: string, batchId: string): string {
  if (!/^[a-f0-9-]{36}$/.test(batchId)) throw new SecurityError(400, `Invalid batch id ${JSON.stringify(batchId)}.`);
  return resolveContained(stagingRoot(gameId), batchId);
}

export function newBatchId(): string {
  return randomUUID();
}

/**
 * Analysis the *client* may supply for formats the host cannot decode.
 *
 * Only the advisory fields. Mime, dimensions, byte size and hash are always
 * re-derived from the bytes here and never taken on trust - those are the
 * fields security and duplicate detection depend on.
 */
export interface ClientAnalysisHints {
  readonly palette?: readonly string[];
  readonly hasAlpha?: boolean;
  readonly alphaBounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly pixelArtLikely?: boolean;
}

export function analyseBytes(bytes: Uint8Array, hints?: ClientAnalysisHints): ImageAnalysis {
  const sniffed = sniffImage(bytes);
  const base = {
    mime: sniffed.mime,
    width: sniffed.width,
    height: sniffed.height,
    byteSize: bytes.byteLength,
    sha256: sha256Hex(bytes),
    aspectRatio: Math.round((sniffed.width / sniffed.height) * 1000) / 1000,
    gridSuggestions: suggestGrids(sniffed.width, sniffed.height),
  };

  if (isPng(bytes)) {
    // The host can decode PNG, so it does not need the client's opinion.
    const raster = decodePng(bytes);
    return {
      ...base,
      hasAlpha: hasAlpha(raster),
      alphaBounds: alphaBounds(raster),
      palette: extractPalette(raster, 6),
      pixelArtLikely: looksLikePixelArt(raster),
    };
  }

  return {
    ...base,
    hasAlpha: hints?.hasAlpha ?? false,
    alphaBounds: hints?.alphaBounds ?? null,
    palette: hints?.palette ?? [],
    pixelArtLikely: hints?.pixelArtLikely ?? false,
  };
}

interface StagedRecord {
  readonly stagingId: string;
  readonly displayName: string;
  readonly sourceRelativePath: string;
  readonly analysis: ImageAnalysis;
  readonly storedPath: string;
}

/** In-memory index of what has been staged, keyed by batch. Bytes live on disk; only this metadata is held. */
const BATCHES = new Map<string, { gameId: string; files: StagedRecord[]; ignored: IgnoredFile[] }>();

function batchState(batchId: string): { gameId: string; files: StagedRecord[]; ignored: IgnoredFile[] } {
  const state = BATCHES.get(batchId);
  if (!state) throw new SecurityError(404, `Unknown import batch "${batchId}". Start a new import.`);
  return state;
}

export function beginBatch(gameId: string): string {
  const batchId = newBatchId();
  BATCHES.set(batchId, { gameId, files: [], ignored: [] });
  ensureDir(batchDir(gameId, batchId));
  return batchId;
}

export interface StageFileInput {
  readonly batchId: string;
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly relativePath?: string;
  readonly hints?: ClientAnalysisHints;
}

/**
 * Stages one file.
 *
 * A ZIP is expanded here rather than by the caller, so ZIP intake and folder
 * intake converge on the same per-entry path and get the same limits, the
 * same analysis and the same "ignored, and here is why" reporting.
 */
export function stageFile(input: StageFileInput): { readonly staged: number; readonly ignored: number } {
  const state = batchState(input.batchId);
  if (input.bytes.byteLength > LIMITS.singleUploadBytes) {
    throw new SecurityError(413, `"${input.fileName}" is ${input.bytes.byteLength} bytes, over the ${LIMITS.singleUploadBytes}-byte per-file limit.`);
  }

  if (looksLikeZip(input.bytes)) {
    let staged = 0;
    let ignored = 0;
    const zip = readZip(input.bytes);
    for (const skipped of zip.skipped) {
      state.ignored.push({ displayName: skipped.name, reason: skipped.reason });
      ignored += 1;
    }
    for (const entry of zip.entries) {
      const result = stageOne(state, input.batchId, entry.bytes, entry.name, entry.name, undefined);
      if (result) staged += 1;
      else ignored += 1;
    }
    return { staged, ignored };
  }

  const result = stageOne(state, input.batchId, input.bytes, input.fileName, input.relativePath ?? input.fileName, input.hints);
  return { staged: result ? 1 : 0, ignored: result ? 0 : 1 };
}

/**
 * Stages a downloaded asset pack ZIP.
 *
 * Same per-entry path as `stageFile`'s ZIP branch, but with the batch-sized
 * cap (a pack is legitimately larger than one upload) and an explicit,
 * counted refusal of SVG entries: Kenney-style packs carry a `Vector/` folder
 * of SVGs beside the PNGs, and this workflow only ever uses the PNGs
 * (architectural law 12). `svgSkipped` lets the caller tell "this pack had no
 * usable raster art" from "this pack was fine".
 */
export function stagePack(
  batchId: string,
  zipBytes: Uint8Array,
  packName: string,
): { readonly staged: number; readonly ignored: number; readonly svgSkipped: number } {
  const state = batchState(batchId);
  if (zipBytes.byteLength > LIMITS.batchUploadBytes) {
    throw new SecurityError(413, `"${packName}" is ${zipBytes.byteLength} bytes, over the ${LIMITS.batchUploadBytes}-byte pack limit.`);
  }
  if (!looksLikeZip(zipBytes)) throw new SecurityError(415, `"${packName}" is not a ZIP archive.`);

  const zip = readZip(zipBytes);
  let staged = 0;
  let ignored = 0;
  let svgSkipped = 0;

  for (const skipped of zip.skipped) {
    state.ignored.push({ displayName: skipped.name, reason: skipped.reason });
    ignored += 1;
  }
  for (const entry of zip.entries) {
    if (/\.svgz?$/i.test(entry.name)) {
      state.ignored.push({ displayName: entry.name, reason: 'SVG is not used as a sprite source; the pack’s PNG version is used instead.' });
      ignored += 1;
      svgSkipped += 1;
      continue;
    }
    const result = stageOne(state, batchId, entry.bytes, entry.name, entry.name, undefined);
    if (result) staged += 1;
    else {
      ignored += 1;
      // A `.png`-named entry that is actually SVG text still counts as an SVG skip.
      if (isSvgBytes(entry.bytes)) svgSkipped += 1;
    }
  }
  return { staged, ignored, svgSkipped };
}

function isSvgBytes(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 200)).trimStart().toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg');
}

function stageOne(
  state: { gameId: string; files: StagedRecord[]; ignored: IgnoredFile[] },
  batchId: string,
  bytes: Uint8Array,
  fileName: string,
  relativePath: string,
  hints: ClientAnalysisHints | undefined,
): StagedRecord | null {
  const displayName = normalizeFileName(fileName);
  let analysis: ImageAnalysis;
  try {
    analysis = analyseBytes(bytes, hints);
  } catch (error) {
    state.ignored.push({ displayName, reason: error instanceof Error ? error.message : String(error) });
    return null;
  }
  if (!isSupportedImageMime(analysis.mime)) {
    state.ignored.push({
      displayName,
      reason:
        analysis.mime === 'image/gif'
          ? 'GIF is not supported yet - export the frames as PNG, or a single PNG sprite sheet.'
          : `${analysis.mime} is not a supported image type (PNG, JPEG and WebP are).`,
    });
    return null;
  }

  const stagingId = randomUUID();
  const dir = batchDir(state.gameId, batchId);
  ensureDir(dir);
  const storedPath = resolveContained(dir, `${stagingId}.bin`);
  writeFileSync(storedPath, bytes);

  const record: StagedRecord = {
    stagingId,
    displayName,
    sourceRelativePath: normalizeRelativePath(relativePath),
    analysis,
    storedPath,
  };
  state.files.push(record);
  return record;
}

/**
 * Builds the plan the user reviews before anything is committed.
 *
 * Duplicates are detected by content hash, never by name: two files called
 * `hero.png` from different folders are two assets, and the same bytes under
 * two names is one. Grouping and role suggestions are hints derived from
 * names and are always presented as such.
 */
export function buildPlan(gameId: string, batchId: string): ImportPlan {
  const state = batchState(batchId);
  const existing = loadAssets(gameId);
  const warnings: string[] = [];

  const seenHashes = new Map<string, string>();
  for (const asset of existing.assets) seenHashes.set(asset.sha256, `already in this project as "${asset.displayName}"`);

  const groups = groupByName(state.files.map((file) => ({ ref: file.stagingId, relativePath: file.sourceRelativePath })));
  const groupOf = new Map<string, string>();
  for (const group of groups) for (const member of group.members) groupOf.set(member.ref, group.name);

  const files: StagedFile[] = state.files.map((file) => {
    const duplicateOf = seenHashes.get(file.analysis.sha256);
    if (!duplicateOf) seenHashes.set(file.analysis.sha256, `earlier in this import as "${file.displayName}"`);
    const parsed = parseName(file.sourceRelativePath);
    const group = groupOf.get(file.stagingId);
    return {
      stagingId: file.stagingId,
      displayName: file.displayName,
      sourceRelativePath: file.sourceRelativePath,
      analysis: file.analysis,
      ...(duplicateOf !== undefined ? { duplicateOf } : {}),
      ...(group !== undefined ? { group } : {}),
      ...(parsed.frameIndex !== undefined ? { frameIndex: parsed.frameIndex } : {}),
      suggestedRoles: suggestRoles(file),
    };
  });

  const duplicates = files.filter((file) => file.duplicateOf !== undefined).length;
  if (duplicates > 0) warnings.push(`${duplicates} file(s) duplicate content already present. They are unticked by default; tick one to import it anyway.`);
  if (state.ignored.length > 0) warnings.push(`${state.ignored.length} file(s) could not be imported - see the ignored list for each reason.`);
  const large = files.filter((file) => file.analysis.width * file.analysis.height > 4096 * 4096).length;
  if (large > 0) warnings.push(`${large} very large image(s) will be scaled for preview; derive a smaller version before assigning one to a role.`);

  return {
    batchId,
    files,
    ignored: [...state.ignored],
    groups: groups.map((group) => ({ name: group.name, stagingIds: group.members.map((member) => member.ref) })),
    warnings,
  };
}

/**
 * Role suggestions, in confidence order: what the filename says first, then
 * what the image's own shape implies. Shape alone is weak evidence, so it
 * only ever contributes when the name said nothing.
 */
function suggestRoles(file: StagedRecord): readonly WorkbenchAssetRole[] {
  const fromName = roleHintsFromName(file.sourceRelativePath).filter((role): role is WorkbenchAssetRole =>
    (WORKBENCH_ASSET_ROLES as readonly string[]).includes(role),
  );
  if (fromName.length > 0) return fromName;

  const { width, hasAlpha: transparent, aspectRatio } = file.analysis;
  const suggestions: WorkbenchAssetRole[] = [];
  // A big, wide, fully opaque image is almost always scenery.
  if (!transparent && width >= 640 && aspectRatio >= 1.2) suggestions.push('background');
  // A cut-out taller than it is wide reads as a character.
  else if (transparent && aspectRatio <= 1.1) suggestions.push('player');
  else if (transparent) suggestions.push('pickup');
  if (suggestions.length === 0) suggestions.push('background');
  return suggestions;
}

export interface CommitSelection {
  readonly stagingId: string;
  readonly role?: WorkbenchAssetRole | null;
  readonly displayName?: string;
}

export interface CommitInput {
  readonly gameId: string;
  readonly batchId: string;
  readonly selections: readonly CommitSelection[];
  readonly provenance: Provenance;
}

export interface CommitResult {
  readonly batch: ImportBatch;
  readonly assetIds: readonly string[];
  readonly roleAssignments: readonly { readonly assetId: string; readonly role: WorkbenchAssetRole }[];
}

/**
 * The import transaction.
 *
 * Every selected file is read back from staging, stored as an immutable
 * source asset, and given its group/folder metadata. The staging directory is
 * removed afterwards: it is a cache, and keeping it would be a second copy of
 * the user's art with no owner.
 */
export function commitImport(input: CommitInput): CommitResult {
  const state = batchState(input.batchId);
  if (state.gameId !== input.gameId) throw new SecurityError(400, 'That import batch belongs to a different project.');

  const byStagingId = new Map(state.files.map((file) => [file.stagingId, file]));
  const assetIds: string[] = [];
  const roleAssignments: { assetId: string; role: WorkbenchAssetRole }[] = [];

  for (const selection of input.selections) {
    const staged = byStagingId.get(selection.stagingId);
    if (!staged) throw new SecurityError(404, `Import batch has no staged file "${selection.stagingId}".`);
    if (!existsSync(staged.storedPath)) throw new SecurityError(410, `Staged file "${staged.displayName}" is no longer available; re-import it.`);

    const bytes = new Uint8Array(readFileSync(staged.storedPath));
    const parsed = parseName(staged.sourceRelativePath);
    const group = state.files.length > 1 ? groupNameFor(state, staged.stagingId) : undefined;
    const folder = folderOf(staged.sourceRelativePath);

    const { record } = storeSource({
      gameId: input.gameId,
      bytes,
      displayName: selection.displayName ?? staged.displayName,
      sourceRelativePath: staged.sourceRelativePath,
      provenance: input.provenance,
      ...(group !== undefined ? { group } : {}),
      ...(parsed.frameIndex !== undefined ? { frameIndex: parsed.frameIndex } : {}),
      ...(folder !== undefined ? { folder } : {}),
    });
    assetIds.push(record.id);
    if (selection.role) roleAssignments.push({ assetId: record.id, role: selection.role });
  }

  const batch: ImportBatch = { batchId: input.batchId, assetIds, ignoredCount: state.ignored.length };
  appendImportBatch(input.gameId, batch);
  discardBatch(input.gameId, input.batchId);
  return { batch, assetIds, roleAssignments };
}

function groupNameFor(state: { files: StagedRecord[] }, stagingId: string): string | undefined {
  const groups = groupByName(state.files.map((file) => ({ ref: file.stagingId, relativePath: file.sourceRelativePath })));
  for (const group of groups) if (group.members.some((member) => member.ref === stagingId)) return group.name;
  return undefined;
}

/**
 * Reads one staged file's bytes for the audition surface.
 *
 * Pre-commit bytes have no asset id yet, so they cannot go through
 * `/assets/bytes`. This is the only pre-commit read path and it is as narrow:
 * the staging id must be a UUID that this batch actually holds, and the file
 * must still be on disk under that batch's directory.
 */
export function readStagedBytes(
  gameId: string,
  batchId: string,
  stagingId: string,
): { readonly bytes: Uint8Array; readonly mime: string; readonly width: number; readonly height: number } {
  const state = batchState(batchId);
  if (state.gameId !== gameId) throw new SecurityError(400, 'That import batch belongs to a different project.');
  if (!/^[a-f0-9-]{36}$/.test(stagingId)) throw new SecurityError(400, `Invalid staging id ${JSON.stringify(stagingId)}.`);
  const record = state.files.find((file) => file.stagingId === stagingId);
  if (!record) throw new SecurityError(404, `Import batch has no staged file "${stagingId}".`);
  if (!existsSync(record.storedPath)) throw new SecurityError(410, `Staged file "${record.displayName}" is no longer available; re-acquire it.`);
  return {
    bytes: new Uint8Array(readFileSync(record.storedPath)),
    mime: record.analysis.mime,
    width: record.analysis.width,
    height: record.analysis.height,
  };
}

/** Removes a batch's staged bytes and its in-memory index. Safe to call twice. */
export function discardBatch(gameId: string, batchId: string): void {
  BATCHES.delete(batchId);
  const dir = batchDir(gameId, batchId);
  rmSync(dir, { recursive: true, force: true });
}

/** Clears every staging directory for a project. Called when a project is opened - stale staging from a previous session is never useful. */
export function clearStaging(gameId: string): void {
  for (const [batchId, state] of BATCHES) if (state.gameId === gameId) BATCHES.delete(batchId);
  const root = stagingRoot(gameId);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
}
