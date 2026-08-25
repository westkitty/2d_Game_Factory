import { describe, expect, it } from 'vitest';
import type { NarrativeService } from '../src/narrative/narrativePack.ts';
import { narrativePack } from '../src/narrative/narrativePack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('narrativePack', () => {
  it('installs and publishes the narrative capability with no current node', () => {
    const context = createFakeGameContext();
    const installed = narrativePack.install(context, undefined);
    const narrative = context.capabilities.require<NarrativeService>('narrative.state');

    expect(narrative.currentNode()).toBeNull();
    expect(installed.id).toBe('sw2d.narrative');
  });

  it('goTo() moves between nodes', () => {
    const context = createFakeGameContext();
    narrativePack.install(context, undefined);
    const narrative = context.capabilities.require<NarrativeService>('narrative.state');

    narrative.goTo('intro');
    expect(narrative.currentNode()).toBe('intro');
  });

  it('setFlag emits narrative:flagChanged only on an actual change', () => {
    const context = createFakeGameContext();
    narrativePack.install(context, undefined);
    const narrative = context.capabilities.require<NarrativeService>('narrative.state');

    const changes: unknown[] = [];
    context.events.on('narrative:flagChanged', (payload) => changes.push(payload));

    narrative.setFlag('met-innkeeper', true);
    narrative.setFlag('met-innkeeper', true);
    expect(narrative.hasFlag('met-innkeeper')).toBe(true);
    expect(changes).toEqual([{ flag: 'met-innkeeper', value: true }]);
  });

  it('choose() records the choice and transitions in one step', () => {
    const context = createFakeGameContext();
    narrativePack.install(context, undefined);
    const narrative = context.capabilities.require<NarrativeService>('narrative.state');
    narrative.goTo('crossroads');

    narrative.choose('go-left', 'forest-path');

    expect(narrative.currentNode()).toBe('forest-path');
    expect(narrative.chosenChoices()).toEqual(['go-left']);
  });

  it('tracks seen/codex entries, sorted and deduplicated', () => {
    const context = createFakeGameContext();
    narrativePack.install(context, undefined);
    const narrative = context.capabilities.require<NarrativeService>('narrative.state');

    narrative.markSeen('codex.dragon');
    narrative.markSeen('codex.dragon');
    narrative.markSeen('codex.castle');

    expect(narrative.hasSeen('codex.dragon')).toBe(true);
    expect(narrative.hasSeen('codex.unknown')).toBe(false);
    expect(narrative.seenEntries()).toEqual(['codex.castle', 'codex.dragon']);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = narrativePack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('narrative.state')).toBe(false);
  });
});
