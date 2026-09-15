/**
 * A generic undo/redo stack.
 *
 * Pure data structure that records state snapshots and allows reverting to
 * previous states. Used by the workbench for asset operations, scene editing,
 * and any other reversible action.
 *
 * Bounded by a configurable limit to prevent unbounded memory growth.
 */

export interface UndoRedoStack<T> {
  /** Get the current state. */
  readonly current: T;

  /** Push a new state onto the stack. Clears the redo stack. */
  push(state: T): void;

  /** Undo to the previous state. Returns the new current state, or null if nothing to undo. */
  undo(): T | null;

  /** Redo to the next state. Returns the new current state, or null if nothing to redo. */
  redo(): T | null;

  /** Check if undo is available. */
  readonly canUndo: boolean;

  /** Check if redo is available. */
  readonly canRedo: boolean;

  /** Get the number of states in the undo stack. */
  readonly undoCount: number;

  /** Get the number of states in the redo stack. */
  readonly redoCount: number;

  /** Clear all history except the current state. */
  clear(): void;
}

/**
 * Creates an undo/redo stack with an optional size limit.
 *
 * @param initial The initial state
 * @param limit Maximum number of undo states (default 50)
 */
export function createUndoRedoStack<T>(initial: T, limit = 50): UndoRedoStack<T> {
  const undoStack: T[] = [initial];
  const redoStack: T[] = [];

  function push(state: T): void {
    undoStack.push(state);
    redoStack.length = 0; // Clear redo on new action

    // Enforce limit
    while (undoStack.length > limit + 1) {
      undoStack.shift();
    }
  }

  function undo(): T | null {
    if (undoStack.length <= 1) return null;
    const current = undoStack.pop()!;
    redoStack.push(current);
    return undoStack[undoStack.length - 1]!;
  }

  function redo(): T | null {
    if (redoStack.length === 0) return null;
    const next = redoStack.pop()!;
    undoStack.push(next);
    return next;
  }

  return {
    get current() {
      return undoStack[undoStack.length - 1]!;
    },
    push,
    undo,
    redo,
    get canUndo() {
      return undoStack.length > 1;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    get undoCount() {
      return undoStack.length - 1;
    },
    get redoCount() {
      return redoStack.length;
    },
    clear() {
      const current = undoStack[undoStack.length - 1]!;
      undoStack.length = 0;
      undoStack.push(current);
      redoStack.length = 0;
    },
  };
}
