/**
 * Tests for the dialog system.
 */

import { describe, it, expect } from 'vitest';
import { createDialogEngine, type DialogLine } from '../src/game-support/dialogSystem.ts';

describe('createDialogEngine', () => {
  it('starts inactive', () => {
    const engine = createDialogEngine();
    expect(engine.isActive).toBe(false);
    expect(engine.state.currentLine).toBeNull();
  });

  it('presents the first line on start', () => {
    const engine = createDialogEngine();
    const lines: readonly DialogLine[] = [
      { speaker: 'Hero', text: 'Hello world!' },
      { speaker: 'NPC', text: 'Welcome!' },
    ];

    engine.start(lines);
    expect(engine.isActive).toBe(true);
    expect(engine.state.currentLine?.text).toBe('Hello world!');
    expect(engine.state.currentLine?.speaker).toBe('Hero');
    expect(engine.state.lineIndex).toBe(0);
  });

  it('advances through lines', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Line 1' },
      { text: 'Line 2' },
      { text: 'Line 3' },
    ]);

    engine.advance();
    expect(engine.state.currentLine?.text).toBe('Line 2');

    engine.advance();
    expect(engine.state.currentLine?.text).toBe('Line 3');

    engine.advance();
    expect(engine.isActive).toBe(false);
  });

  it('presents choices', () => {
    const engine = createDialogEngine();
    engine.start([
      {
        text: 'What do you want?',
        choices: [
          { text: 'Gold' },
          { text: 'Information' },
          { text: 'Nothing' },
        ],
      },
    ]);

    expect(engine.state.availableChoices).toHaveLength(3);
    expect(engine.state.availableChoices[0]!.text).toBe('Gold');
  });

  it('advance does not skip choices', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Choose:', choices: [{ text: 'A' }, { text: 'B' }] },
      { text: 'After choice' },
    ]);

    engine.advance(); // Should not advance past choices
    expect(engine.state.currentLine?.text).toBe('Choose:');
  });

  it('choosing advances to next line', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Choose:', choices: [{ text: 'A' }, { text: 'B' }] },
      { text: 'After choice' },
    ]);

    engine.choose(0);
    expect(engine.state.currentLine?.text).toBe('After choice');
  });

  it('choices can jump to specific lines', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Start', choices: [{ text: 'Skip', next: 2 }] },
      { text: 'Skipped' },
      { text: 'Landed here' },
    ]);

    engine.choose(0);
    expect(engine.state.currentLine?.text).toBe('Landed here');
  });

  it('applies effects from lines', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Got flag', effects: [{ type: 'setFlag', key: 'quest_started' }] },
    ]);

    expect(engine.context.flags.quest_started).toBe(true);
    expect(engine.appliedEffects).toHaveLength(1);
  });

  it('applies effects from choices', () => {
    const engine = createDialogEngine();
    engine.start([
      {
        text: 'Take item?',
        choices: [
          { text: 'Yes', effects: [{ type: 'addItem', key: 'sword' }] },
          { text: 'No' },
        ],
      },
    ]);

    engine.choose(0);
    expect(engine.context.items.has('sword')).toBe(true);
  });

  it('respects choice conditions', () => {
    const engine = createDialogEngine();
    engine.start(
      [
        {
          text: 'Options:',
          choices: [
            { text: 'Always available' },
            { text: 'Needs flag', condition: (ctx) => Boolean(ctx.flags.hasKey) },
          ],
        },
      ],
      { flags: {} },
    );

    expect(engine.state.availableChoices).toHaveLength(1); // Second choice hidden
    expect(engine.state.availableChoices[0]!.text).toBe('Always available');
  });

  it('end() deactivates the dialog', () => {
    const engine = createDialogEngine();
    engine.start([{ text: 'Hello' }]);
    expect(engine.isActive).toBe(true);

    engine.end();
    expect(engine.isActive).toBe(false);
  });

  it('addScore effect works', () => {
    const engine = createDialogEngine();
    engine.start([
      { text: 'Bonus!', effects: [{ type: 'addScore', key: 'bonus', value: 100 }] },
    ]);
    expect(engine.context.score).toBe(100);
  });
});
