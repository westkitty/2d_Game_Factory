/**
 * Tests for the enhanced DOM utilities that can run without a browser
 * environment. DOM-dependent behavior (keyboard dispatch, modal rendering)
 * is covered by the workbench QA suite instead.
 */

import { describe, it, expect } from 'vitest';
import { formatShortcut, registerShortcut } from '../src/dom.ts';

describe('formatShortcut', () => {
  it('formats a plain key in uppercase', () => {
    expect(formatShortcut('n')).toBe('N');
  });

  it('formats ctrl+key', () => {
    expect(formatShortcut('n', true)).toBe('Ctrl+N');
  });

  it('formats ctrl+shift+key', () => {
    expect(formatShortcut('n', true, true)).toBe('Ctrl+Shift+N');
  });

  it('formats all modifiers in order', () => {
    expect(formatShortcut('n', true, true, true)).toBe('Ctrl+Shift+Alt+N');
  });

  it('formats shift-only', () => {
    expect(formatShortcut('?', false, true)).toBe('Shift+?');
  });

  it('formats alt-only', () => {
    expect(formatShortcut('1', false, false, true)).toBe('Alt+1');
  });
});

describe('registerShortcut', () => {
  it('returns a disposer function', () => {
    const dispose = registerShortcut({ key: 'x', description: 'test action', action: () => undefined });
    expect(typeof dispose).toBe('function');
    dispose();
  });

  it('disposer is idempotent', () => {
    const dispose = registerShortcut({ key: 'y', description: 'test action', action: () => undefined });
    dispose();
    // Calling again should not throw
    dispose();
  });

  it('accepts all optional modifier flags', () => {
    const dispose = registerShortcut({
      key: 'b',
      ctrl: true,
      shift: true,
      alt: true,
      description: 'Build project',
      action: () => undefined,
      group: 'Workspace',
    });
    expect(typeof dispose).toBe('function');
    dispose();
  });
});
