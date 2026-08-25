import type {
  GameContext,
  InstalledSystemPack,
  PackConfigValidator,
  SystemHost,
  SystemPackDefinition,
  SystemPackSelection,
} from '@sw2d/contracts';
import { resolveInstallOrder } from './resolveInstallOrder.ts';

/**
 * Installs system packs for one scene lifetime and tears them down in reverse.
 *
 * One host per scene: disposing the scene disposes the host, which disposes
 * every pack. That single ownership chain is what makes restart clean without
 * each pack having to defend itself.
 */
export class SystemHostImpl<TContext extends GameContext> implements SystemHost {
  readonly #context: TContext;
  readonly #registry: ReadonlyMap<string, SystemPackDefinition<never, TContext>>;
  readonly #validator: PackConfigValidator | undefined;
  #installed: InstalledSystemPack[] = [];
  #disposed = false;

  /**
   * `validator` is optional and dependency-inverted: this host never imports
   * a schema library itself (`@sw2d/contracts`'s `PackConfigValidator` is
   * just an interface). When omitted, `configSchemaId` stays declared but
   * unenforced, exactly as before this parameter existed - existing callers
   * that construct a host with two arguments are unaffected.
   */
  constructor(
    context: TContext,
    definitions: readonly SystemPackDefinition<never, TContext>[],
    validator?: PackConfigValidator,
  ) {
    this.#context = context;
    this.#registry = new Map(definitions.map((definition) => [definition.id, definition]));
    this.#validator = validator;
  }

  get installed(): readonly InstalledSystemPack[] {
    return this.#installed;
  }

  install(selections: readonly SystemPackSelection[]): void {
    if (this.#disposed) throw new Error('[sw2d] cannot install into a disposed SystemHost');
    const order = resolveInstallOrder(selections, {
      registry: this.#registry,
      preexisting: this.#context.capabilities.list(),
    });

    for (const selection of order) {
      const definition = this.#registry.get(selection.packId)!;
      try {
        const config = this.#validatedConfig(definition, selection.config);
        this.#installed.push(definition.install(this.#context, config as never));
        this.#assertProvidesPublished(definition);
      } catch (error) {
        // Roll back everything already installed so a partial install - or a
        // config that fails validation - never leaves orphaned listeners
        // behind.
        this.dispose();
        throw new Error(
          `[sw2d] system pack "${selection.packId}" failed to install: ${String(error)}`,
          { cause: error },
        );
      }
    }
  }

  /**
   * A pack's `provides` list is what `resolveInstallOrder` trusts when it
   * satisfies another pack's `dependencies`. A pack that declares a
   * capability and never publishes it therefore passes resolution and then
   * fails at the dependent pack's `capabilities.require()` - far from the
   * actual mistake. Checking it here turns declared-but-unpublished into the
   * same install-time, named, rolled-back failure every other composition
   * error already is.
   */
  #assertProvidesPublished(definition: SystemPackDefinition<never, TContext>): void {
    const missing = definition.provides.filter((id) => !this.#context.capabilities.has(id));
    if (missing.length > 0) {
      throw new Error(
        `declared provides ${missing.map((id) => `"${id}"`).join(', ')} but did not publish it through context.capabilities.provide()`,
      );
    }
  }

  /** No-op when the pack declares no schema, or no validator was supplied. */
  #validatedConfig(definition: SystemPackDefinition<never, TContext>, config: unknown): unknown {
    if (!definition.configSchemaId || !this.#validator) return config;
    return this.#validator.validate(definition.configSchemaId, definition.id, config);
  }

  update(deltaMs: number): void {
    for (const pack of this.#installed) pack.update?.(deltaMs);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const pack of [...this.#installed].reverse()) {
      try {
        pack.dispose();
      } catch (error) {
        console.error(`[sw2d] system pack "${pack.id}" failed to dispose`, error);
      }
    }
    this.#installed = [];
  }
}
