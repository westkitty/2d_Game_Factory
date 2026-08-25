import type { UiCopy } from './ui.ts';

/**
 * Content-loading boundary.
 *
 * The runtime never reads files, fetches URLs or parses game data itself. It
 * consumes a ContentBundle produced by a ContentSource. Phase 1 ships an inline
 * source with procedurally generated placeholder art; Phase 2 replaces it with a
 * schema-validated JSON source without touching runtime internals.
 */

/**
 * Semantic asset roles. The runtime asks for a role; the theme decides what it
 * looks like. Roles are deliberately generic - no game identity in the core.
 */
export const ASSET_ROLES = [
  'player',
  'enemy',
  'pickup',
  'tile',
  'platform',
  'background',
  'particle',
  'ui.panel',
  'ui.button',
  'ui.cursor',
] as const;

export type AssetRole = (typeof ASSET_ROLES)[number];

/**
 * How an asset gets into the texture cache.
 * 'generated' assets are drawn locally at boot and require no files at all,
 * which is what keeps the Phase 1 foundation free of binary art and of any
 * remote asset host.
 */
export type AssetKind = 'generated' | 'image';

export interface GeneratedAssetSpec {
  readonly kind: 'generated';
  readonly width: number;
  readonly height: number;
  /** Palette entries are CSS colour strings resolved by the theme, not the runtime. */
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
}

export interface ImageAssetSpec {
  readonly kind: 'image';
  /** Path relative to the game's own public/ directory. Must be same-origin. */
  readonly url: string;
}

export type AssetSpec = GeneratedAssetSpec | ImageAssetSpec;

export interface AssetDescriptor {
  readonly role: AssetRole;
  /** Texture cache key. Stable across reloads. */
  readonly key: string;
  readonly spec: AssetSpec;
}

/** Resolves a semantic role to a texture key. Missing roles fail loudly, never silently. */
export interface AssetCatalog {
  has(role: AssetRole): boolean;
  /** Throws with the offending role name when unregistered. */
  resolve(role: AssetRole): string;
  list(): readonly AssetDescriptor[];
}

export interface ContentBundle {
  readonly id: string;
  readonly schemaVersion: number;
  readonly assets: readonly AssetDescriptor[];
  /** Overrides for the runtime's neutral UI strings. Presentation lives with the game. */
  readonly ui?: Partial<UiCopy>;
  /**
   * Validated game data keyed by document name ('tuning', 'levels/01-intro', ...).
   * Phase 1 leaves this open; Phase 2 gates every entry through JSON Schema.
   */
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ContentSource {
  readonly id: string;
  load(): Promise<ContentBundle>;
}
