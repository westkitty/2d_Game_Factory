import type { Disposable, EventBus, GameEventMap, GameEventName } from '@sw2d/contracts';

type AnyHandler = (payload: never) => void;

/**
 * Typed pub/sub with inspectable handler counts.
 *
 * The counts are not decoration: the restart-leak check reads them to prove that
 * tearing a scene down actually removed its subscriptions.
 */
export class EventBusImpl implements EventBus {
  readonly #handlers = new Map<string, Set<AnyHandler>>();

  on<K extends GameEventName>(name: K, handler: (payload: GameEventMap[K]) => void): Disposable {
    let set = this.#handlers.get(name);
    if (!set) {
      set = new Set();
      this.#handlers.set(name, set);
    }
    const entry = handler as AnyHandler;
    set.add(entry);
    return {
      dispose: () => {
        const live = this.#handlers.get(name);
        if (!live) return;
        live.delete(entry);
        if (live.size === 0) this.#handlers.delete(name);
      },
    };
  }

  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void {
    const set = this.#handlers.get(name);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as (value: GameEventMap[K]) => void)(payload);
      } catch (error) {
        console.error(`[sw2d] event handler for "${name}" threw`, error);
      }
    }
  }

  listenerCounts(): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const [name, set] of this.#handlers) counts[name] = set.size;
    return counts;
  }

  get totalListeners(): number {
    let total = 0;
    for (const set of this.#handlers.values()) total += set.size;
    return total;
  }
}
