/**
 * The workbench's own vocabulary.
 *
 * Deliberately independent of any DOM or Node API so the same definitions are
 * used by the browser UI, the local host and the unit tests. Anything the
 * *runtime* consumes (AssetDescriptor, ThemeManifest, NormalizedLevel, ...)
 * comes from @sw2d/contracts instead - the workbench never redefines a
 * runtime shape (principle P08).
 */

/** The runtime's semantic asset roles, mirrored as a value list for UI iteration. */
export const WORKBENCH_ASSET_ROLES = [
  'player',
  'enemy',
  'pickup',
  'tile',
  'platform',
  'background',
  'particle',
  'hazard',
  'checkpoint',
  'exit',
  'ui.panel',
  'ui.button',
  'ui.cursor',
] as const;

export type WorkbenchAssetRole = (typeof WORKBENCH_ASSET_ROLES)[number];

/** Human-facing labels. The UI never shows a raw role id without one of these beside it. */
export const ROLE_LABELS: Readonly<Record<WorkbenchAssetRole, string>> = {
  player: 'Player',
  enemy: 'Enemy',
  pickup: 'Pickup',
  tile: 'Tile',
  platform: 'Platform',
  background: 'Background',
  particle: 'Particle',
  hazard: 'Hazard',
  checkpoint: 'Checkpoint',
  exit: 'Exit',
  'ui.panel': 'UI panel',
  'ui.button': 'UI button',
  'ui.cursor': 'UI cursor',
};

// ---------------------------------------------------------------------------
// Provenance (section 29)
// ---------------------------------------------------------------------------

/**
 * What the user asserted about where an asset came from. Never inferred from
 * the image itself - copyright is not something a decoder can read.
 */
export type ProvenanceKind =
  | 'project-owned'
  | 'generated'
  | 'third-party-known'
  | 'unknown'
  | 'reference-only';

export interface Provenance {
  readonly kind: ProvenanceKind;
  /** Third-party only: where it came from. */
  readonly originalSource?: string;
  /** Third-party only: SPDX id or free text as asserted by the user. */
  readonly license?: string;
  readonly attributionRequired?: boolean;
  /** 'unmodified' for a freshly imported source, 'modified' for a derivative of one, 'generated' for project-generated art. */
  readonly modificationStatus: 'unmodified' | 'modified' | 'generated';
}

/** `reference-only` sources keep their pixels in `.sw2d/` and never reach `public/`. */
export function provenanceAllowsShipping(provenance: Provenance): boolean {
  return provenance.kind !== 'reference-only';
}

/** Anything that must be resolved before `pack` can produce a release candidate. */
export function provenanceBlocksRelease(provenance: Provenance): boolean {
  return provenance.kind === 'unknown';
}

// ---------------------------------------------------------------------------
// Transform recipes (principle P03)
// ---------------------------------------------------------------------------

export interface RectSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type TransformStep =
  | { readonly op: 'crop'; readonly rect: RectSpec }
  | { readonly op: 'trimAlpha'; readonly threshold: number }
  | { readonly op: 'scale'; readonly width: number; readonly height: number; readonly mode: 'nearest' | 'smooth' }
  | { readonly op: 'flip'; readonly axis: 'horizontal' | 'vertical' }
  | { readonly op: 'rotate'; readonly quarterTurns: number }
  | {
      readonly op: 'removeBackground';
      readonly sampleX: number;
      readonly sampleY: number;
      readonly tolerance: number;
      readonly edgeConnected: boolean;
    }
  | { readonly op: 'maskStroke'; readonly mode: 'erase' | 'restore'; readonly points: readonly (readonly [number, number])[]; readonly radius: number }
  | { readonly op: 'invertMask' }
  | { readonly op: 'growAlpha'; readonly pixels: number }
  | { readonly op: 'shrinkAlpha'; readonly pixels: number }
  | { readonly op: 'featherAlpha'; readonly radius: number }
  | { readonly op: 'component'; readonly index: number; readonly alphaThreshold: number }
  | { readonly op: 'gridCell'; readonly columns: number; readonly rows: number; readonly cell: number }
  | { readonly op: 'alignFrame'; readonly anchor: 'center' | 'bottom-center'; readonly alphaThreshold: number }
  | { readonly op: 'outline'; readonly color: string; readonly thickness: number }
  | { readonly op: 'dropShadow'; readonly offsetX: number; readonly offsetY: number; readonly color: string; readonly blur: number }
  | { readonly op: 'silhouette'; readonly color: string }
  | { readonly op: 'tint'; readonly color: string; readonly amount: number }
  | { readonly op: 'desaturate'; readonly amount: number }
  | { readonly op: 'damageFlash'; readonly color: string; readonly amount: number };

export interface TransformRecipe {
  readonly version: 1;
  readonly steps: readonly TransformStep[];
}

export const EMPTY_RECIPE: TransformRecipe = { version: 1, steps: [] };

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export type AssetKindTag = 'source' | 'derived';

export interface AssetValidationCheck {
  readonly id: 'format' | 'dimensions' | 'visible-pixels' | 'source-lineage' | 'recipe';
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

/** A recorded, host-verified fitness report for a derived gameplay sprite. */
export interface AssetValidation {
  readonly purpose: 'sprite';
  readonly status: 'valid' | 'invalid';
  /** Hash of the supplied source bytes this report was checked against. */
  readonly sourceSha256: string;
  readonly checks: readonly AssetValidationCheck[];
}

export interface AssetRecord {
  /** `src_<16 hex>` / `der_<16 hex>`. Stable for the life of the project - never a path (P02). */
  readonly id: string;
  readonly kind: AssetKindTag;
  readonly displayName: string;
  /** Project-relative. Never an absolute machine path (section 12). */
  readonly relativePath: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  readonly sourceAssetId?: string;
  readonly transformRecipe?: TransformRecipe;
  readonly roleAssignments: readonly WorkbenchAssetRole[];
  readonly palette?: readonly string[];
  readonly provenance: Provenance;
  /** Present when the host has checked this derivative as a gameplay sprite. */
  readonly validation?: AssetValidation;
  /** True when the source changed and this derivative has not been rebuilt (P04). */
  readonly stale?: boolean;
  /** Naming-tolerant animation/frame group hint (P07). Never load-bearing. */
  readonly group?: string;
  /** Frame ordinal within `group`, when one could be read from the name. */
  readonly frameIndex?: number;
  /** Folder-ish label for library grouping, derived from the imported relative path. */
  readonly folder?: string;
}

export interface AssetsDocument {
  readonly version: 1;
  readonly assets: readonly AssetRecord[];
}

// ---------------------------------------------------------------------------
// Import staging (principle P05)
// ---------------------------------------------------------------------------

export type SingleImageMode = 'direct' | 'extract' | 'spritesheet' | 'reference' | 'unsure';

export interface ImageAnalysis {
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  readonly hasAlpha: boolean;
  /** Visible (alpha > threshold) bounding box, or null when fully transparent. */
  readonly alphaBounds: RectSpec | null;
  readonly palette: readonly string[];
  readonly aspectRatio: number;
  readonly pixelArtLikely: boolean;
  /** Grid divisions the dimensions strongly imply. Suggestions, never a decision. */
  readonly gridSuggestions: readonly { readonly columns: number; readonly rows: number; readonly frameWidth: number; readonly frameHeight: number }[];
}

export interface StagedFile {
  readonly stagingId: string;
  readonly displayName: string;
  /** As supplied by the picker/drop, used only for grouping and folder hints. */
  readonly sourceRelativePath: string;
  readonly analysis: ImageAnalysis;
  /** Set when this file duplicates another staged file or an asset already in the project. */
  readonly duplicateOf?: string;
  readonly group?: string;
  readonly frameIndex?: number;
  readonly suggestedRoles: readonly WorkbenchAssetRole[];
}

export interface IgnoredFile {
  readonly displayName: string;
  readonly reason: string;
}

export interface ImportPlan {
  readonly batchId: string;
  readonly files: readonly StagedFile[];
  readonly ignored: readonly IgnoredFile[];
  readonly groups: readonly { readonly name: string; readonly stagingIds: readonly string[] }[];
  readonly warnings: readonly string[];
}

export interface ImportBatch {
  readonly batchId: string;
  readonly assetIds: readonly string[];
  readonly ignoredCount: number;
}

export interface ImportsDocument {
  readonly version: 1;
  readonly batches: readonly ImportBatch[];
}

// ---------------------------------------------------------------------------
// Blueprint: how this project maps assets onto the game
// ---------------------------------------------------------------------------

export type RoleCoverage = 'assigned' | 'auto' | 'suggested' | 'uncovered';

export interface RoleAssignment {
  readonly role: WorkbenchAssetRole;
  /** null means "use generated fallback art derived from the palette". */
  readonly assetId: string | null;
  readonly coverage: RoleCoverage;
}

export interface BlueprintDocument {
  readonly version: 1;
  readonly roleAssignments: readonly RoleAssignment[];
  readonly palette: readonly string[];
  readonly seedId?: string;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface PanelState {
  readonly libraryWidth: number;
  readonly inspectorWidth: number;
  readonly libraryCollapsed: boolean;
  readonly inspectorCollapsed: boolean;
  readonly activityOpen: boolean;
  readonly libraryView: 'grid' | 'list';
  readonly activeWorkspace: 'lab' | 'scene' | 'preview';
}

export const DEFAULT_PANEL_STATE: PanelState = {
  libraryWidth: 260,
  inspectorWidth: 300,
  libraryCollapsed: false,
  inspectorCollapsed: false,
  activityOpen: false,
  libraryView: 'grid',
  activeWorkspace: 'lab',
};

export interface ProjectDocument {
  readonly version: 1;
  readonly gameId: string;
  readonly presetId: string;
  readonly displayName: string;
  readonly starterKitId?: string;
  readonly panels: PanelState;
  /** True when the project pre-existed the workbench and was adopted rather than created by it. */
  readonly adopted?: boolean;
}

export interface ProjectSummary {
  readonly gameId: string;
  readonly presetId: string;
  readonly displayName: string;
  readonly maturity: string;
  readonly hasWorkbenchMetadata: boolean;
  readonly assetCount: number;
  readonly thumbnailAssetId?: string;
  readonly provenanceBlocked: boolean;
  readonly lastBuildState: 'unknown' | 'built' | 'packed';
}

// ---------------------------------------------------------------------------
// Game seeds (section 18)
// ---------------------------------------------------------------------------

export interface GameSeed {
  readonly id: string;
  readonly presetId: string;
  readonly presetDisplayName: string;
  readonly maturity: string;
  readonly starterKitDepth: 'rich-proof-kit' | 'rich-starter-kit' | 'smoke-kit' | 'generated-shell';
  readonly loop: string;
  readonly rolePlan: readonly RoleAssignment[];
  readonly usesAssetIds: readonly string[];
  readonly generatedFallbackRoles: readonly WorkbenchAssetRole[];
  readonly palette: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly assetCoverageScore: number;
}

// ---------------------------------------------------------------------------
// Jobs (section 26)
// ---------------------------------------------------------------------------

export type JobKind =
  | 'import'
  | 'derive-batch'
  | 'reimport'
  | 'create-game'
  | 'validate'
  | 'build'
  | 'pack'
  | 'preview-rebuild';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobLogLine {
  readonly seq: number;
  readonly text: string;
}

export interface JobView {
  readonly id: string;
  readonly kind: JobKind;
  readonly label: string;
  readonly status: JobStatus;
  readonly step: string;
  /** 0..1 when knowable, otherwise null - never a fabricated number. */
  readonly progress: number | null;
  readonly cancellable: boolean;
  readonly log: readonly JobLogLine[];
  readonly result?: unknown;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Preview (section 25)
// ---------------------------------------------------------------------------

export type PreviewMode = 'fast' | 'production';

export interface PreviewState {
  readonly gameId: string;
  readonly mode: PreviewMode;
  readonly url: string;
  /** Monotonic; a stale build with a lower generation may never replace newer state. */
  readonly generation: number;
  readonly status: 'starting' | 'ready' | 'failed' | 'stopped';
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Optional asset generation provider (section 30) - interface only, no provider ships.
// ---------------------------------------------------------------------------

export type AssetGenerationCapability = 'sprite' | 'background' | 'prop' | 'ui' | 'tileset';

export interface AssetGenerationRequest {
  readonly capability: AssetGenerationCapability;
  readonly role: WorkbenchAssetRole;
  readonly prompt: string;
  readonly palette: readonly string[];
  readonly width: number;
  readonly height: number;
}

export interface GeneratedAsset {
  readonly displayName: string;
  readonly mime: string;
  readonly bytesBase64: string;
}

export interface AssetGenerationProvider {
  readonly id: string;
  readonly capabilities: readonly AssetGenerationCapability[];
  available(): Promise<boolean>;
  generate(request: AssetGenerationRequest): Promise<GeneratedAsset[]>;
}
