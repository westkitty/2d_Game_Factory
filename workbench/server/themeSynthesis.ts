/**
 * Turns workbench asset/role state into a real SW2D theme.
 *
 * Static semantic-role assets remain the load-bearing contract. When the asset
 * assigned to a role belongs to a detected frame group, synthesis may also
 * emit an optional presentation-only local-image animation for that same role.
 * The runtime stays generic and provenance/release governance remains shared.
 */

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import type { AssetDescriptor, RoleAnimationDescriptor, ThemeManifest } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import type { AssetRecord, AssetsDocument, BlueprintDocument, WorkbenchAssetRole } from '../shared/types.ts';
import { provenanceAllowsShipping, provenanceBlocksRelease } from '../shared/types.ts';
import { parseHexColor, toHexColor } from '../shared/image/raster.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { derivedAssetUrl, derivedAssetsDir, ensureDir, gameRoot, resolveContained } from './paths.ts';

function sha256Of(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

const CORE_ROLES: readonly WorkbenchAssetRole[] = ['player', 'enemy', 'platform', 'pickup', 'hazard', 'checkpoint', 'exit'];
const OPTIONAL_ROLES: readonly WorkbenchAssetRole[] = ['background', 'tile', 'particle', 'ui.panel', 'ui.button', 'ui.cursor'];
export const SYNTHESIZABLE_ROLES: readonly WorkbenchAssetRole[] = [...CORE_ROLES, ...OPTIONAL_ROLES];

interface GeneratedShape {
  readonly width: number;
  readonly height: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
}

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
const DEFAULT_FRAME_RATE = 8;

function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHexColor(hex);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  return toHexColor(r + (target - r) * mix, g + (target - g) * mix, b + (target - b) * mix);
}

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

function animationGroupSlug(group: string): string {
  const slug = group.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'frames';
}

function orderedAnimationFrames(
  input: SynthesisInput,
  role: WorkbenchAssetRole,
  anchor: AssetRecord,
  themeId: string,
  skippedReferenceOnly: string[],
): RoleAnimationDescriptor | null {
  if (!anchor.group) return null;

  const shippable = input.assets.assets
    .filter((asset) => asset.group === anchor.group && asset.kind === anchor.kind)
    .filter((asset) => {
      if (provenanceAllowsShipping(asset.provenance)) return true;
      skippedReferenceOnly.push(asset.displayName);
      return false;
    });

  // Name grouping is intentionally tolerant and does not imply identical
  // geometry. For the first animation tranche, preserve a stable Sprite/body
  // footprint: if any shippable sibling disagrees with the assigned anchor's
  // dimensions, keep the role static rather than silently animating mismatched
  // textures whose rendered size can diverge from the existing physics body.
  if (shippable.some((asset) => asset.width !== anchor.width || asset.height !== anchor.height)) return null;

  const frames = shippable.sort((a, b) => {
    const ai = a.frameIndex ?? Number.MAX_SAFE_INTEGER;
    const bi = b.frameIndex ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    const byName = a.displayName.localeCompare(b.displayName);
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });

  if (frames.length < 2) return null;

  return {
    role,
    key: `wb/${themeId}/${role}/animation/${animationGroupSlug(anchor.group)}`,
    frames: frames.map((asset) => {
      const fileName = asset.relativePath.split('/').pop()!;
      return {
        key: `wb/${themeId}/${role}/frame/${asset.sha256.slice(0, 12)}`,
        url: derivedAssetUrl(fileName),
      };
    }),
    frameRate: DEFAULT_FRAME_RATE,
    repeat: -1,
  };
}

function themeImageFileNames(theme: ThemeManifest): Set<string> {
  const files = new Set<string>();
  for (const descriptor of theme.assets) {
    if (descriptor.spec.kind === 'image') files.add(descriptor.spec.url.split('/').pop()!);
  }
  for (const animation of theme.animations ?? []) {
    for (const frame of animation.frames) files.add(frame.url.split('/').pop()!);
  }
  return files;
}

/** Build the theme document without writing to disk. */
export function buildTheme(input: SynthesisInput): SynthesisResult {
  const themeId = input.themeId ?? 'default';
  const byRole = new Map<WorkbenchAssetRole, AssetRecord>();
  const skippedReferenceOnly: string[] = [];

  for (const assignment of input.blueprint.roleAssignments) {
    if (assignment.assetId === null) continue;
    const asset = input.assets.assets.find((candidate) => candidate.id === assignment.assetId);
    if (!asset) continue;
    if (!provenanceAllowsShipping(asset.provenance)) {
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

  const assets: AssetDescriptor[] = roles.map((role) => {
    const asset = byRole.get(role);
    if (asset) {
      imageRoles.push(role);
      const fileName = asset.relativePath.split('/').pop()!;
      return {
        role,
        key: `wb/${themeId}/${role}/${asset.sha256.slice(0, 12)}`,
        spec: { kind: 'image', url: derivedAssetUrl(fileName) },
      };
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

  const animations = roles
    .map((role) => {
      const anchor = byRole.get(role);
      return anchor ? orderedAnimationFrames(input, role, anchor, themeId, skippedReferenceOnly) : null;
    })
    .filter((animation): animation is RoleAnimationDescriptor => animation !== null);

  const tokens = tokensFromPalette(palette);
  const theme: ThemeManifest = {
    schemaVersion: 1,
    id: themeId,
    displayName: input.displayName ?? 'Default',
    assets,
    ...(animations.length > 0 ? { animations } : {}),
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

  return {
    theme,
    imageRoles,
    generatedRoles,
    copiedFiles: [...themeImageFileNames(theme)].sort(),
    skippedReferenceOnly: [...new Set(skippedReferenceOnly)].sort(),
  };
}

/** Validate/write the theme and copy every referenced local image into public/. */
export function writeTheme(input: SynthesisInput): SynthesisResult {
  const result = buildTheme(input);
  const themeId = input.themeId ?? 'default';

  validateDocumentOrThrow<ThemeManifest>(
    'theme-manifest',
    `games/${input.gameId}/content/themes/${themeId}/theme.json`,
    result.theme,
  );

  const publicDir = derivedAssetsDir(input.gameId);
  ensureDir(publicDir);
  for (const fileName of themeImageFileNames(result.theme)) {
    const destination = resolveContained(publicDir, fileName);
    const asset = input.assets.assets.find((candidate) => candidate.relativePath.endsWith(`/${fileName}`));
    if (!asset) continue;
    if (existsSync(destination) && sha256Of(destination) === asset.sha256) continue;
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

/** Rewrite the release resource manifest from the files the theme really ships. */
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

  const shipped = themeImageFileNames(synthesis.theme);

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
      license: thirdParty ? (provenance.license ?? 'unknown') : 'project-owned',
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
