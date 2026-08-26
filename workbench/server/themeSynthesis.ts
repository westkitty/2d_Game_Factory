/**
 * Turning workbench state into a real SW2D theme.
 *
 * This is the load-bearing join between the product and the machine. The
 * runtime already resolves gameplay art through semantic roles and already
 * knows how to load `{ kind: 'image' }` descriptors (`BootScene` ->
 * `queueImageAssets`). So the workbench's whole contribution to a running
 * game is *data the runtime already consumes*: a `ThemeManifest` where
 * assigned roles point at game-local files and unassigned roles fall back to
 * generated art derived from the imported palette.
 *
 * Nothing here writes a workbench-private format, and nothing in the runtime
 * was changed to make it work (principle P08, acceptance W12/W16).
 */

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import type { AssetDescriptor, ThemeManifest } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import type { AssetRecord, AssetsDocument, BlueprintDocument, WorkbenchAssetRole } from '../shared/types.ts';
import { provenanceAllowsShipping, provenanceBlocksRelease } from '../shared/types.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { derivedAssetUrl, derivedAssetsDir, ensureDir, gameRoot, resolveContained } from './paths.ts';
import { parseHexColor, toHexColor } from '../shared/image/raster.ts';

/** The roles a generated game's default theme has always supplied. Synthesis never emits fewer, so a swapped theme can never leave gameplay without a texture. */
const CORE_ROLES: readonly WorkbenchAssetRole[] = ['player', 'enemy', 'platform', 'pickup', 'hazard', 'checkpoint', 'exit'];

/** Roles a starter kit may additionally resolve. Emitted only when the project has something to put there. */
const OPTIONAL_ROLES: readonly WorkbenchAssetRole[] = ['background', 'tile', 'particle', 'ui.panel', 'ui.button', 'ui.cursor'];

export const SYNTHESIZABLE_ROLES: readonly WorkbenchAssetRole[] = [...CORE_ROLES, ...OPTIONAL_ROLES];

interface GeneratedShape {
  readonly width: number;
  readonly height: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
}

/** The generated-art shape for each role, matching what `generateTheme` in the CLI already produces so a synthesized theme is visually continuous with a plain generated one. */
const SHAPES: Readonly<Record<WorkbenchAssetRole, GeneratedShape>> = {
  player: { width: 28, height: 44, stroke: '#0b0d13', strokeWidth: 2, cornerRadius: 6 },
  enemy: { width: 26, height: 26, stroke: '#3a0010', strokeWidth: 2 },
  platform: { width: 64, height: 16, stroke: '#5a678f', strokeWidth: 1 },
  pickup: { width: 14, height: 14, cornerRadius: 7 },
  hazard: { width: 20, height: 18, stroke: '#7a1f1a', strokeWidth: 1 },
  checkpoint: { width: 20, height: 24, stroke: '#173a5c', strokeWidth: 1 },
  exit: { width: 22, height: 44, stroke: '#3a2159', strokeWidth: 1 },
  background: { width: 64, height: 64 },
  tile: { width: 32, height: 32, stroke: '#5a678f', strokeWidth: 1 },
  particle: { width: 6, height: 6, cornerRadius: 3 },
  'ui.panel': { width: 64, height: 32, stroke: '#384054', strokeWidth: 2, cornerRadius: 4 },
  'ui.button': { width: 48, height: 20, stroke: '#384054', strokeWidth: 2, cornerRadius: 4 },
  'ui.cursor': { width: 12, height: 12, cornerRadius: 2 },
};

const FALLBACK_PALETTE: readonly string[] = ['#65d0a8', '#e05fa0', '#39415a', '#f0c274', '#e0574f', '#4f9ee0', '#b98af0'];

/** Shifts a colour's lightness by `amount` in [-1, 1]. Keeps a one-colour palette from producing seven identical shapes. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHexColor(hex);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  return toHexColor(r + (target - r) * mix, g + (target - g) * mix, b + (target - b) * mix);
}

/**
 * Assigns a distinct colour to each role from whatever palette the project
 * actually has.
 *
 * A palette shorter than the role list is extended by shading rather than by
 * repeating, so a game built from one near-monochrome image still has
 * distinguishable platforms, pickups and hazards - which matters because the
 * player has to read them at a glance.
 */
export function paletteColorsForRoles(palette: readonly string[], roles: readonly WorkbenchAssetRole[]): Record<string, string> {
  const source = palette.length > 0 ? palette : FALLBACK_PALETTE;
  const out: Record<string, string> = {};
  roles.forEach((role, index) => {
    const base = source[index % source.length]!;
    const cycle = Math.floor(index / source.length);
    const amount = cycle === 0 ? 0 : (cycle % 2 === 1 ? 1 : -1) * Math.min(0.6, 0.22 * Math.ceil(cycle / 2));
    out[role] = amount === 0 ? base : shade(base, amount);
  });
  return out;
}

/** Theme tokens derived from the palette. Contrast is forced so UI text stays readable whatever the source image looked like. */
export function tokensFromPalette(palette: readonly string[]): ThemeManifest['tokens'] {
  const source = palette.length > 0 ? palette : FALLBACK_PALETTE;
  const accent = source[0]!;
  return {
    background: shade(source[source.length - 1] ?? accent, -0.78),
    panel: shade(source[source.length - 1] ?? accent, -0.62),
    panelActive: shade(source[source.length - 1] ?? accent, -0.45),
    text: '#e8ecf4',
    accent,
    border: shade(accent, -0.35),
  };
}

export interface SynthesisInput {
  readonly gameId: string;
  readonly assets: AssetsDocument;
  readonly blueprint: BlueprintDocument;
  readonly themeId?: string;
  readonly displayName?: string;
}

export interface SynthesisResult {
  readonly theme: ThemeManifest;
  readonly imageRoles: readonly WorkbenchAssetRole[];
  readonly generatedRoles: readonly WorkbenchAssetRole[];
  readonly copiedFiles: readonly string[];
  readonly skippedReferenceOnly: readonly string[];
}

/**
 * Builds the theme document. Pure apart from reading nothing and writing
 * nothing - `writeTheme` does the disk work, so this half is unit-testable
 * without a project on disk.
 */
export function buildTheme(input: SynthesisInput): SynthesisResult {
  const themeId = input.themeId ?? 'default';
  const byRole = new Map<WorkbenchAssetRole, AssetRecord>();
  const skippedReferenceOnly: string[] = [];

  for (const assignment of input.blueprint.roleAssignments) {
    if (assignment.assetId === null) continue;
    const asset = input.assets.assets.find((candidate) => candidate.id === assignment.assetId);
    if (!asset) continue;
    if (!provenanceAllowsShipping(asset.provenance)) {
      // Reference-only pixels stay in `.sw2d/`. The role falls back to
      // generated art instead of silently shipping the source (section 29).
      skippedReferenceOnly.push(asset.displayName);
      continue;
    }
    byRole.set(assignment.role, asset);
  }

  const palette = input.blueprint.palette.length > 0 ? input.blueprint.palette : FALLBACK_PALETTE;
  const roles: WorkbenchAssetRole[] = [...CORE_ROLES];
  for (const role of OPTIONAL_ROLES) if (byRole.has(role)) roles.push(role);

  const colors = paletteColorsForRoles(palette, roles);
  const imageRoles: WorkbenchAssetRole[] = [];
  const generatedRoles: WorkbenchAssetRole[] = [];
  const copiedFiles: string[] = [];

  const assets: AssetDescriptor[] = roles.map((role) => {
    const asset = byRole.get(role);
    if (asset) {
      imageRoles.push(role);
      const fileName = asset.relativePath.split('/').pop()!;
      copiedFiles.push(fileName);
      // The key embeds the content hash, so swapping the asset for a role
      // produces a *different* texture key. Phaser's texture cache is keyed
      // by string and `queueImageAssets` skips keys that already exist, so a
      // stable-per-role key would make a live swap silently keep the old
      // pixels on a warm cache.
      return { role, key: `wb/${themeId}/${role}/${asset.sha256.slice(0, 12)}`, spec: { kind: 'image', url: derivedAssetUrl(fileName) } };
    }
    generatedRoles.push(role);
    const shape = SHAPES[role];
    return {
      role,
      key: `theme/${themeId}/${role}`,
      spec: {
        kind: 'generated',
        width: shape.width,
        height: shape.height,
        fill: colors[role]!,
        ...(shape.stroke !== undefined ? { stroke: shape.stroke } : {}),
        ...(shape.strokeWidth !== undefined ? { strokeWidth: shape.strokeWidth } : {}),
        ...(shape.cornerRadius !== undefined ? { cornerRadius: shape.cornerRadius } : {}),
      },
    };
  });

  const tokens = tokensFromPalette(palette);
  const theme: ThemeManifest = {
    schemaVersion: 1,
    id: themeId,
    displayName: input.displayName ?? 'Default',
    assets,
    tokens,
    fonts: { ui: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    highContrastTokens: {
      background: '#000000',
      panel: '#000000',
      panelActive: '#1a1a1a',
      text: '#ffffff',
      accent: '#ffe14d',
      border: '#ffffff',
    },
  };

  return { theme, imageRoles, generatedRoles, copiedFiles, skippedReferenceOnly };
}

/**
 * Validates and writes the theme, and makes sure every image it references is
 * actually present in `public/assets/workbench/`.
 *
 * Validation happens before the write, not after: an invalid theme must never
 * reach disk, because the generated game imports it at module load and would
 * fail to boot rather than fail to validate.
 */
export function writeTheme(input: SynthesisInput): SynthesisResult {
  const result = buildTheme(input);
  const themeId = input.themeId ?? 'default';

  validateDocumentOrThrow<ThemeManifest>('theme-manifest', `games/${input.gameId}/content/themes/${themeId}/theme.json`, result.theme);

  const publicDir = derivedAssetsDir(input.gameId);
  ensureDir(publicDir);
  for (const descriptor of result.theme.assets) {
    if (descriptor.spec.kind !== 'image') continue;
    const fileName = descriptor.spec.url.split('/').pop()!;
    const destination = resolveContained(publicDir, fileName);
    if (existsSync(destination)) continue;
    // A source asset assigned straight to a role lives under `.sw2d/`, which
    // is never served. Copy it into the game's own public/ so the descriptor
    // URL is real and same-origin.
    const asset = input.assets.assets.find((candidate) => candidate.relativePath.endsWith(`/${fileName}`));
    if (!asset) continue;
    copyFileSync(resolveContained(gameRoot(input.gameId), asset.relativePath), destination);
  }

  writeJsonAtomic(resolveContained(gameRoot(input.gameId), 'content', 'themes', themeId, 'theme.json'), result.theme);
  writeResourceManifest(input.gameId, input.assets, result);
  return result;
}

interface ResourceRecordShape {
  readonly id: string;
  readonly category: 'visual';
  readonly sourceKind: 'project-owned' | 'third-party';
  readonly originalSource?: string;
  readonly license: string;
  readonly attributionRequired: boolean;
  readonly modificationStatus: 'unmodified' | 'modified' | 'generated';
  readonly localPath: string;
  readonly status: 'approved' | 'pending' | 'rejected';
}

/**
 * Rewrites the game's resource manifest from real provenance.
 *
 * `pack` already refuses to package a game with a non-approved record, and
 * that gate is left exactly as authoritative as it was: an asset the user
 * marked "source/licence unknown" is written as `pending`, which blocks the
 * release. The workbench's job is to record the truth here, not to soften the
 * gate (acceptance W24, failure condition F14).
 */
export function writeResourceManifest(gameId: string, assets: AssetsDocument, synthesis: SynthesisResult): void {
  const records: ResourceRecordShape[] = [];

  for (const role of synthesis.generatedRoles) {
    records.push({
      id: `${gameId}.default.${role}`,
      category: 'visual',
      sourceKind: 'project-owned',
      license: 'project-owned',
      attributionRequired: false,
      modificationStatus: 'generated',
      localPath: 'content/themes/default/theme.json',
      status: 'approved',
    });
  }

  const shipped = new Set(
    synthesis.theme.assets
      .filter((descriptor) => descriptor.spec.kind === 'image')
      .map((descriptor) => (descriptor.spec.kind === 'image' ? descriptor.spec.url.split('/').pop()! : '')),
  );

  for (const asset of assets.assets) {
    const fileName = asset.relativePath.split('/').pop()!;
    if (!shipped.has(fileName)) continue;
    const provenance = asset.provenance;
    const thirdParty = provenance.kind === 'third-party-known';
    records.push({
      id: `${gameId}.asset.${asset.id}`,
      category: 'visual',
      sourceKind: thirdParty ? 'third-party' : 'project-owned',
      ...(thirdParty && provenance.originalSource ? { originalSource: provenance.originalSource } : {}),
      license: thirdParty ? (provenance.license ?? 'unknown') : provenance.kind === 'generated' ? 'project-owned' : 'project-owned',
      attributionRequired: provenance.attributionRequired ?? false,
      modificationStatus: provenance.modificationStatus,
      localPath: `public/${derivedAssetUrl(fileName)}`,
      status: provenanceBlocksRelease(provenance) ? 'pending' : 'approved',
    });
  }

  writeJsonAtomic(resolveContained(gameRoot(gameId), 'resources', 'RESOURCE_MANIFEST.json'), {
    manifestVersion: 1,
    updated: 'workbench-synthesis',
    category: 'visual',
    records,
  });
}

/** Reads the game's current theme, for adopting a project that predates workbench metadata. */
export function readTheme(gameId: string, themeId = 'default'): ThemeManifest | null {
  const filePath = resolveContained(gameRoot(gameId), 'content', 'themes', themeId, 'theme.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8')) as ThemeManifest;
}
