import type { CapabilityId, CapabilityRegistry, Disposable, EventBus, GameContext, GameEventMap, GameEventName } from '@sw2d/contracts';

/**
 * Small, fully-functional test doubles for the two `GameContext` services
 * every Phase 4 pack actually touches (`events`, `capabilities`).
 *
 * Deliberately reimplemented here rather than imported from `@sw2d/runtime`:
 * `@sw2d/packs` must stay renderer-independent, and these interfaces are
 * small enough that a real, correct local implementation is simpler than
 * threading a runtime devDependency (and the Phaser it pulls in) through a
 * package whose whole point is not depending on a renderer. The
 * cross-package composition proof - the real `SystemHostImpl`,
 * `resolveInstallOrder` and `CapabilityRegistryImpl` installing these same
 * pack definitions - lives in `packages/runtime/test/`, not here.
 */

export class FakeEventBus implements EventBus {
  readonly #handlers = new Map<string, Set<(payload: unknown) => void>>();

  on<K extends GameEventName>(name: K, handler: (payload: GameEventMap[K]) => void): Disposable {
    let set = this.#handlers.get(name);
    if (!set) {
      set = new Set();
      this.#handlers.set(name, set);
    }
    const entry = handler as (payload: unknown) => void;
    set.add(entry);
    return {
      dispose: () => {
        set!.delete(entry);
      },
    };
  }

  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void {
    for (const handler of this.#handlers.get(name) ?? []) handler(payload);
  }

  listenerCounts(): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const [name, set] of this.#handlers) counts[name] = set.size;
    return counts;
  }
}

export class FakeCapabilityRegistry implements CapabilityRegistry {
  readonly #values = new Map<CapabilityId, unknown>();

  provide<T>(id: CapabilityId, value: T): Disposable {
    if (this.#values.has(id)) throw new Error(`Capability "${id}" is already provided.`);
    this.#values.set(id, value);
    return {
      dispose: () => {
        if (this.#values.get(id) === value) this.#values.delete(id);
      },
    };
  }

  get<T>(id: CapabilityId): T | undefined {
    return this.#values.get(id) as T | undefined;
  }

  require<T>(id: CapabilityId): T {
    if (!this.#values.has(id)) {
      throw new Error(`Capability "${id}" is not available. Registered: ${this.list().join(', ') || '(none)'}.`);
    }
    return this.#values.get(id) as T;
  }

  has(id: CapabilityId): boolean {
    return this.#values.has(id);
  }

  list(): readonly CapabilityId[] {
    return [...this.#values.keys()].sort();
  }
}

export interface FakeGameContext extends GameContext {
  readonly events: FakeEventBus;
  readonly capabilities: FakeCapabilityRegistry;
}

/**
 * A `GameContext` with real `events`/`capabilities` and nothing else - every
 * other field is absent. Only Phase 4 packs that touch a field beyond those
 * two would fail against this fake, and none do (by design: packs consume
 * `GameContext`'s event bus and capability registry only).
 */
export function createFakeGameContext(): FakeGameContext {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  return { events, capabilities } as unknown as FakeGameContext;
}
