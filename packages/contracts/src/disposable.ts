/**
 * Lifecycle primitives.
 *
 * Every reusable system that allocates a listener, timer, physics body, DOM node,
 * audio node or subscription must expose a disposal path. Scene changes and run
 * restarts route through these types, which is what keeps restart from leaking.
 */

export interface Disposable {
  dispose(): void;
}

/** Collects disposables so an owner can tear down everything it created in one call. */
export interface DisposableBag extends Disposable {
  /** Register an existing disposable. Returns it unchanged for convenient chaining. */
  add<T extends Disposable>(disposable: T): T;
  /** Register a teardown function. */
  addFn(teardown: () => void): Disposable;
  /** Number of live registrations. Used by restart-leak diagnostics. */
  readonly size: number;
  /** True once dispose() has run. Adding to a disposed bag disposes immediately. */
  readonly disposed: boolean;
}
