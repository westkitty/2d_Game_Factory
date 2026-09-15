/**
 * Tests for the undo/redo stack.
 */

import { describe, it, expect } from 'vitest';
import { createUndoRedoStack } from '../shared/undoRedo.ts';

describe('createUndoRedoStack', () => {
  it('starts with the initial state', () => {
    const stack = createUndoRedoStack(0);
    expect(stack.current).toBe(0);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('pushes new states', () => {
    const stack = createUndoRedoStack(0);
    stack.push(1);
    expect(stack.current).toBe(1);
    expect(stack.canUndo).toBe(true);

    stack.push(2);
    expect(stack.current).toBe(2);
    expect(stack.undoCount).toBe(2);
  });

  it('undoes to previous state', () => {
    const stack = createUndoRedoStack(0);
    stack.push(1);
    stack.push(2);

    const result = stack.undo();
    expect(result).toBe(1);
    expect(stack.current).toBe(1);
  });

  it('redoes to next state', () => {
    const stack = createUndoRedoStack(0);
    stack.push(1);
    stack.push(2);
    stack.undo();

    const result = stack.redo();
    expect(result).toBe(2);
    expect(stack.current).toBe(2);
  });

  it('clears redo stack on new push', () => {
    const stack = createUndoRedoStack(0);
    stack.push(1);
    stack.push(2);
    stack.undo();
    expect(stack.canRedo).toBe(true);

    stack.push(3);
    expect(stack.canRedo).toBe(false);
    expect(stack.current).toBe(3);
  });

  it('returns null when nothing to undo', () => {
    const stack = createUndoRedoStack(0);
    expect(stack.undo()).toBe(null);
  });

  it('returns null when nothing to redo', () => {
    const stack = createUndoRedoStack(0);
    expect(stack.redo()).toBe(null);
  });

  it('respects the size limit', () => {
    const stack = createUndoRedoStack(0, 3);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    stack.push(4); // Should evict 0

    expect(stack.undoCount).toBe(3);
    stack.undo();
    stack.undo();
    stack.undo();
    expect(stack.current).toBe(1); // 0 was evicted
  });

  it('clears all history except current', () => {
    const stack = createUndoRedoStack(0);
    stack.push(1);
    stack.push(2);
    stack.push(3);

    stack.clear();
    expect(stack.current).toBe(3);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoCount).toBe(0);
  });

  it('works with complex objects', () => {
    const stack = createUndoRedoStack({ x: 0, y: 0 });
    stack.push({ x: 1, y: 2 });
    stack.push({ x: 3, y: 4 });

    expect(stack.current).toEqual({ x: 3, y: 4 });
    stack.undo();
    expect(stack.current).toEqual({ x: 1, y: 2 });
  });
});
