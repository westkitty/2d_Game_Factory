/**
 * A simple event emitter for the workbench and runtime.
 *
 * Type-safe event system with wildcard support and one-time listeners.
 * Pure TypeScript with no external dependencies.
 */

export type EventHandler<T = unknown> = (data: T) => void;

export interface EventEmitter<Events extends Record<string, unknown>> {
  /** Subscribe to an event. Returns a disposer. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void;

  /** Subscribe to an event, automatically unsubscribe after first invocation. */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void;

  /** Emit an event to all subscribers. */
  emit<K extends keyof Events>(event: K, data: Events[K]): void;

  /** Remove all listeners for a specific event, or all events if no key given. */
  off<K extends keyof Events>(event?: K): void;

  /** Get the number of listeners for an event. */
  listenerCount<K extends keyof Events>(event: K): number;

  /** Wait for an event as a promise. */
  waitFor<K extends keyof Events>(event: K, timeoutMs?: number): Promise<Events[K]>;
}

/**
 * Creates a type-safe event emitter.
 */
export function createEventEmitter<Events extends Record<string, unknown>>(): EventEmitter<Events> {
  const listeners = new Map<keyof Events, Set<EventHandler>>();

  function on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(handler as EventHandler);
    return () => set!.delete(handler as EventHandler);
  }

  function once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrapper = ((data: Events[K]) => {
      dispose();
      handler(data);
    }) as EventHandler<Events[K]>;
    const dispose = on(event, wrapper);
    return dispose;
  }

  function emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Event handler error for "${String(event)}":`, error);
      }
    }
  }

  function off<K extends keyof Events>(event?: K): void {
    if (event !== undefined) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  function listenerCount<K extends keyof Events>(event: K): number {
    return listeners.get(event)?.size ?? 0;
  }

  function waitFor<K extends keyof Events>(event: K, timeoutMs?: number): Promise<Events[K]> {
    return new Promise<Events[K]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const dispose = once(event, (data) => {
        if (timer !== null) clearTimeout(timer);
        resolve(data);
      });
      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          dispose();
          reject(new Error(`Timeout waiting for event "${String(event)}" after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  return { on, once, emit, off, listenerCount, waitFor };
}
