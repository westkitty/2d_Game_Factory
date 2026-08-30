import { describe, expect, it } from 'vitest';
import {
  DIALOGUE_EFFECT_CAPABILITY,
  EMPTY_DIALOGUE_HISTORY,
  IDLE_DIALOGUE_VIEW,
  InvalidDialogueDocumentError,
  compareNumeric,
  evaluateCondition,
  evaluateConditions,
  portraitRoleFor,
  validateDialogueDocument,
  type CharacterDefinition,
  type DialogueCondition,
  type DialogueDocument,
  type DialogueWorldView,
} from '../src/index.ts';

const WORLD: DialogueWorldView = {
  narrativeFlag: (flag) => flag === 'trusted',
  worldFlag: (flag) => flag === 'door-open',
  progressionUnlock: (flag) => flag === 'chapter-2',
  seenNode: (nodeId) => nodeId === 'intro',
  seenLine: (lineId) => lineId === 'intro-1',
  choiceCount: (choiceId) => (choiceId === 'asked' ? 2 : 0),
  itemCount: (itemId) => (itemId === 'key' ? 3 : 0),
};

function document(overrides: Partial<DialogueDocument> = {}): DialogueDocument {
  return {
    schemaVersion: 1,
    characters: [{ id: 'mara', displayName: 'Mara' }],
    nodes: [{ id: 'intro', lines: [{ id: 'intro-1', speaker: 'mara', text: 'Hello.' }] }],
    ...overrides,
  };
}

describe('compareNumeric', () => {
  it('covers each comparison at its boundary', () => {
    expect(compareNumeric(3, 'at-least', 3)).toBe(true);
    expect(compareNumeric(2, 'at-least', 3)).toBe(false);
    expect(compareNumeric(3, 'at-most', 3)).toBe(true);
    expect(compareNumeric(4, 'at-most', 3)).toBe(false);
    expect(compareNumeric(3, 'equals', 3)).toBe(true);
    expect(compareNumeric(3, 'equals', 4)).toBe(false);
  });
});

describe('evaluateCondition', () => {
  it('reads each boolean kind from the world it is given', () => {
    expect(evaluateCondition({ kind: 'narrative-flag', flag: 'trusted' }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'world-flag', flag: 'door-open' }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'progression-unlock', flag: 'chapter-2' }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'seen-node', nodeId: 'intro' }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'seen-line', lineId: 'intro-1' }, WORLD)).toBe(true);
  });

  it('a boolean condition defaults to "is set", and value:false inverts it', () => {
    expect(evaluateCondition({ kind: 'narrative-flag', flag: 'nope' }, WORLD)).toBe(false);
    expect(evaluateCondition({ kind: 'narrative-flag', flag: 'nope', value: false }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'seen-node', nodeId: 'later', value: false }, WORLD)).toBe(true);
  });

  it('compares choice and item counts numerically', () => {
    expect(evaluateCondition({ kind: 'choice-count', choiceId: 'asked', comparison: 'at-least', count: 2 }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'choice-count', choiceId: 'asked', comparison: 'at-least', count: 3 }, WORLD)).toBe(false);
    expect(evaluateCondition({ kind: 'item-count', itemId: 'key', comparison: 'equals', count: 3 }, WORLD)).toBe(true);
    expect(evaluateCondition({ kind: 'item-count', itemId: 'gem', comparison: 'at-most', count: 0 }, WORLD)).toBe(true);
  });
});

describe('evaluateConditions', () => {
  it('an absent or empty list is satisfied', () => {
    expect(evaluateConditions(undefined, WORLD)).toBe(true);
    expect(evaluateConditions([], WORLD)).toBe(true);
  });

  it('every condition must hold, not just one', () => {
    const all: DialogueCondition[] = [
      { kind: 'narrative-flag', flag: 'trusted' },
      { kind: 'item-count', itemId: 'key', comparison: 'at-least', count: 1 },
    ];
    expect(evaluateConditions(all, WORLD)).toBe(true);
    expect(evaluateConditions([...all, { kind: 'world-flag', flag: 'nope' }], WORLD)).toBe(false);
  });
});

describe('portraitRoleFor', () => {
  const mara: CharacterDefinition = {
    id: 'mara',
    displayName: 'Mara',
    defaultExpression: 'calm',
    portraits: { calm: 'npc-mara-calm', angry: 'npc-mara-angry' },
  };

  it('resolves the named expression', () => {
    expect(portraitRoleFor(mara, 'angry')).toEqual({ role: 'npc-mara-angry', expression: 'angry' });
  });

  it('falls back to the default when the line names none', () => {
    expect(portraitRoleFor(mara, undefined)).toEqual({ role: 'npc-mara-calm', expression: 'calm' });
  });

  it('falls back rather than blanking on an unknown expression', () => {
    // A typo in one line must not leave the character with no face for the
    // rest of the scene.
    expect(portraitRoleFor(mara, 'smug')).toEqual({ role: 'npc-mara-calm', expression: 'calm' });
  });

  it('a character with no portraits resolves to no art at all', () => {
    expect(portraitRoleFor({ id: 'x', displayName: 'X' }, 'any')).toEqual({ role: null, expression: 'any' });
    expect(portraitRoleFor({ id: 'x', displayName: 'X', portraits: {} }, undefined)).toEqual({
      role: null,
      expression: null,
    });
    expect(portraitRoleFor(undefined, undefined)).toEqual({ role: null, expression: null });
  });

  it('with no default, the first portrait key wins', () => {
    const anon: CharacterDefinition = { id: 'a', displayName: 'A', portraits: { neutral: 'r1', sad: 'r2' } };
    expect(portraitRoleFor(anon, undefined).role).toBe('r1');
  });
});

describe('effect capability map', () => {
  it('names an owner for every effect that touches shared state', () => {
    expect(DIALOGUE_EFFECT_CAPABILITY['set-narrative-flag']).toBe('narrative.state');
    expect(DIALOGUE_EFFECT_CAPABILITY['set-world-flag']).toBe('world.state');
    expect(DIALOGUE_EFFECT_CAPABILITY['grant-item']).toBe('items.state');
    expect(DIALOGUE_EFFECT_CAPABILITY['remove-item']).toBe('items.state');
    expect(DIALOGUE_EFFECT_CAPABILITY['progression']).toBe('progression.state');
    expect(DIALOGUE_EFFECT_CAPABILITY['mark-seen']).toBe('narrative.state');
  });

  it('the one effect the dialogue owns itself has no external owner', () => {
    expect(DIALOGUE_EFFECT_CAPABILITY['world-transition']).toBeNull();
  });
});

describe('constants', () => {
  it('an empty history is genuinely empty and an idle view is genuinely idle', () => {
    expect(EMPTY_DIALOGUE_HISTORY.spentChoices).toEqual([]);
    expect(Object.keys(EMPTY_DIALOGUE_HISTORY.nodeVisits)).toEqual([]);
    expect(IDLE_DIALOGUE_VIEW.status).toBe('idle');
    expect(IDLE_DIALOGUE_VIEW.text).toBe('');
    expect(IDLE_DIALOGUE_VIEW.choices).toEqual([]);
  });
});

describe('validateDialogueDocument', () => {
  const expectFail = (doc: DialogueDocument, fragment: string | RegExp): void => {
    expect(() => validateDialogueDocument(doc)).toThrow(InvalidDialogueDocumentError);
    expect(() => validateDialogueDocument(doc)).toThrow(fragment);
  };

  it('accepts a minimal document', () => {
    expect(() => validateDialogueDocument(document())).not.toThrow();
  });

  it('rejects an empty document', () => {
    expectFail({ schemaVersion: 1, nodes: [] }, 'at least one node');
  });

  it('rejects duplicate node, line, choice and character ids', () => {
    expectFail(
      document({ nodes: [{ id: 'a', lines: [{ id: 'l1', text: 'x' }] }, { id: 'a', lines: [{ id: 'l2', text: 'y' }] }] }),
      'Node "a" is defined more than once',
    );
    expectFail(
      document({ nodes: [{ id: 'a', lines: [{ id: 'l1', text: 'x' }, { id: 'l1', text: 'y' }] }] }),
      'Line "l1" is defined more than once',
    );
    expectFail(
      document({
        nodes: [{ id: 'a', lines: [{ id: 'l1', text: 'x' }], choices: [{ id: 'c', text: 'c' }, { id: 'c', text: 'd' }] }],
      }),
      'Choice "c" is defined more than once',
    );
    expectFail(
      document({ characters: [{ id: 'm', displayName: 'M' }, { id: 'm', displayName: 'N' }] }),
      'Character "m" is defined more than once',
    );
  });

  it('rejects a node that would do nothing when entered', () => {
    expectFail(document({ nodes: [{ id: 'a', lines: [] }] }), 'neither lines nor choices');
  });

  it('accepts a choices-only node', () => {
    expect(() =>
      validateDialogueDocument(
        document({ nodes: [{ id: 'a', lines: [], choices: [{ id: 'c', text: 'Go' }] }] }),
      ),
    ).not.toThrow();
  });

  it('rejects a line spoken by a character that does not exist', () => {
    expectFail(
      document({ nodes: [{ id: 'a', lines: [{ id: 'l', speaker: 'ghost', text: 'x' }] }] }),
      'not a defined character',
    );
  });

  it('rejects an expression the speaker has no portrait for', () => {
    expectFail(
      document({
        characters: [{ id: 'm', displayName: 'M', portraits: { calm: 'r' } }],
        nodes: [{ id: 'a', lines: [{ id: 'l', speaker: 'm', expression: 'furious', text: 'x' }] }],
      }),
      'no portrait for',
    );
  });

  it('allows any expression on a character with no portraits at all', () => {
    // A zero-art game stays valid; expressions are then just metadata.
    expect(() =>
      validateDialogueDocument(
        document({
          characters: [{ id: 'm', displayName: 'M' }],
          nodes: [{ id: 'a', lines: [{ id: 'l', speaker: 'm', expression: 'anything', text: 'x' }] }],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a default expression the character has no portrait for', () => {
    expectFail(
      document({ characters: [{ id: 'm', displayName: 'M', defaultExpression: 'calm', portraits: { sad: 'r' } }] }),
      'defaults to expression',
    );
  });

  it('rejects a dangling next, target, transition or startNode', () => {
    expectFail(
      document({ nodes: [{ id: 'a', lines: [{ id: 'l', text: 'x' }], next: 'nowhere' }] }),
      /Node "a" points at node "nowhere"/,
    );
    expectFail(
      document({
        nodes: [{ id: 'a', lines: [{ id: 'l', text: 'x' }], choices: [{ id: 'c', text: 'c', target: 'nowhere' }] }],
      }),
      /Choice "c" points at node "nowhere"/,
    );
    expectFail(
      document({
        nodes: [
          { id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'world-transition', nodeId: 'nowhere' }] }] },
        ],
      }),
      /Line "l" points at node "nowhere"/,
    );
    expectFail(document({ startNode: 'nowhere' }), /startNode points at node "nowhere"/);
  });

  it('allows a forward reference to a node defined later', () => {
    expect(() =>
      validateDialogueDocument(
        document({
          nodes: [
            { id: 'a', lines: [{ id: 'l1', text: 'x' }], next: 'b' },
            { id: 'b', lines: [{ id: 'l2', text: 'y' }] },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a condition gated on a line or choice that does not exist', () => {
    expectFail(
      document({
        nodes: [
          {
            id: 'a',
            lines: [{ id: 'l', text: 'x' }],
            choices: [{ id: 'c', text: 'c', conditions: [{ kind: 'seen-line', lineId: 'ghost' }] }],
          },
        ],
      }),
      /gated on line "ghost"/,
    );
    expectFail(
      document({
        nodes: [
          {
            id: 'a',
            lines: [{ id: 'l', text: 'x' }],
            choices: [
              { id: 'c', text: 'c', conditions: [{ kind: 'choice-count', choiceId: 'ghost', comparison: 'at-least', count: 1 }] },
            ],
          },
        ],
      }),
      /gated on choice "ghost"/,
    );
    expectFail(
      document({
        nodes: [
          {
            id: 'a',
            lines: [{ id: 'l', text: 'x' }],
            choices: [{ id: 'c', text: 'c', conditions: [{ kind: 'seen-node', nodeId: 'ghost' }] }],
          },
        ],
      }),
      /points at node "ghost"/,
    );
  });

  it('accepts a full branching document', () => {
    expect(() =>
      validateDialogueDocument({
        schemaVersion: 1,
        startNode: 'intro',
        characters: [
          { id: 'mara', displayName: 'Mara', defaultExpression: 'calm', portraits: { calm: 'r1', angry: 'r2' } },
        ],
        nodes: [
          {
            id: 'intro',
            lines: [{ id: 'i1', speaker: 'mara', text: 'Hello.', effects: [{ kind: 'set-narrative-flag', flag: 'met', value: true }] }],
            choices: [
              { id: 'ask', text: 'Ask.', target: 'answer', once: true },
              {
                id: 'leave',
                text: 'Leave.',
                conditions: [{ kind: 'narrative-flag', flag: 'met' }, { kind: 'seen-line', lineId: 'i1' }],
              },
            ],
          },
          { id: 'answer', lines: [{ id: 'a1', speaker: 'mara', expression: 'angry', text: 'No.' }], next: 'intro' },
        ],
      }),
    ).not.toThrow();
  });
});
