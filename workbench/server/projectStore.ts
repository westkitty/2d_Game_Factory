/**
 * Project metadata: `.sw2d/project.json`, `blueprint.json`, `imports.json`.
 *
 * All of it lives beside the generated game and none of it is read by the
 * runtime (principle P08). A project whose `.sw2d/` directory is deleted is
 * still a perfectly good SW2D game; it just loses the workbench's memory of
 * how it was assembled, which `adoptProject` can largely rebuild from the
 * native documents.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { getPreset, listPresets } from '@sw2d/presets';
import type { PresetDefinition, ThemeManifest } from '@sw2d/contracts';
import type {
  AssetsDocument,
  BlueprintDocument,
  ImportBatch,
  ImportsDocument,
  PanelState,
  ProjectDocument,
  ProjectSummary,
  RoleAssignment,
  WorkbenchAssetRole,
} from '../shared/types.ts';
import { DEFAULT_PANEL_STATE, provenanceBlocksRelease } from '../shared/types.ts';
import { readJsonVersioned, writeJsonAtomic } from './atomicJson.ts';
import { GAMES_ROOT, gameRoot, resolveContained, sw2dDir } from './paths.ts';
import { loadAssets } from './assetStore.ts';
import { SYNTHESIZABLE_ROLES, readTheme } from './themeSynthesis.ts';
import { SecurityError } from './security.ts';

const EMPTY_BLUEPRINT: BlueprintDocument = { version: 1, roleAssignments: [], palette: [] };
const EMPTY_IMPORTS: ImportsDocument = { version: 1, batches: [] };

function projectPath(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'project.json');
}
function blueprintPath(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'blueprint.json');
}
function importsPath(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'imports.json');
}

export function projectExists(gameId: string): boolean {
  return existsSync(gameRoot(gameId));
}

export function hasWorkbenchMetadata(gameId: string): boolean {
  return existsSync(projectPath(gameId));
}

export function loadProject(gameId: string): ProjectDocument {
  if (!existsSync(projectPath(gameId))) {
    throw new SecurityError(404, `"${gameId}" has no workbench metadata yet. Open it once to adopt it.`);
  }
  return readJsonVersioned<ProjectDocument>(projectPath(gameId), 1, {
    version: 1,
    gameId,
    presetId: 'unknown',
    displayName: gameId,
    panels: DEFAULT_PANEL_STATE,
  });
}

export function saveProject(document: ProjectDocument): void {
  writeJsonAtomic(projectPath(document.gameId), document);
}

export function loadBlueprint(gameId: string): BlueprintDocument {
  return readJsonVersioned<BlueprintDocument>(blueprintPath(gameId), 1, EMPTY_BLUEPRINT);
}

export function saveBlueprint(gameId: string, document: BlueprintDocument): void {
  writeJsonAtomic(blueprintPath(gameId), document);
}

export function loadImports(gameId: string): ImportsDocument {
  return readJsonVersioned<ImportsDocument>(importsPath(gameId), 1, EMPTY_IMPORTS);
}

export function appendImportBatch(gameId: string, batch: ImportBatch): ImportsDocument {
  const current = loadImports(gameId);
  const next: ImportsDocument = { version: 1, batches: [...current.batches, batch] };
  writeJsonAtomic(importsPath(gameId), next);
  return next;
}

export function savePanels(gameId: string, panels: PanelState): ProjectDocument {
  const project = loadProject(gameId);
  const next: ProjectDocument = { ...project, panels: { ...project.panels, ...panels } };
  saveProject(next);
  return next;
}

/**
 * Recomputes role coverage from the asset records themselves.
 *
 * Coverage is derived, never stored as a second source of truth: an asset's
 * `roleAssignments` is authoritative, so a badge can never disagree with what
 * the theme will actually be built from (the "a thumbnail badge that does not
 * change the game is not implementation" rule, section 23).
 */
export function deriveRoleAssignments(assets: AssetsDocument, roles: readonly WorkbenchAssetRole[] = SYNTHESIZABLE_ROLES): readonly RoleAssignment[] {
  return roles.map((role) => {
    const asset = assets.assets.find((candidate) => candidate.roleAssignments.includes(role));
    if (asset) return { role, assetId: asset.id, coverage: 'assigned' as const };
    return { role, assetId: null, coverage: 'auto' as const };
  });
}

/** The project palette: the union of assigned assets' palettes, then any remaining source palette, deduped in a stable order. */
export function derivePalette(assets: AssetsDocument, maxColors = 6): readonly string[] {
  const seen: string[] = [];
  const push = (colors: readonly string[] | undefined): void => {
    for (const color of colors ?? []) {
      if (seen.length >= maxColors) return;
      if (!seen.includes(color)) seen.push(color);
    }
  };
  for (const asset of assets.assets) if (asset.roleAssignments.length > 0) push(asset.palette);
  for (const asset of assets.assets) push(asset.palette);
  return seen;
}

export function refreshBlueprint(gameId: string): BlueprintDocument {
  const assets = loadAssets(gameId);
  const current = loadBlueprint(gameId);
  const next: BlueprintDocument = {
    version: 1,
    roleAssignments: deriveRoleAssignments(assets),
    palette: derivePalette(assets),
    ...(current.seedId !== undefined ? { seedId: current.seedId } : {}),
  };
  saveBlueprint(gameId, next);
  return next;
}

// ---------------------------------------------------------------------------
// Listing and adoption
// ---------------------------------------------------------------------------

interface GamePackageJson {
  readonly name?: string;
  readonly sw2d?: { readonly presetId?: string };
}

function readGamePackageJson(gameId: string): GamePackageJson | null {
  const filePath = resolveContained(gameRoot(gameId), 'package.json');
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as GamePackageJson;
  } catch {
    return null;
  }
}

function presetOrNull(presetId: string): PresetDefinition | null {
  try {
    return getPreset(presetId);
  } catch {
    return null;
  }
}

export function summarizeProject(gameId: string): ProjectSummary {
  const packageJson = readGamePackageJson(gameId);
  const metadata = hasWorkbenchMetadata(gameId) ? loadProject(gameId) : null;
  const presetId = metadata?.presetId ?? packageJson?.sw2d?.presetId ?? 'unknown';
  const preset = presetOrNull(presetId);
  const assets = hasWorkbenchMetadata(gameId) ? loadAssets(gameId) : { version: 1 as const, assets: [] };
  const thumbnail = assets.assets.find((asset) => asset.roleAssignments.includes('player')) ?? assets.assets[0];

  const root = gameRoot(gameId);
  const packed = existsSync(resolveContained(root, 'pack', 'RELEASE_MANIFEST.json'));
  const built = existsSync(resolveContained(root, 'dist', 'index.html'));

  return {
    gameId,
    presetId,
    displayName: metadata?.displayName ?? gameId,
    maturity: preset?.maturity ?? 'unknown',
    hasWorkbenchMetadata: metadata !== null,
    assetCount: assets.assets.length,
    ...(thumbnail ? { thumbnailAssetId: thumbnail.id } : {}),
    provenanceBlocked: assets.assets.some((asset) => provenanceBlocksRelease(asset.provenance)),
    lastBuildState: packed ? 'packed' : built ? 'built' : 'unknown',
  };
}

/** Every directory under `games/` that looks like a generated SW2D game. Ignores anything without a package.json. */
export function listProjects(): readonly ProjectSummary[] {
  if (!existsSync(GAMES_ROOT)) return [];
  const summaries: ProjectSummary[] = [];
  for (const entry of readdirSync(GAMES_ROOT)) {
    if (entry.startsWith('.')) continue;
    const full = resolveContained(GAMES_ROOT, entry);
    if (!statSync(full).isDirectory()) continue;
    if (!existsSync(resolveContained(full, 'package.json'))) continue;
    try {
      summaries.push(summarizeProject(entry));
    } catch {
      // A project whose metadata is unreadable still deserves to be listed;
      // the user needs to be able to see it in order to fix it.
      summaries.push({
        gameId: entry,
        presetId: 'unknown',
        displayName: entry,
        maturity: 'unknown',
        hasWorkbenchMetadata: false,
        assetCount: 0,
        provenanceBlocked: false,
        lastBuildState: 'unknown',
      });
    }
  }
  return summaries.sort((a, b) => a.gameId.localeCompare(b.gameId));
}

/**
 * Rebuilds workbench metadata for a project that predates it, non-destructively.
 *
 * Reads what the native documents already say - the preset from
 * `package.json`, the palette from the existing theme's generated fills - and
 * writes only into `.sw2d/`. No game file is touched, so adopting a project
 * cannot break it (section 28).
 */
export function adoptProject(gameId: string): ProjectDocument {
  if (!projectExists(gameId)) throw new SecurityError(404, `No project "${gameId}" under games/.`);
  if (hasWorkbenchMetadata(gameId)) return loadProject(gameId);

  const packageJson = readGamePackageJson(gameId);
  const presetId = packageJson?.sw2d?.presetId ?? 'unknown';
  const theme: ThemeManifest | null = readTheme(gameId);

  const palette: string[] = [];
  for (const descriptor of theme?.assets ?? []) {
    if (descriptor.spec.kind !== 'generated') continue;
    if (!palette.includes(descriptor.spec.fill)) palette.push(descriptor.spec.fill);
  }

  const document: ProjectDocument = {
    version: 1,
    gameId,
    presetId,
    displayName: gameId
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    panels: DEFAULT_PANEL_STATE,
    adopted: true,
  };
  saveProject(document);
  saveBlueprint(gameId, { version: 1, roleAssignments: deriveRoleAssignments(loadAssets(gameId)), palette: palette.slice(0, 6) });
  return document;
}

export interface PresetSummary {
  readonly id: string;
  readonly displayName: string;
  readonly family: string;
  readonly maturity: string;
  readonly controllerFamilies: readonly string[];
  readonly inputModes: readonly string[];
  readonly requiredPackIds: readonly string[];
  readonly requiredContentRoles: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly starterKitDepth: 'rich-proof-kit' | 'smoke-kit' | 'generated-shell';
}

/**
 * Presets, flattened for the browser.
 *
 * `maturity` and `knownLimitations` are passed through verbatim from the
 * catalogue. The workbench never upgrades a `recipe` preset's presentation to
 * look like a proven one - that is failure condition F15, and the honest
 * label is the whole point of the field.
 */
export function listPresetSummaries(starterKitDepth: (presetId: string) => PresetSummary['starterKitDepth']): readonly PresetSummary[] {
  return listPresets().map((preset) => ({
    id: preset.id,
    displayName: preset.displayName,
    family: preset.family,
    maturity: preset.maturity,
    controllerFamilies: preset.controllerFamilies,
    inputModes: preset.supportedInputModes,
    requiredPackIds: preset.requiredSystemPacks.map((selection) => selection.packId),
    requiredContentRoles: preset.requiredContentRoles,
    knownLimitations: preset.knownLimitations,
    starterKitDepth: starterKitDepth(preset.id),
  }));
}
