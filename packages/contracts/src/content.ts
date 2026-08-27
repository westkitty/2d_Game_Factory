import type { UiCopy } from './ui.ts';

/**
 * Small, stable interface between content authors and the engine.
 *
 * The runtime resolves textures by semantic role, never by a hard-coded file
 * name. A theme can replace every texture without touching gameplay code.
 */
export type AssetRole =
  | 'player'
  | 'enemy'
  | 'pickup'
  | 'tile'
  | 'platform'
  | 'background'
  | 'particle'
  | 'hazard'
  | 'checkpoint'
  | 'exit'
  | 'ui.panel'
  | 'ui.button'
  | 'ui.cursor';

export interface GeneratedAssetSpec {
  readonly kind: 'generated';
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
}

export interface ImageAssetSpec {
  readonly kind: 'image';
  /** Same-origin URL. Remote asset URLs are deliberately not part of the contract. */
  readonly url: string;
}

export type AssetSpec = GeneratedAssetSpec | ImageAssetSpec;

export interface AssetDescriptor {
  readonly role: AssetRole;
  /** Renderer texture/cache key. Stable within one loaded content bundle. */
  readonly key: string;
  readonly spec: AssetSpec;
}

/**
 * One texture in an animation sequence.
 *
 * The first animation implementation intentionally models the format the
 * workbench already discovers: ordered, same-origin image files. Atlas frame
 * coordinates and authoring-tool metadata remain separate future concerns.
 */
export interface AnimationFrameDescriptor {
  readonly key: string;
  /** Same-origin URL. Remote animation frames are never accepted here. */
  readonly url: string;
}

/**
 * Presentation-only animation attached to a semantic asset role.
 *
 * A role still resolves to one ordinary AssetDescriptor, which remains the
 * static/fallback texture. When an animatable Phaser object is created with
 * that role texture, the runtime may play this sequence automatically.
 */
export interface RoleAnimationDescriptor {
  readonly role: AssetRole;
  /** Phaser animation-manager key. */
  readonly key: string;
  /** Ordered local-image frames; at least two are required by the theme schema. */
  readonly frames: readonly AnimationFrameDescriptor[];
  /** Frames per second. Defaults to 8 when omitted. */
  readonly frameRate?: number;
  /** Phaser repeat count. -1 means loop forever; defaults to -1. */
  readonly repeat?: number;
  readonly yoyo?: boolean;
}

export interface AssetCatalog {
  has(role: AssetRole): boolean;
  resolve(role: AssetRole): string;
  list(): readonly AssetDescriptor[];
}

/**
 * One validated data document available to gameplay by a stable id.
 *
 * `value` is deliberately unknown at this boundary: schemas own its shape,
 * packs own its interpretation, and the runtime only transports it.
 */
export interface ContentDataDocument<T = unknown> {
  readonly id: string;
  readonly schemaVersion: number;
  readonly value: T;
}

/**
 * Everything content may change without changing runtime/system-pack code.
 *
 * `data` is keyed by document id ("tuning", "levels/main", ...), so adding a
 * new content kind does not require widening this interface. Asset animations
 * are optional presentation metadata and therefore preserve old bundles byte-
 * for-behaviour when absent.
 */
export interface ContentBundle {
  readonly id: string;
  readonly schemaVersion: number;
  readonly assets: readonly AssetDescriptor[];
  readonly animations?: readonly RoleAnimationDescriptor[];
  readonly ui?: Partial<UiCopy>;
  readonly data: Readonly<Record<string, ContentDataDocument>>;
}

export interface ContentSource {
  readonly id: string;
  load(): Promise<ContentBundle>;
}
