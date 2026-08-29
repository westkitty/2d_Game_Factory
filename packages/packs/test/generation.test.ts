import { describe, expect, it } from 'vitest';
import type { GameContext, GenerationDoc, GenerationService } from '@sw2d/contracts';
import { GENERATION_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { generationPack } from '../src/generation/generationPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

function makeService(doc: GenerationDoc): { svc: GenerationService; dispose: () => void } {
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events: new FakeEventBus(),
    capabilities,
    content: { data: { generation: { schemaId: 'x', valid: true, value: doc } } },
  } as unknown as GameContext;
  const installed = generationPack.install(ctx, undefined);
  return { svc: capabilities.require<GenerationService>(GENERATION_CAPABILITY_ID), dispose: () => installed.dispose() };
}

const DOC: GenerationDoc = {
  schemaVersion: 1,
  seed: 1337,
  generators: [
    {
      id: 'main',
      kind: 'segment-chain',
      count: 8,
      startTags: ['start'],
      templates: [
        { id: 'start-flat', entrySocket: 'g', exitSocket: 'g', weight: 1, difficulty: 0, tags: ['start'], length: 300, groundY: 480 },
        { id: 'flat', entrySocket: 'g', exitSocket: 'g', weight: 3, difficulty: 0, tags: ['run'], length: 280, groundY: 480 },
      ],
    },
    {
      id: 'dungeon',
      kind: 'room-graph',
      roomCount: 5,
      criticalPathLength: 3,
      maxBranches: 1,
      templates: [
        { id: 'start-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['start'] },
        { id: 'hall', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 2, tags: ['path'], enemies: 1 },
        { id: 'exit-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['exit'] },
      ],
    },
  ],
};

describe('sw2d.generation - ids', () => {
  it('publishes world.generation', () => {
    expect(GENERATION_CAPABILITY_ID).toBe(CAPABILITY_IDS.generation);
    expect(generationPack.provides).toEqual([CAPABILITY_IDS.generation]);
  });

  it('disposal withdraws the capability', () => {
    const { dispose } = makeService(DOC);
    dispose();
    expect(() => makeService(DOC)).not.toThrow();
  });
});

describe('GenerationService', () => {
  it('lists generators and runs one deterministically from the document seed', () => {
    const { svc } = makeService(DOC);
    expect(svc.availableGenerators()).toEqual(['dungeon', 'main']);
    const a = svc.generate('main');
    const b = makeService(DOC).svc.generate('main');
    expect(a.output).toEqual(b.output);
    expect(a.manifest.chosenTemplates).toHaveLength(8);
    expect(a.validation.valid).toBe(true);
  });

  it('two generators in one document produce different sub-seeds / output', () => {
    const { svc } = makeService(DOC);
    const seg = svc.generate('main');
    const dun = svc.generate('dungeon');
    expect(seg.manifest.kind).toBe('segment-chain');
    expect(dun.manifest.kind).toBe('room-graph');
  });

  it('an explicit seed override is honoured and stays reproducible', () => {
    const { svc } = makeService(DOC);
    const overA = svc.generate('main', { seed: 5 });
    const overB = makeService(DOC).svc.generate('main', { seed: 5 });
    expect(overA.output).toEqual(overB.output);
    expect(overA.manifest.seed).toBe(svc.normalizeSeed(5));
  });

  it('an explicit size override changes the segment count', () => {
    const { svc } = makeService(DOC);
    expect(svc.generate('main', { size: 4 }).manifest.chosenTemplates).toHaveLength(4);
  });

  it('throws for an unknown generator id', () => {
    const { svc } = makeService(DOC);
    expect(() => svc.generate('nope')).toThrow();
  });

  it('validate() re-checks a produced result', () => {
    const { svc } = makeService(DOC);
    expect(svc.validate(svc.generate('dungeon')).valid).toBe(true);
  });
});
