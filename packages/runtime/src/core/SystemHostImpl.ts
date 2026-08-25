import type {
  GameContext,
  InstalledSystemPack,
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
  #installed: InstalledSystemPack[] = [];
  #disposed = false;

  constructor(context: TContext, definitions: readonly SystemPackDefinition<never, TContext>[]) {
    this.#context = context;
    this.#registry = new Map(definitions.map((definition) => [definition.id, definition]));
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
        this.#installed.push(
          definition.install(this.#context, selection.config as never),
        );
      } catch (error) {
        // Roll back everything already installed so a partial install never
        // leaves orphaned listeners behind.
        this.dispose();
        throw new Error(
          `[sw2d] system pack "${selection.packId}" failed to install: ${String(error)}`,
          { cause: error },
        );
      }
    }
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
