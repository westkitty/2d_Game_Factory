import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_COPY } from '@sw2d/contracts';
import { describeKeys, humanizeKeyCode, startPromptFor } from '../src/input/keyLabels.ts';
import { DEFAULT_BINDINGS } from '../src/input/defaultBindings.ts';

describe('humanizeKeyCode', () => {
  it('maps common codes to short player-facing labels', () => {
    expect(humanizeKeyCode('Enter')).toBe('Enter');
    expect(humanizeKeyCode('NumpadEnter')).toBe('Enter');
    expect(humanizeKeyCode('Space')).toBe('Space');
    expect(humanizeKeyCode('KeyX')).toBe('X');
    expect(humanizeKeyCode('KeyA')).toBe('A');
    expect(humanizeKeyCode('Digit1')).toBe('1');
    expect(humanizeKeyCode('Numpad4')).toBe('Numpad 4');
    expect(humanizeKeyCode('Escape')).toBe('Esc');
  });

  it('passes through anything it has no rule for', () => {
    expect(humanizeKeyCode('F5')).toBe('F5');
  });
});

describe('describeKeys', () => {
  it('dedupes labels and caps the count', () => {
    expect(describeKeys(['Enter', 'Space', 'NumpadEnter'])).toBe('Enter or Space');
  });

  it('handles a single key and an empty list', () => {
    expect(describeKeys(['KeyX'])).toBe('X');
    expect(describeKeys([])).toBe('');
  });

  it('joins three with commas and "or"', () => {
    expect(describeKeys(['Enter', 'Space', 'KeyJ'], 3)).toBe('Enter, Space or J');
  });
});

describe('startPromptFor', () => {
  it('never emits the semantic word CONFIRM as player instruction', () => {
    const prompt = startPromptFor(DEFAULT_BINDINGS.CONFIRM?.keyboard, undefined, DEFAULT_UI_COPY.startPrompt);
    expect(prompt).not.toContain('CONFIRM');
    expect(prompt).toBe('PRESS ENTER OR SPACE TO START');
  });

  it('derives from the effective CONFIRM bindings, so a rebind stays honest', () => {
    expect(startPromptFor(['KeyX'], undefined, 'FALLBACK')).toBe('PRESS X TO START');
    expect(startPromptFor(['Enter'], undefined, 'FALLBACK')).toBe('PRESS ENTER TO START');
  });

  it('respects an explicit content override verbatim', () => {
    expect(startPromptFor(['Enter'], 'TAP TO BEGIN', 'FALLBACK')).toBe('TAP TO BEGIN');
  });

  it('ignores a blank/whitespace content override and derives instead', () => {
    expect(startPromptFor(['Enter'], '   ', 'FALLBACK')).toBe('PRESS ENTER TO START');
    expect(startPromptFor(['Enter'], '', 'FALLBACK')).toBe('PRESS ENTER TO START');
  });

  it('falls back only when there is nothing to describe', () => {
    expect(startPromptFor([], undefined, 'FALLBACK')).toBe('FALLBACK');
    expect(startPromptFor(undefined, undefined, 'FALLBACK')).toBe('FALLBACK');
  });
});

describe('DEFAULT_UI_COPY', () => {
  it('no longer ships the opaque "PRESS CONFIRM TO START" default', () => {
    expect(DEFAULT_UI_COPY.startPrompt).not.toContain('CONFIRM');
    expect(DEFAULT_UI_COPY.startPrompt.toLowerCase()).toContain('enter');
  });
});
