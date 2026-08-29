import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  GenerationRngError,
  generateRoadChain,
  generateRoomGraph,
  generateSegmentChain,
  normalizeSeed,
  runGenerator,
  validateGenerationResult,
  type RoadChainConfig,
  type RoomGraphConfig,
  type SegmentChainConfig,
} from '../src/generation.ts';

// --- Seed + RNG ------------------------------------------------

describe('normalizeSeed', () => {
  it('is stable for numbers, strings, and rejects garbage deterministically', () => {
    expect(normalizeSeed(42)).toBe(42);
    expect(normalizeSeed(-42.9)).toBe(42);
    expect(normalizeSeed('abc')).toBe(normalizeSeed('abc'));
    expect(normalizeSeed('abc')).not.toBe(normalizeSeed('abd'));
    const fallback = normalizeSeed(NaN);
    expect(normalizeSeed(Infinity)).toBe(fallback);
    expect(normalizeSeed(null)).toBe(fallback);
    expect(normalizeSeed({})).toBe(fallback);
  });
});

describe('createRng', () => {
  it('same seed yields an identical sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 20 }, () => a.nextFloat());
    const seqB = Array.from({ length: 20 }, () => b.nextFloat());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds usually diverge', () => {
    const a = Array.from({ length: 10 }, (_, i) => createRng(i).nextFloat());
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it('nextInt rejects a non-positive bound; choose rejects an empty list', () => {
    const r = createRng(1);
    expect(() => r.nextInt(0)).toThrow(GenerationRngError);
    expect(() => r.choose([])).toThrow(GenerationRngError);
  });

  it('weightedChoose is deterministic and rejects a no-positive-weight distribution', () => {
    const entries = [
      { value: 'a', weight: 1 },
      { value: 'b', weight: 3 },
      { value: 'c', weight: 0 },
    ];
    const r1 = createRng(7);
    const r2 = createRng(7);
    const picks1 = Array.from({ length: 30 }, () => r1.weightedChoose(entries));
    const picks2 = Array.from({ length: 30 }, () => r2.weightedChoose(entries));
    expect(picks1).toEqual(picks2);
    expect(picks1).not.toContain('c'); // zero weight never chosen
    expect(() => createRng(1).weightedChoose([{ value: 'x', weight: 0 }])).toThrow(GenerationRngError);
    expect(() => createRng(1).weightedChoose([{ value: 'x', weight: -5 }])).toThrow(GenerationRngError);
  });
});

// --- Segment chain ---------------------------------------------

const SEG: SegmentChainConfig = {
  kind: 'segment-chain',
  id: 'run',
  count: 12,
  startTags: ['start'],
  maxImmediateRepeat: 2,
  templates: [
    { id: 'start-flat', entrySocket: 'g', exitSocket: 'g', weight: 1, difficulty: 0, tags: ['start'], length: 300, groundY: 480 },
    { id: 'flat', entrySocket: 'g', exitSocket: 'g', weight: 3, difficulty: 0, tags: ['run'], length: 280, groundY: 480, collectibles: [100] },
    { id: 'gap', entrySocket: 'g', exitSocket: 'g', weight: 2, difficulty: 1, tags: ['run'], length: 320, groundY: 480, gapStart: 120, gapWidth: 100 },
  ],
};

describe('generateSegmentChain', () => {
  it('same seed/config yields an identical manifest and output', () => {
    const a = generateSegmentChain(SEG, 999, 'main');
    const b = generateSegmentChain(SEG, 999, 'main');
    expect(a.manifest).toEqual(b.manifest);
    expect(a.output).toEqual(b.output);
    expect(a.validation.valid).toBe(true);
    expect(a.manifest.chosenTemplates).toHaveLength(12);
  });

  it('different seeds normally produce a different template sequence', () => {
    const seqs = new Set([1, 2, 3, 4, 5].map((s) => generateSegmentChain(SEG, s, 'main').manifest.chosenTemplates.join(',')));
    expect(seqs.size).toBeGreaterThan(1);
  });

  it('every segment connects to the previous one (no un-jumpable void)', () => {
    const r = generateSegmentChain(SEG, 55, 'main');
    expect(r.validation.errors).toEqual([]);
    // first template must be a start-tagged one
    expect(r.manifest.chosenTemplates[0]).toBe('start-flat');
  });

  it('a spawn is placed and an exit object is appended', () => {
    const r = generateSegmentChain(SEG, 7, 'main');
    expect(r.output.objects.some((o) => o.class === 'PlayerSpawn')).toBe(true);
    expect(r.output.objects.some((o) => o.class === 'Exit')).toBe(true);
  });

  it('honours the immediate-repeat cap', () => {
    const r = generateSegmentChain({ ...SEG, count: 40 }, 3, 'main');
    const ids = r.manifest.chosenTemplates;
    for (let i = 2; i < ids.length; i++) {
      expect(ids[i] === ids[i - 1] && ids[i - 1] === ids[i - 2]).toBe(false);
    }
  });

  it('an impossible template set fails explicitly rather than emitting garbage', () => {
    const impossible: SegmentChainConfig = {
      kind: 'segment-chain',
      count: 5,
      templates: [{ id: 'only', entrySocket: 'a', exitSocket: 'b', weight: 1, difficulty: 0, tags: ['start'], length: 200, groundY: 480 }],
    };
    const r = generateSegmentChain(impossible, 1, 'main');
    expect(r.validation.valid).toBe(false);
    expect(r.validation.errors.length).toBeGreaterThan(0);
  });
});

// --- Room graph ----------------------------------------------

const DUNGEON: RoomGraphConfig = {
  kind: 'room-graph',
  id: 'dungeon',
  roomCount: 6,
  criticalPathLength: 4,
  maxBranches: 2,
  startTags: ['start'],
  exitTags: ['exit'],
  templates: [
    { id: 'start-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['start'] },
    { id: 'hall', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 3, tags: ['path'], enemies: 2 },
    { id: 'exit-room', doors: ['n', 's', 'e', 'w'], width: 320, height: 240, weight: 1, tags: ['exit'] },
  ],
};

describe('generateRoomGraph', () => {
  it('same seed yields an identical room graph + template selection', () => {
    const a = generateRoomGraph(DUNGEON, 4242, 'main');
    const b = generateRoomGraph(DUNGEON, 4242, 'main');
    expect(a.manifest).toEqual(b.manifest);
    expect(a.output).toEqual(b.output);
  });

  it('produces a connected graph with a start room, an exit room, and start->exit reachability', () => {
    const r = generateRoomGraph(DUNGEON, 4242, 'main');
    expect(r.validation.valid).toBe(true);
    expect(r.manifest.graph.nodes).toContain('r0');
    expect(r.manifest.graph.nodes.length).toBeGreaterThanOrEqual(4);
    // every edge references placed nodes
    for (const e of r.manifest.graph.edges) {
      expect(r.manifest.graph.nodes).toContain(e.from);
      expect(r.manifest.graph.nodes).toContain(e.to);
    }
    expect(r.output.objects.some((o) => o.class === 'PlayerSpawn')).toBe(true);
    expect(r.output.objects.some((o) => o.class === 'Exit')).toBe(true);
    // BFS reachability from r0 to every node
    const adj = new Map<string, string[]>();
    for (const e of r.manifest.graph.edges) {
      (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to);
      (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push(e.from);
    }
    const seen = new Set(['r0']);
    const stack = ['r0'];
    while (stack.length) {
      const n = stack.pop()!;
      for (const m of adj.get(n) ?? []) if (!seen.has(m)) (seen.add(m), stack.push(m));
    }
    expect(seen.size).toBe(r.manifest.graph.nodes.length);
  });

  it('retries are bounded and an unsatisfiable config fails after the budget', () => {
    const noExit: RoomGraphConfig = {
      ...DUNGEON,
      templates: [{ id: 'start-room', doors: ['n'], width: 320, height: 240, weight: 1, tags: ['start'] }],
      maxRetries: 3,
    };
    const r = generateRoomGraph(noExit, 1, 'main');
    expect(r.validation.valid).toBe(false);
    expect(r.manifest.retries).toBeLessThanOrEqual(4);
  });
});

// --- Road chain --------------------------------------------

const ROAD: RoadChainConfig = {
  kind: 'road-chain',
  id: 'road',
  count: 10,
  templates: [
    { id: 'straight', entryHeading: 0, exitHeading: 0, length: 240, width: 200, weight: 4, difficulty: 0, tags: ['road'] },
    { id: 'straight-obs', entryHeading: 0, exitHeading: 0, length: 240, width: 200, weight: 2, difficulty: 1, tags: ['road'], obstacles: [70] },
  ],
};

describe('generateRoadChain', () => {
  it('same seed yields an identical connected road', () => {
    const a = generateRoadChain(ROAD, 909, 'main');
    const b = generateRoadChain(ROAD, 909, 'main');
    expect(a.output).toEqual(b.output);
    expect(a.validation.valid).toBe(true);
    expect(a.manifest.chosenTemplates).toHaveLength(10);
    expect(a.output.objects.some((o) => o.class === 'PlayerSpawn')).toBe(true);
  });

  it('an incompatible-heading template set fails explicitly', () => {
    const bad: RoadChainConfig = {
      kind: 'road-chain',
      count: 4,
      templates: [{ id: 's', entryHeading: 0, exitHeading: 90, length: 200, width: 180, weight: 1, difficulty: 0, tags: ['road'] }],
    };
    const r = generateRoadChain(bad, 1, 'main');
    expect(r.validation.valid).toBe(false);
  });
});

describe('runGenerator + validateGenerationResult', () => {
  it('dispatches by kind and re-validation agrees', () => {
    const seg = runGenerator({ ...SEG, id: 'run' }, 21, 'main');
    expect(seg.manifest.kind).toBe('segment-chain');
    expect(validateGenerationResult(seg).valid).toBe(true);

    const dun = runGenerator({ ...DUNGEON, id: 'dungeon' }, 21, 'main');
    expect(dun.manifest.kind).toBe('room-graph');
    expect(validateGenerationResult(dun).valid).toBe(true);
  });

  it('no reusable generation path calls Math.random / Date.now / timers (comments excluded)', () => {
    const src = readFileSync(new URL('../src/generation.ts', import.meta.url), 'utf8');
    const code = src
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return t.length > 0 && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
      })
      .join('\n');
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
    expect(code).not.toMatch(/\bset(Timeout|Interval)\b/);
  });
});
