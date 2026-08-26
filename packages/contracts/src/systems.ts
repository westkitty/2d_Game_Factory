import type { Disposable } from './disposable.ts';
import type { GameContext } from './context.ts';

/**
 * A capability is a named service one pack publishes for others to consume.
 * Packs depend on capability ids, never on another pack's module.
 */
export type CapabilityId = string;

/**
 * Service locator with an explicit, inspectable surface.
 *
 * This exists instead of ambient singletons so that (a) dependencies are
 * declared, (b) teardown is verifiable, and (c) the debug snapshot can list
 * exactly what is live.
 */
export interface CapabilityRegistry {
  /** Publish a capability. Disposing the handle withdraws it. Duplicate ids throw. */
  provide<T>(id: CapabilityId, value: T): Disposable;
  get<T>(id: CapabilityId): T | undefined;
  /** Throws a named error when absent. Use in pack install() after dependency checks. */
  require<T>(id: CapabilityId): T;
  has(id: CapabilityId): boolean;
  list(): readonly CapabilityId[];
}

/**
 * A composable capability bundle.
 *
 * TContext is widened by hosts that can offer more than the engine-agnostic
 * GameContext - the Phaser scene host supplies a SceneContext, for example.
 * Packs therefore stay typed without pulling a renderer into this package.
 */
export interface SystemPackDefinition<
  TConfig = unknown,
  TContext extends GameContext = GameContext,
> {
  readonly id: string;
  readonly version: string;
  readonly provides: readonly CapabilityId[];
  readonly dependencies: readonly CapabilityId[];
  readonly optionalDependencies?: readonly CapabilityId[];
  /**
   * Id of the JSON Schema that validates `config`.
   * Declared here in Phase 1; enforced by the validator introduced in Phase 2.
   */
  readonly configSchemaId?: string;
  /**
   * Where this pack's `config` legitimately comes from.
   *
   * `'json'` (the default) means the config is plain data: a game definition's
   * `systemPacks[].config` can carry it, a `configSchemaId` can validate it,
   * and the factory generator can serialize it into `content/game.json`.
   *
   * `'code'` means the config is not expressible as JSON at all - it carries
   * functions or other live values - so it can only be supplied at the
   * composition root, through `createGame`'s `packConfig` map. A
   * code-configured pack never has a `configSchemaId` (there is nothing a JSON
   * Schema could validate), and `SystemHostImpl` refuses to install one whose
   * config did not come from code rather than letting the pack itself throw a
   * `TypeError` on a missing function. Declaring this is what stops the
   * generator from serializing a `config: {}` that can never work.
   */
  readonly configSource?: 'json' | 'code';
  install(context: TContext, config: TConfig): InstalledSystemPack;
}

export interface InstalledSystemPack extends Disposable {
  readonly id: string;
  /** Optional per-frame step. The host calls this; packs never own the game loop. */
  update?(deltaMs: number): void;
}

/** A pack chosen by a game definition or preset, with its configuration. */
export interface SystemPackSelection {
  readonly packId: string;
  readonly config?: unknown;
}

/**
 * Validates a system pack's config against the schema its definition names
 * via `configSchemaId`.
 *
 * `@sw2d/runtime` depends on this interface only, never on a concrete schema
 * library - `@sw2d/schemas` (or any other validator) supplies an
 * implementation at the composition boundary, where `SystemHostImpl` is
 * constructed. Contracts stays validator-agnostic, the same split used for
 * `ContentSource`/`ContentDocumentEnvelope`.
 */
export interface PackConfigValidator {
  /**
   * Validate `config` for `packId` against `configSchemaId`. Returns the
   * config to install with (typically unchanged) or throws with a located,
   * readable error describing what is wrong.
   */
  validate(configSchemaId: string, packId: string, config: unknown): unknown;
}

/**
 * Installs a selection of packs in dependency order and tears them down in
 * reverse. One host instance per scene lifetime; disposing it is what makes
 * restart clean.
 */
export interface SystemHost extends Disposable {
  install(selections: readonly SystemPackSelection[]): void;
  update(deltaMs: number): void;
  readonly installed: readonly InstalledSystemPack[];
}
