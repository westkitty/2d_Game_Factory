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
  'hazard',
  'checkpoint',
  'exit',
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

/** One same-origin image in an ordered presentation animation. */
export interface AnimationFrameDescriptor {
  readonly key: string;
  /** Path relative to the game's own public/ directory. Must be same-origin. */
  readonly url: string;
}

/**
 * Optional presentation-only animation for one semantic asset role.
 *
 * The role still owns exactly one AssetDescriptor as its static/fallback
 * texture. Animations add ordered local frames without turning AssetCatalog
 * into a multi-winner role registry or leaking animation state into gameplay.
 */
export interface RoleAnimationDescriptor {
  readonly role: AssetRole;
  readonly key: string;
  readonly frames: readonly AnimationFrameDescriptor[];
  /** Frames per second. Defaults to 8 when omitted. */
  readonly frameRate?: number;
  /** Phaser repeat count. -1 means forever; defaults to -1. */
  readonly repeat?: number;
  readonly yoyo?: boolean;
}

/** Resolves a semantic role to a texture key. Missing roles fail loudly, never silently. */
export interface AssetCatalog {
  has(role: AssetRole): boolean;
  /** Throws with the offending role name when unregistered. */
  resolve(role: AssetRole): string;
  list(): readonly AssetDescriptor[];
}

/**
 * One validated content document inside a ContentBundle.
 *
 * `schemaId` names the schema that governed it, `valid` records whether it
 * passed, and `value` is the parsed document - typed by whichever document
 * registry produced the envelope (see @sw2d/schemas). Contracts stays
 * validator-agnostic: it knows the shape of "a validated document", not how
 * validation happens or which schema library performs it.
 */
export interface ContentDocumentEnvelope<T = unknown> {
  readonly schemaId: string;
  readonly valid: boolean;
  readonly value: T;
}

export interface ContentBundle {
  readonly id: string;
  readonly schemaVersion: number;
  readonly assets: readonly AssetDescriptor[];
  /** Optional presentation animations keyed back to semantic roles. */
  readonly animations?: readonly RoleAnimationDescriptor[];
  /** Overrides for the runtime's neutral UI strings. Presentation lives with the game. */
  readonly ui?: Partial<UiCopy>;
  /**
   * Validated game data keyed by document name ('tuning', 'levels/01-intro', ...).
   * Each entry is a ContentDocumentEnvelope produced by a schema-validated
   * ContentSource. The runtime never validates content itself; it only ever
   * sees documents that already carry their validation outcome.
   */
  readonly data: Readonly<Record<string, ContentDocumentEnvelope>>;
}

export interface ContentSource {
  readonly id: string;
  load(): Promise<ContentBundle>;
}
