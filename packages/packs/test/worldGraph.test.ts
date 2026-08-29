import { describe, expect, it } from 'vitest';
import type { GameContext, WorldGraphDefinition, WorldGraphSave, WorldGraphService } from '@sw2d/contracts';
import { WORLD_GRAPH_CAPABILITY_ID, WorldGraphValidationError, validateWorldGraphDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { worldGraphPack } from '../src/worldGraph/worldGraphPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const DEF: WorldGraphDefinition = {
  schemaVersion: 1,
  id: 'w',
  startNodeId: 'a',
  nodes: [
    {
      id: 'a',
      displayName: 'A',
      level: 'levels/a',
      mapX: 0,
      mapY: 0,
      entrances: [{ id: 'start', x: 0, y: 0 }, { id: 'from-b', x: 10, y: 0 }],
      connections: [{ id: 'a-b', destinationNodeId: 'b', destinationEntranceId: 'from-a' }],
    },
    {
      id: 'b',
      displayName: 'B',
      level: 'levels/b',
      mapX: 1,
      mapY: 0,
      entrances: [{ id: 'from-a', x: 0, y: 0 }, { id: 'from-c', x: 20, y: 0 }],
      connections: [
        { id: 'b-a', destinationNodeId: 'a', destinationEntranceId: 'from-b' },
        { id: 'b-c', destinationNodeId: 'c', destinationEntranceId: 'from-b', conditions: [{ kind: 'flag', flag: 'gate', value: true }] },
      ],
    },
    {
      id: 'c',
      displayName: 'C',
      level: 'levels/c',
      mapX: 2,
      mapY: 0,
      entrances: [{ id: 'from-b', x: 0, y: 0 }],
      connections: [{ id: 'c-b', destinationNodeId: 'b', destinationEntranceId: 'from-c' }],
    },
  ],
};

interface Harness {
  svc: WorldGraphService;
  setFlag(flag: string, value: boolean): void;
  saveStore: Map<string, unknown>;
  dispose(): void;
}

function makeHarness(opts: { persist?: boolean; def?: WorldGraphDefinition } = {}): Harness {
  const capabilities = new FakeCapabilityRegistry();
  const flags = new Set<string>();
  capabilities.provide(CAPABILITY_IDS.world, { hasFlag: (f: string) => flags.has(f) });
  const saveStore = new Map<string, unknown>();
  const saves = {
    load: <T,>(slot: string, o: { createDefault: () => T }) => ({ value: (saveStore.get(slot) as T) ?? o.createDefault() }),
    save: <T,>(slot: string, value: T) => void saveStore.set(slot, value),
  };
  const ctx = {
    events: new FakeEventBus(),
    capabilities,
    content: { data: { 'world-graph': { schemaId: 'x', valid: true, value: opts.def ?? DEF } } },
    saves,
  } as unknown as GameContext;
  const installed = worldGraphPack.install(ctx, { persist: opts.persist ?? false });
  return {
    svc: capabilities.require<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID),
    setFlag: (f, v) => void (v ? flags.add(f) : flags.delete(f)),
    saveStore,
    dispose: () => installed.dispose(),
  };
}

describe('validateWorldGraphDefinition', () => {
  it('accepts a valid graph and rejects bad references / duplicates', () => {
    expect(() => validateWorldGraphDefinition(DEF)).not.toThrow();
    expect(() =>
      validateWorldGraphDefinition({ ...DEF, nodes: [...DEF.nodes, { ...DEF.nodes[0]! }] }),
    ).toThrow(WorldGraphValidationError);
    expect(() =>
      validateWorldGraphDefinition({
        ...DEF,
        nodes: [{ ...DEF.nodes[0]!, connections: [{ id: 'x', destinationNodeId: 'zzz', destinationEntranceId: 'q' }] }, DEF.nodes[1]!, DEF.nodes[2]!],
      }),
    ).toThrow(WorldGraphValidationError);
    expect(() => validateWorldGraphDefinition({ ...DEF, startNodeId: 'nope' })).toThrow(WorldGraphValidationError);
  });
});

describe('sw2d.world-graph', () => {
  it('publishes world.graph and starts at the start node, discovered + visited', () => {
    expect(WORLD_GRAPH_CAPABILITY_ID).toBe(CAPABILITY_IDS.worldGraph);
    expect(worldGraphPack.provides).toEqual([CAPABILITY_IDS.worldGraph]);
    const { svc } = makeHarness();
    expect(svc.currentNode().id).toBe('a');
    expect(svc.isDiscovered('a')).toBe(true);
    expect(svc.isVisited('a')).toBe(true);
    expect(svc.isDiscovered('b')).toBe(false);
  });

  it('a false condition blocks the transition; a true one allows it and updates discovery', () => {
    const { svc, setFlag } = makeHarness();
    svc.requestTransition('a-b');
    expect(svc.currentNode().id).toBe('b');
    expect(svc.isVisited('b')).toBe(true);

    const blocked = svc.requestTransition('b-c');
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('condition-failed');
    expect(blocked.failed).toEqual([{ kind: 'flag', flag: 'gate', value: true }]);
    expect(svc.currentNode().id).toBe('b');

    setFlag('gate', true);
    expect(svc.canTraverse('b-c').allowed).toBe(true);
    const ok = svc.requestTransition('b-c');
    expect(ok.ok).toBe(true);
    expect(ok.toNodeId).toBe('c');
    expect(ok.toEntranceId).toBe('from-b');
    expect(svc.currentNode().id).toBe('c');
    expect(svc.discoveredNodes()).toEqual(['a', 'b', 'c']);
  });

  it('an unknown connection is reported, not thrown', () => {
    const { svc } = makeHarness();
    expect(svc.requestTransition('nope')).toEqual({ ok: false, connectionId: 'nope', reason: 'unknown-connection' });
  });

  it('returning to a visited room keeps prior discovery; map state reflects the graph', () => {
    const { svc } = makeHarness();
    svc.requestTransition('a-b');
    svc.requestTransition('b-a');
    expect(svc.currentNode().id).toBe('a');
    const map = svc.mapState();
    expect(map.currentNodeId).toBe('a');
    expect(map.nodes.filter((n) => n.discovered).map((n) => n.id)).toEqual(['a', 'b']);
    expect(map.nodes.find((n) => n.id === 'a')!.current).toBe(true);
    expect(map.edges.find((e) => e.id === 'a-b')!.known).toBe(true); // both ends discovered
    expect(map.edges.find((e) => e.id === 'b-c')!.known).toBe(false);
  });

  it('reset returns to start with only start discovered', () => {
    const { svc } = makeHarness();
    svc.requestTransition('a-b');
    svc.reset();
    expect(svc.currentNode().id).toBe('a');
    expect(svc.discoveredNodes()).toEqual(['a']);
  });

  it('persistence round-trips ids only; a corrupt saved node falls back to start', () => {
    const first = makeHarness({ persist: true });
    first.setFlag('gate', true);
    first.svc.requestTransition('a-b');
    first.svc.requestTransition('b-c');
    expect(first.saveStore.get('world-graph')).toMatchObject({ currentNodeId: 'c', discovered: ['a', 'b', 'c'] });

    const second = makeHarness({ persist: true });
    // shares no store; simulate by injecting the first's save
    second.saveStore.set('world-graph', first.saveStore.get('world-graph'));
    const reload = makeHarness({ persist: true });
    reload.saveStore.set('world-graph', first.saveStore.get('world-graph'));
    // build a fresh service that loads that save
    const restored = makeHarness({ persist: true });
    restored.svc.loadSave(first.saveStore.get('world-graph') as WorldGraphSave);
    expect(restored.svc.currentNode().id).toBe('c');
    expect(restored.svc.visitedNodes()).toEqual(['a', 'b', 'c']);

    restored.svc.loadSave({ schemaVersion: 1, currentNodeId: 'ghost', discovered: ['a', 'ghost'], visited: ['a'] });
    expect(restored.svc.currentNode().id).toBe('a');
    expect(restored.svc.discoveredNodes()).toEqual(['a']);
  });

  it('installs inert (single root node) when no document is present', () => {
    const capabilities = new FakeCapabilityRegistry();
    const ctx = { events: new FakeEventBus(), capabilities, content: { data: {} } } as unknown as GameContext;
    worldGraphPack.install(ctx, {});
    const svc = capabilities.require<WorldGraphService>(WORLD_GRAPH_CAPABILITY_ID);
    expect(svc.currentNode().id).toBe('root');
    expect(svc.connections()).toEqual([]);
  });
});
