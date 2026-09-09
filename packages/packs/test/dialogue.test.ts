import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { DialogueCatalog, DialogueService, GameContext } from '@sw2d/contracts';
import { DIALOGUE_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { dialoguePack } from '../src/dialogue/dialoguePack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const NOVEL: DialogueCatalog = {
  schemaVersion: 1,
  mode: 'novel',
  startConversationId: 'station',
  conversations: [
    {
      id: 'station',
      startNodeId: 'n0',
      nodes: [
        { id: 'n0', kind: 'line', speaker: 'Narrator', text: 'A stranger arrives at the old station.', next: 'n1' },
        { id: 'n1', kind: 'line', speaker: 'Stranger', text: 'They ask you to choose what happens next.', next: 'n2' },
        {
          id: 'n2',
          kind: 'choice',
          speaker: 'Stranger',
          text: 'What do you do?',
          choices: [
            { id: 'help', text: 'Help the stranger', next: 'n3', branchId: 'help-the-stranger', setFlag: 'helped' },
            { id: 'secret', text: 'Keep the secret', next: 'n4', branchId: 'keep-the-secret', setFlag: 'secret' },
          ],
        },
        { id: 'n3', kind: 'end', speaker: 'Narrator', text: 'Your choice changes the final scene.', ending: 'dawn-ending' },
        { id: 'n4', kind: 'end', speaker: 'Narrator', text: 'Your choice changes the final scene.', ending: 'midnight-ending' },
      ],
    },
  ],
};

const ADVENTURE: DialogueCatalog = {
  schemaVersion: 1,
  mode: 'adventure',
  conversations: [
    {
      id: 'note',
      startNodeId: 'n',
      nodes: [{ id: 'n', kind: 'end', speaker: 'You', text: 'A crumpled note: the clock is lying.', setFlag: 'saw-note' }],
    },
    {
      id: 'clock',
      startNodeId: 'c',
      nodes: [{ id: 'c', kind: 'end', speaker: 'You', text: 'The clock hides a small brass key.', setFlag: 'saw-clock' }],
    },
    {
      id: 'door',
      startNodeId: 'd',
      nodes: [{ id: 'd', kind: 'end', speaker: 'You', text: 'The door swings open.', ending: 'escaped' }],
    },
  ],
  hotspots: [
    { id: 'note', conversationId: 'note', x: 240, y: 280 },
    { id: 'clock', conversationId: 'clock', x: 480, y: 280 },
    { id: 'door', conversationId: 'door', x: 720, y: 280, requireFlags: ['saw-note', 'saw-clock'] },
  ],
};

function install(catalog?: DialogueCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { dialogue: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = dialoguePack.install(ctx, undefined);
  const dialogue = capabilities.require<DialogueService>(DIALOGUE_CAPABILITY_ID);
  return { events, capabilities, installed, dialogue };
}

describe('sw2d.dialogue - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(DIALOGUE_CAPABILITY_ID).toBe(CAPABILITY_IDS.dialogue);
    expect(dialoguePack.provides).toEqual([DIALOGUE_CAPABILITY_ID]);
  });
});

describe('sw2d.dialogue - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ dialogue: NOVEL })).not.toThrow();
    expect(() => validateContentBundleData({ dialogue: ADVENTURE })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ dialogue: { ...NOVEL, mode: 'parser' } })).toThrow();
  });
});

describe('sw2d.dialogue - novel loop', () => {
  it('auto-starts, advances two lines, chooses, then completes on the ending node', () => {
    const { dialogue } = install(NOVEL);
    expect(dialogue.mode()).toBe('novel');
    expect(dialogue.active()).toBe(true);
    expect(dialogue.kind()).toBe('line');
    expect(dialogue.step()).toBe(0);
    expect(dialogue.advance().reason).toBe('advanced');
    expect(dialogue.advance().reason).toBe('advanced');
    expect(dialogue.kind()).toBe('choice');
    expect(dialogue.step()).toBe(2);
    dialogue.selectByDelta(1);
    expect(dialogue.choose().reason).toBe('chose');
    expect(dialogue.branch()).toBe('keep-the-secret');
    expect(dialogue.hasFlag('secret')).toBe(true);
    expect(dialogue.kind()).toBe('end');
    expect(dialogue.advance().reason).toBe('completed');
    expect(dialogue.ending()).toBe('midnight-ending');
    expect(dialogue.outcome()).toBe('complete');
    expect(dialogue.advance().reason).toBe('not-playing');
  });

  it('the other choice reaches dawn-ending', () => {
    const { dialogue } = install(NOVEL);
    dialogue.advance();
    dialogue.advance();
    expect(dialogue.choose('help').reason).toBe('chose');
    expect(dialogue.branch()).toBe('help-the-stranger');
    dialogue.advance();
    expect(dialogue.ending()).toBe('dawn-ending');
    expect(dialogue.outcome()).toBe('complete');
  });

  it('advance on a choice node is reported, never a silent skip', () => {
    const { dialogue } = install(NOVEL);
    dialogue.advance();
    dialogue.advance();
    expect(dialogue.advance().reason).toBe('not-line');
    expect(dialogue.kind()).toBe('choice');
  });

  it('unknown choice is reported', () => {
    const { dialogue } = install(NOVEL);
    dialogue.advance();
    dialogue.advance();
    expect(dialogue.choose('dance')).toEqual({ ok: false, reason: 'unknown-choice', choiceId: 'dance', nodeId: 'n2' });
  });
});

describe('sw2d.dialogue - adventure loop', () => {
  it('stays idle until start, inspect sets flags, gated door completes', () => {
    const { dialogue } = install(ADVENTURE);
    expect(dialogue.mode()).toBe('adventure');
    expect(dialogue.kind()).toBe('idle');
    expect(dialogue.start('door').reason).toBe('locked');
    expect(dialogue.start('note').reason).toBe('advanced');
    expect(dialogue.hasFlag('saw-note')).toBe(true);
    expect(dialogue.advance().reason).toBe('ended');
    expect(dialogue.kind()).toBe('idle');
    expect(dialogue.outcome()).toBe('playing');
    expect(dialogue.start('clock').reason).toBe('advanced');
    dialogue.advance();
    expect(dialogue.hasFlag('saw-clock')).toBe(true);
    expect(dialogue.hotspots().find((h) => h.id === 'door')?.locked).toBe(false);
    expect(dialogue.start('door').reason).toBe('advanced');
    expect(dialogue.advance().reason).toBe('completed');
    expect(dialogue.ending()).toBe('escaped');
    expect(dialogue.outcome()).toBe('complete');
  });
});

describe('sw2d.dialogue - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(NOVEL);
    expect(capabilities.has(DIALOGUE_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(DIALOGUE_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate conversation ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: DialogueCatalog = {
      ...NOVEL,
      conversations: [NOVEL.conversations[0]!, NOVEL.conversations[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { dialogue: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => dialoguePack.install(ctx, undefined)).toThrow(/station/);
  });

  it('unknown next node throws at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: DialogueCatalog = {
      schemaVersion: 1,
      mode: 'novel',
      conversations: [
        {
          id: 'broken',
          startNodeId: 'a',
          nodes: [{ id: 'a', kind: 'line', speaker: 'A', text: 'hi', next: 'missing' }],
        },
      ],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { dialogue: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => dialoguePack.install(ctx, undefined)).toThrow(/missing/);
  });

  it('a missing content/dialogue.json yields an inert service, not an error', () => {
    const { dialogue } = install();
    expect(dialogue.active()).toBe(false);
    expect(dialogue.advance().reason).toBe('idle');
    expect(dialogue.kind()).toBe('idle');
  });

  it('reset restores the start node for a new reading', () => {
    const { dialogue } = install(NOVEL);
    dialogue.advance();
    dialogue.advance();
    dialogue.choose('help');
    dialogue.advance();
    expect(dialogue.outcome()).toBe('complete');
    dialogue.reset();
    expect(dialogue.outcome()).toBe('playing');
    expect(dialogue.step()).toBe(0);
    expect(dialogue.branch()).toBeNull();
    expect(dialogue.ending()).toBeNull();
    expect(dialogue.nodeId()).toBe('n0');
    expect(dialogue.flags()).toEqual([]);
  });
});
