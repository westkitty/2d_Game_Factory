import { describe, expect, it } from 'vitest';
import type { DialogueDocument, DialogueService, GameContext, ItemsService } from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  DialogueServiceImpl,
  dialoguePack,
  MissingDialogueDocumentError,
  UnknownDialogueNodeError,
  type DialogueDependencies,
} from '../src/dialogue/dialoguePack.ts';
import { narrativePack, type NarrativeService } from '../src/narrative/narrativePack.ts';
import { worldPack, type WorldService } from '../src/world/worldPack.ts';
import { progressionPack, type ProgressionService } from '../src/progression/progressionPack.ts';

/**
 * A small branching scene: three characters, an expression change, a gated
 * choice, a `once` choice, a reconvergence, and a persistent consequence.
 * Every id here is authored - the pack knows no `mara` and no `trusted`.
 */
const SCENE: DialogueDocument = {
  schemaVersion: 1,
  startNode: 'meet',
  characters: [
    { id: 'mara', displayName: 'Mara', defaultExpression: 'calm', portraits: { calm: 'npc-a', angry: 'npc-b' } },
    { id: 'joss', displayName: 'Joss', portraits: { neutral: 'npc-c' } },
    { id: 'warden', displayName: 'The Warden' },
  ],
  nodes: [
    {
      id: 'meet',
      lines: [
        { id: 'm1', speaker: 'mara', text: 'You came.' },
        { id: 'm2', speaker: 'mara', expression: 'angry', text: 'You are late.' },
        { id: 'm3', text: 'The room is cold.' },
      ],
      choices: [
        {
          id: 'apologise',
          text: 'Apologise.',
          target: 'forgiven',
          once: true,
          effects: [{ kind: 'set-narrative-flag', flag: 'trusted', value: true }],
        },
        { id: 'shrug', text: 'Shrug.', target: 'cold' },
        {
          id: 'secret',
          text: 'Mention the key.',
          target: 'forgiven',
          conditions: [{ kind: 'item-count', itemId: 'key', comparison: 'at-least', count: 1 }],
        },
      ],
    },
    {
      id: 'forgiven',
      lines: [{ id: 'f1', speaker: 'mara', text: 'Fine.', effects: [{ kind: 'grant-item', itemId: 'key' }] }],
      next: 'ending',
    },
    { id: 'cold', lines: [{ id: 'c1', speaker: 'joss', text: 'She will not forget that.' }], next: 'ending' },
    {
      id: 'ending',
      lines: [{ id: 'e1', speaker: 'warden', text: 'Time.', effects: [{ kind: 'mark-seen', entryId: 'chapter-1' }] }],
      choices: [
        {
          id: 'reflect',
          text: 'Think about it.',
          conditions: [{ kind: 'narrative-flag', flag: 'trusted' }],
        },
        { id: 'again', text: 'Start over.', target: 'meet' },
      ],
    },
  ],
};

const ITEM_CATALOG = {
  schemaVersion: 1,
  items: [
    { id: 'key', displayName: 'Key', category: 'quest', stackable: true, consumable: false },
  ],
};

function createContext(document?: DialogueDocument): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (document) data['dialogue'] = { schemaId: 'dialogue', valid: true, value: document };
  data['items'] = { schemaId: 'item-catalog', valid: true, value: ITEM_CATALOG };
  return { ...base, content: { ...base.content, data } };
}

/** A dialogue wired to real narrative/world/progression services. */
function wired(document: DialogueDocument = SCENE): {
  service: DialogueServiceImpl;
  deps: Required<Pick<DialogueDependencies, 'narrative' | 'world' | 'progression'>> & { items: FakeItems };
} {
  const context = createFakeGameContext();
  narrativePack.install(context, undefined as never);
  worldPack.install(context, undefined as never);
  progressionPack.install(context, {});
  const deps = {
    narrative: context.capabilities.require<NarrativeService>('narrative.state'),
    world: context.capabilities.require<WorldService>('world.state'),
    progression: context.capabilities.require<ProgressionService>('progression.state'),
    items: new FakeItems(),
  };
  return { service: new DialogueServiceImpl(document, deps, context.events), deps };
}

/** Just enough of ItemsService for the two effects a dialogue can use. */
class FakeItems implements Pick<ItemsService, 'count' | 'grant' | 'remove'> {
  readonly #counts = new Map<string, number>();
  count(itemId: string): number {
    return this.#counts.get(itemId) ?? 0;
  }
  grant(itemId: string, quantity = 1) {
    const next = this.count(itemId) + quantity;
    this.#counts.set(itemId, next);
    return { itemId, count: next, granted: quantity };
  }
  remove(itemId: string, quantity = 1) {
    const next = Math.max(0, this.count(itemId) - quantity);
    this.#counts.set(itemId, next);
    return { itemId, count: next, granted: -quantity };
  }
}

describe('dialoguePack installation', () => {
  it('provides narrative.dialogue and releases it on dispose', () => {
    const context = createContext(SCENE);
    const installed = dialoguePack.install(context, {});
    expect(context.capabilities.has('narrative.dialogue')).toBe(true);
    expect(installed.id).toBe('sw2d.dialogue');
    installed.dispose();
    expect(context.capabilities.has('narrative.dialogue')).toBe(false);
  });

  it('requires the content document', () => {
    expect(() => dialoguePack.install(createContext(), {})).toThrow(MissingDialogueDocumentError);
  });

  it('rejects a dangling graph reference at install, not at the moment a player hits it', () => {
    const broken: DialogueDocument = {
      schemaVersion: 1,
      nodes: [{ id: 'a', lines: [{ id: 'l', text: 'x' }], next: 'nowhere' }],
    };
    expect(() => dialoguePack.install(createContext(broken), {})).toThrow(/points at node "nowhere"/);
  });

  it('installs with no state capabilities at all - a dialogue with no effects needs none', () => {
    const context = createContext(SCENE);
    expect(() => dialoguePack.install(context, {})).not.toThrow();
    const service = context.capabilities.require<DialogueService>('narrative.dialogue');
    expect(service.start().text).toBe('You came.');
  });

  it('reads an alternative document name when configured', () => {
    const base = createFakeGameContext();
    const context = {
      ...base,
      content: { ...base.content, data: { script: { schemaId: 'dialogue', valid: true, value: SCENE } } },
    } as GameContext;
    expect(() => dialoguePack.install(context, { documentName: 'script' })).not.toThrow();
  });

  it('has no update(): advancing is caller-driven, so nothing can double-step it', () => {
    const context = createContext(SCENE);
    const installed = dialoguePack.install(context, {});
    expect(installed.update).toBeUndefined();
    const service = context.capabilities.require<DialogueService>('narrative.dialogue');
    expect((service as unknown as Record<string, unknown>)['update']).toBeUndefined();
  });
});

describe('walking the graph', () => {
  it('starts at the authored start node and shows its first line', () => {
    const { service } = wired();
    const view = service.start();
    expect(view.status).toBe('lines');
    expect(view.nodeId).toBe('meet');
    expect(view.lineId).toBe('m1');
    expect(view.speakerName).toBe('Mara');
    expect(view.text).toBe('You came.');
    expect(view.hasMoreLines).toBe(true);
  });

  it('starts at an explicit node, and throws for one that does not exist', () => {
    const { service } = wired();
    expect(service.start('cold').nodeId).toBe('cold');
    expect(() => service.start('ghost')).toThrow(UnknownDialogueNodeError);
  });

  it('advances line by line and reports when the last line is reached', () => {
    const { service } = wired();
    service.start();
    expect(service.advance().lineId).toBe('m2');
    const last = service.advance();
    expect(last.lineId).toBe('m3');
    expect(last.hasMoreLines).toBe(false);
  });

  it('resolves the portrait role per line, falling back to the default expression', () => {
    const { service } = wired();
    const first = service.start();
    expect(first.portraitRole).toBe('npc-a'); // mara's default, 'calm'
    const second = service.advance();
    expect(second.expression).toBe('angry');
    expect(second.portraitRole).toBe('npc-b');
  });

  it('a line with no speaker has no name and no portrait', () => {
    const { service } = wired();
    service.start();
    service.advance();
    const narration = service.advance();
    expect(narration.speakerId).toBeNull();
    expect(narration.speakerName).toBeNull();
    expect(narration.portraitRole).toBeNull();
  });

  it('a character with no portraits shows a name and no art - a zero-art game is valid', () => {
    const { service } = wired();
    service.start('ending');
    const view = service.view();
    expect(view.speakerName).toBe('The Warden');
    expect(view.portraitRole).toBeNull();
  });

  it('presents choices after the last line rather than ending', () => {
    const { service } = wired();
    service.start();
    service.advance();
    service.advance();
    const view = service.advance();
    expect(view.status).toBe('choices');
    expect(view.text).toBe('');
    expect(view.choices.map((choice) => choice.id)).toEqual(['apologise', 'shrug', 'secret']);
  });

  it('advance() is a no-op while choices are pending - a decision cannot be skipped', () => {
    const { service } = wired();
    service.start();
    service.advance();
    service.advance();
    service.advance();
    expect(service.advance().status).toBe('choices');
    expect(service.view().nodeId).toBe('meet');
  });

  it('follows `next` when a node has lines but no choices', () => {
    const { service } = wired();
    service.start('cold');
    const view = service.advance();
    expect(view.nodeId).toBe('ending');
    expect(view.lineId).toBe('e1');
  });

  it('ends when the lines run out with no choices and no next', () => {
    const { service } = wired({
      schemaVersion: 1,
      nodes: [{ id: 'only', lines: [{ id: 'l', text: 'Bye.' }] }],
    });
    service.start();
    const view = service.advance();
    expect(view.status).toBe('ended');
  });

  it('a choices-only node presents its choices immediately', () => {
    const { service } = wired({
      schemaVersion: 1,
      nodes: [{ id: 'fork', lines: [], choices: [{ id: 'go', text: 'Go' }] }],
    });
    const view = service.start();
    expect(view.status).toBe('choices');
    expect(view.choices).toHaveLength(1);
  });
});

describe('choices', () => {
  function reachChoices(service: DialogueServiceImpl): void {
    service.start();
    service.advance();
    service.advance();
    service.advance();
  }

  it('a conditional choice is unavailable and names why', () => {
    const { service } = wired();
    reachChoices(service);
    const secret = service.availableChoices().find((choice) => choice.id === 'secret')!;
    expect(secret.available).toBe(false);
    expect(secret.blockedBy).toBe('conditions');
  });

  it('supplying the world fact makes the conditional choice available', () => {
    const { service, deps } = wired();
    deps.items.grant('key');
    reachChoices(service);
    const secret = service.availableChoices().find((choice) => choice.id === 'secret')!;
    expect(secret.available).toBe(true);
    expect(secret.blockedBy).toBeNull();
  });

  it('taking a choice applies its effects and enters its target', () => {
    const { service, deps } = wired();
    reachChoices(service);
    const view = service.choose('apologise');
    expect(view.nodeId).toBe('forgiven');
    expect(deps.narrative.hasFlag('trusted')).toBe(true);
    expect(service.history().choiceCounts['apologise']).toBe(1);
  });

  it('an unavailable choice is refused outright: no count, no effects, no transition', () => {
    const { service, deps } = wired();
    reachChoices(service);
    const view = service.choose('secret');
    expect(view.nodeId).toBe('meet');
    expect(view.status).toBe('choices');
    expect(service.history().choiceCounts['secret']).toBeUndefined();
    expect(deps.items.count('key')).toBe(0);
  });

  it('an unknown choice id is ignored rather than throwing', () => {
    const { service } = wired();
    reachChoices(service);
    expect(service.choose('nope').status).toBe('choices');
  });

  it('a `once` choice is spent after one use and says so', () => {
    const { service } = wired();
    reachChoices(service);
    service.choose('apologise');
    // Reconverge and come back around.
    service.advance(); // forgiven -> ending
    service.choose('again'); // ending -> meet
    service.advance();
    service.advance();
    service.advance();
    const apologise = service.availableChoices().find((choice) => choice.id === 'apologise')!;
    expect(apologise.available).toBe(false);
    expect(apologise.blockedBy).toBe('spent');
    expect(service.history().spentChoices).toEqual(['apologise']);
  });

  it('a repeatable choice can be taken again and its count accumulates', () => {
    const { service } = wired();
    reachChoices(service);
    service.choose('shrug');
    service.advance(); // cold -> ending
    service.choose('again');
    service.advance();
    service.advance();
    service.advance();
    service.choose('shrug');
    expect(service.history().choiceCounts['shrug']).toBe(2);
  });

  it('a choice with no target and no transition ends the dialogue', () => {
    const { service, deps } = wired();
    deps.narrative.setFlag('trusted', true);
    service.start('ending');
    service.advance(); // last line -> choices
    expect(service.choose('reflect').status).toBe('ended');
  });

  it('a choice effect transition beats its target - the later instruction wins', () => {
    const { service } = wired({
      schemaVersion: 1,
      nodes: [
        {
          id: 'a',
          lines: [{ id: 'l', text: 'x' }],
          choices: [{ id: 'c', text: 'c', target: 'b', effects: [{ kind: 'world-transition', nodeId: 'z' }] }],
        },
        { id: 'b', lines: [{ id: 'lb', text: 'b' }] },
        { id: 'z', lines: [{ id: 'lz', text: 'z' }] },
      ],
    });
    service.start();
    service.advance();
    expect(service.choose('c').nodeId).toBe('z');
  });
});

describe('effects', () => {
  it('routes each effect to the capability that owns the state it touches', () => {
    const { service, deps } = wired({
      schemaVersion: 1,
      nodes: [
        {
          id: 'a',
          lines: [
            {
              id: 'l',
              text: 'x',
              effects: [
                { kind: 'set-narrative-flag', flag: 'nf', value: true },
                { kind: 'set-world-flag', flag: 'wf', value: true },
                { kind: 'grant-item', itemId: 'key', quantity: 2 },
                { kind: 'progression', currency: 10, xp: 5, unlock: 'chapter-2' },
                { kind: 'mark-seen', entryId: 'codex-1' },
              ],
            },
          ],
        },
      ],
    });
    service.start();
    expect(deps.narrative.hasFlag('nf')).toBe(true);
    expect(deps.world.hasFlag('wf')).toBe(true);
    expect(deps.items.count('key')).toBe(2);
    expect(deps.progression.currency()).toBe(10);
    expect(deps.progression.xp()).toBe(5);
    expect(deps.progression.isUnlocked('chapter-2')).toBe(true);
    // `mark-seen` writes the narrative capability's codex, not this service's
    // own history - a different question that happens to share a word.
    expect(deps.narrative.hasSeen('codex-1')).toBe(true);
  });

  it('a missing capability owner skips the effect and names it rather than failing silently', () => {
    const service = new DialogueServiceImpl(
      {
        schemaVersion: 1,
        nodes: [
          { id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'grant-item', itemId: 'key' }] }] },
        ],
      },
      {}, // no owners at all
    );
    service.start();
    const applied = service.drainEvents().find((event) => event.kind === 'effects-applied');
    expect(applied).toMatchObject({
      result: { applied: [], skipped: [{ kind: 'grant-item', reason: 'missing-capability', capability: 'items.state' }] },
    });
  });

  it('remove-item goes through the items owner', () => {
    const { service, deps } = wired({
      schemaVersion: 1,
      nodes: [
        { id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'remove-item', itemId: 'key' }] }] },
      ],
    });
    deps.items.grant('key', 3);
    service.start();
    expect(deps.items.count('key')).toBe(2);
  });

  it('a line effect runs exactly once per showing, not once per read of the view', () => {
    const { service, deps } = wired({
      schemaVersion: 1,
      nodes: [
        { id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'grant-item', itemId: 'key' }] }] },
      ],
    });
    service.start();
    service.view();
    service.view();
    expect(deps.items.count('key')).toBe(1);
  });

  it('a line transition effect moves immediately', () => {
    const { service } = wired({
      schemaVersion: 1,
      nodes: [
        { id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'world-transition', nodeId: 'b' }] }] },
        { id: 'b', lines: [{ id: 'lb', text: 'y' }] },
      ],
    });
    expect(service.start().nodeId).toBe('b');
  });
});

describe('history', () => {
  it('counts node visits, line views and choice takes', () => {
    const { service } = wired();
    service.start();
    service.advance();
    service.advance();
    service.advance();
    service.choose('shrug');
    const history = service.history();
    expect(history.nodeVisits['meet']).toBe(1);
    expect(history.nodeVisits['cold']).toBe(1);
    expect(history.lineViews['m1']).toBe(1);
    expect(history.lineViews['m2']).toBe(1);
    expect(history.choiceCounts['shrug']).toBe(1);
  });

  it('a second visit increments rather than replacing', () => {
    const { service } = wired();
    service.start('cold');
    service.start('cold');
    expect(service.history().nodeVisits['cold']).toBe(2);
    expect(service.history().lineViews['c1']).toBe(2);
  });

  it('seen-node and seen-line read this dialogue\'s own history', () => {
    const { service } = wired({
      schemaVersion: 1,
      nodes: [
        { id: 'a', lines: [{ id: 'la', text: 'x' }], next: 'b' },
        {
          id: 'b',
          lines: [{ id: 'lb', text: 'y' }],
          choices: [
            { id: 'yes', text: 'yes', conditions: [{ kind: 'seen-line', lineId: 'la' }] },
            { id: 'no', text: 'no', conditions: [{ kind: 'seen-node', nodeId: 'b', value: false }] },
          ],
        },
      ],
    });
    service.start();
    service.advance();
    service.advance();
    const options = service.availableChoices();
    expect(options.find((option) => option.id === 'yes')!.available).toBe(true);
    // 'b' is the node we are standing in, so "not seen b" is false.
    expect(options.find((option) => option.id === 'no')!.available).toBe(false);
  });

  it('reset clears the cursor and the whole history', () => {
    const { service } = wired();
    service.start();
    service.advance();
    service.reset();
    expect(service.view().status).toBe('idle');
    expect(service.history().nodeVisits).toEqual({});
    expect(service.history().spentChoices).toEqual([]);
    expect(service.drainEvents()).toHaveLength(0);
  });
});

describe('save and restore', () => {
  it('round-trips the cursor and history by id', () => {
    const { service } = wired();
    service.start();
    service.advance();
    const saved = service.save();
    expect(saved.nodeId).toBe('meet');
    expect(saved.lineIndex).toBe(1);
    // Ids only: no text anywhere in the record, so proofreading cannot break a save.
    expect(JSON.stringify(saved)).not.toContain('You are late');

    const fresh = wired().service;
    const view = fresh.restore(saved);
    expect(view.nodeId).toBe('meet');
    expect(view.lineId).toBe('m2');
    expect(fresh.history().lineViews['m1']).toBe(1);
  });

  it('restoring does not re-run the line\'s effects', () => {
    const doc: DialogueDocument = {
      schemaVersion: 1,
      nodes: [{ id: 'a', lines: [{ id: 'l', text: 'x', effects: [{ kind: 'grant-item', itemId: 'key' }] }] }],
    };
    const first = wired(doc);
    first.service.start();
    expect(first.deps.items.count('key')).toBe(1);
    const saved = first.service.save();

    const second = wired(doc);
    second.service.restore(saved);
    // Re-running the effect here would double every consequence on every reload.
    expect(second.deps.items.count('key')).toBe(0);
  });

  it('a save naming a node that no longer exists falls back to idle rather than throwing', () => {
    const { service } = wired();
    // A writer renamed a scene between builds; the player's save must not crash.
    const view = service.restore({
      nodeId: 'deleted-scene',
      lineIndex: 3,
      status: 'lines',
      history: { nodeVisits: {}, lineViews: {}, choiceCounts: {}, spentChoices: [] },
    });
    expect(view.status).toBe('idle');
    expect(view.nodeId).toBeNull();
  });

  it('clamps a line index past the end of a shortened node', () => {
    const { service } = wired();
    const view = service.restore({
      nodeId: 'cold',
      lineIndex: 99,
      status: 'lines',
      history: { nodeVisits: {}, lineViews: {}, choiceCounts: {}, spentChoices: [] },
    });
    expect(view.lineId).toBe('c1');
  });

  it('restores spent once-choices, so a reload cannot refund a decision', () => {
    const { service } = wired();
    service.start();
    service.advance();
    service.advance();
    service.advance();
    service.choose('apologise');
    const saved = service.save();

    const fresh = wired().service;
    fresh.restore(saved);
    expect(fresh.history().spentChoices).toEqual(['apologise']);
  });
});

describe('events', () => {
  it('reports the walk as a drainable stream', () => {
    const { service } = wired();
    service.start();
    service.advance();
    const kinds = service.drainEvents().map((event) => event.kind);
    expect(kinds).toContain('started');
    expect(kinds).toContain('node-entered');
    expect(kinds).toContain('line-shown');
    expect(service.drainEvents()).toHaveLength(0);
  });

  it('emits onto the game bus', () => {
    const context = createContext(SCENE);
    const installed = dialoguePack.install(context, {});
    const service = context.capabilities.require<DialogueService>('narrative.dialogue');
    const seen: string[] = [];
    context.events.on('dialogue:nodeEntered', ({ nodeId }) => seen.push(`node:${nodeId}`));
    context.events.on('dialogue:lineShown', ({ lineId }) => seen.push(`line:${lineId}`));
    context.events.on('dialogue:choiceTaken', ({ choiceId }) => seen.push(`choice:${choiceId}`));
    context.events.on('dialogue:ended', () => seen.push('ended'));

    service.start('cold');
    service.advance();
    service.choose('again');
    service.end();

    expect(seen[0]).toBe('node:cold');
    expect(seen).toContain('line:c1');
    expect(seen).toContain('choice:again');
    expect(seen[seen.length - 1]).toBe('ended');
    installed.dispose();
  });
});

/**
 * Phase 20.14 - investigation regression.
 *
 * A witness interrogation is not a different system from a visual novel's
 * conversation; it is the same graph with clue-gated choices. This asserts that
 * directly, because the alternative - an `investigation.dialogue` capability
 * that drifts from `narrative.dialogue` - is exactly what the program exists to
 * prevent.
 *
 * There is no `proofs/investigation-game/` to run a browser journey against, so
 * this is the regression: the same service, the same conditions, the same
 * effects, driven by a witness-shaped document.
 */
describe('investigation regression - witness and clue dialogue on the same service', () => {
  const INTERROGATION: DialogueDocument = {
    schemaVersion: 1,
    startNode: 'question',
    characters: [{ id: 'witness', displayName: 'Dockhand' }],
    nodes: [
      {
        id: 'question',
        lines: [{ id: 'q1', speaker: 'witness', text: 'I saw nothing.' }],
        choices: [
          {
            id: 'press-ledger',
            text: 'Show him the ledger.',
            target: 'admits',
            // The clue is an ordinary item; possession is an ordinary condition.
            conditions: [{ kind: 'item-count', itemId: 'ledger', comparison: 'at-least', count: 1 }],
            effects: [{ kind: 'set-narrative-flag', flag: 'dockhand-cracked', value: true }],
          },
          {
            id: 'press-alibi',
            text: 'Point out the contradiction.',
            target: 'admits',
            // A deduction the player has already made, recorded as a flag.
            conditions: [{ kind: 'narrative-flag', flag: 'knows-alibi-fails' }],
          },
          { id: 'leave', text: 'Leave him be.' },
        ],
      },
      {
        id: 'admits',
        lines: [
          {
            id: 'a1',
            speaker: 'witness',
            text: 'All right. The crate was already open.',
            // The testimony itself becomes a clue in the codex.
            effects: [{ kind: 'mark-seen', entryId: 'clue-crate-open' }],
          },
        ],
      },
    ],
  };

  it('a clue in the inventory unlocks the line of questioning it supports', () => {
    const { service, deps } = wired(INTERROGATION);
    service.start();
    service.advance();
    expect(service.availableChoices().find((c) => c.id === 'press-ledger')!.available).toBe(false);

    deps.items.grant('ledger');
    expect(service.availableChoices().find((c) => c.id === 'press-ledger')!.available).toBe(true);
    service.choose('press-ledger');
    expect(deps.narrative.hasFlag('dockhand-cracked')).toBe(true);
  });

  it('a deduction already made unlocks a different route to the same admission', () => {
    const { service, deps } = wired(INTERROGATION);
    deps.narrative.setFlag('knows-alibi-fails', true);
    service.start();
    service.advance();
    const options = service.availableChoices();
    expect(options.find((c) => c.id === 'press-alibi')!.available).toBe(true);
    // Two routes, one admission - the reconvergence an interrogation needs.
    expect(service.choose('press-alibi').nodeId).toBe('admits');
  });

  it('testimony lands in the narrative codex, where an evidence board would read it', () => {
    const { service, deps } = wired(INTERROGATION);
    deps.items.grant('ledger');
    service.start();
    service.advance();
    service.choose('press-ledger');
    expect(deps.narrative.hasSeen('clue-crate-open')).toBe(true);
  });

  it('with no clue and no deduction, only walking away is offered', () => {
    const { service } = wired(INTERROGATION);
    service.start();
    service.advance();
    const available = service.availableChoices().filter((c) => c.available).map((c) => c.id);
    expect(available).toEqual(['leave']);
  });
});
