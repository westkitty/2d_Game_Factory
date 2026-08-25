import type { Disposable, DisposableBag } from '@sw2d/contracts';

/**
 * Ordered teardown. Disposes in reverse registration order so a resource is
 * always released before whatever it depends on.
 *
 * A failing teardown is reported and skipped rather than aborting the rest of
 * the teardown, because a half-disposed scene is exactly how restart leaks
 * begin.
 */
export class DisposableBagImpl implements DisposableBag {
  readonly #items = new Set<Disposable>();
  #disposed = false;
  readonly #label: string;

  constructor(label = 'bag') {
    this.#label = label;
  }

  get size(): number {
    return this.#items.size;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  add<T extends Disposable>(disposable: T): T {
    if (this.#disposed) {
      disposable.dispose();
      return disposable;
    }
    this.#items.add(disposable);
    return disposable;
  }

  addFn(teardown: () => void): Disposable {
    let done = false;
    const handle: Disposable = {
      dispose: () => {
        if (done) return;
        done = true;
        this.#items.delete(handle);
        teardown();
      },
    };
    return this.add(handle);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const items = [...this.#items].reverse();
    this.#items.clear();
    for (const item of items) {
      try {
        item.dispose();
      } catch (error) {
        console.error(`[sw2d] teardown failed in "${this.#label}"`, error);
      }
    }
  }
}
