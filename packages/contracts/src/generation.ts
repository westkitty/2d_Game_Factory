/**
 * Deterministic procedural generation (capability program Phase 7).
 *
 * Renderer-neutral. A generator turns a bounded, content-authored config plus
 * a normalized seed into a `NormalizedLevel` - the exact structure the Tiled
 * pipeline already produces - so generated worlds flow through the identical
 * downstream path. No Phaser objects cross this boundary.
 *
 * Three bounded generator families, expanded by pure functions - not a
 * scripting language:
 *  - `segment-chain`  : endless / auto runners (horizontal segment stream)
 *  - `room-graph`     : dungeon-crawler / action-roguelite (room graph)
 *  - `road-chain`     : endless-driving (connected road segments)
 */

import type { NormalizedLevel, NormalizedLevelObject, NormalizedSolid } from './level.ts';

export const GENERATION_CAPABILITY_ID = 'world.generation';

// --- Seed ----------------------------------------------------------

/** The canonical seed representation: a normalized unsigned 32-bit integer. */
export type GenerationSeed = number;

const SEED_FALLBACK = 0x9e3779b9;

/**
 * Normalize any seed input to a stable uint32. A finite number is truncated
 * and masked; a string is FNV-1a hashed; anything else (NaN, Infinity, null,
 * object) deterministically falls back to a fixed constant. Never throws.
 */
export function normalizeSeed(input: unknown): GenerationSeed {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.abs(Math.trunc(input)) >>> 0;
  }
  if (typeof input === 'string' && input.length > 0) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  return SEED_FALLBACK;
}

// --- Seeded RNG --------------------------------------------------

export interface WeightedEntry<T> {
  readonly value: T;
  readonly weight: number;
}

export class GenerationRngError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationRngError';
  }
}

export interface SeededRng {
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Next integer in [0, maxExclusive). Throws for maxExclusive <= 0. */
  nextInt(maxExclusive: number): number;
  /** Uniform pick. Throws GenerationRngError for an empty list. */
  choose<T>(list: readonly T[]): T;
  /**
   * Weighted pick. Throws GenerationRngError for an empty list or when every
   * weight is <= 0 (there is no meaningful distribution). Negative individual
   * weights are clamped to 0.
   */
  weightedChoose<T>(entries: readonly WeightedEntry<T>[]): T;
}

/** Project-owned deterministic PRNG (mulberry32). No Math.random. */
export function createRng(seed: unknown): SeededRng {
  let state = normalizeSeed(seed);
  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    nextFloat,
    nextInt(maxExclusive: number): number {
      if (!(maxExclusive > 0)) throw new GenerationRngError(`nextInt requires maxExclusive > 0, got ${maxExclusive}`);
      return Math.floor(nextFloat() * maxExclusive);
    },
    choose<T>(list: readonly T[]): T {
      if (list.length === 0) throw new GenerationRngError('choose() on an empty list');
      return list[Math.floor(nextFloat() * list.length)]!;
    },
    weightedChoose<T>(entries: readonly WeightedEntry<T>[]): T {
      if (entries.length === 0) throw new GenerationRngError('weightedChoose() on an empty list');
      const weights = entries.map((e) => (e.weight > 0 ? e.weight : 0));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) throw new GenerationRngError('weightedChoose() with no positive weight');
      let roll = nextFloat() * total;
      for (let i = 0; i < entries.length; i++) {
        roll -= weights[i]!;
        if (roll < 0) return entries[i]!.value;
      }
      return entries[entries.length - 1]!.value;
    },
  };
}

// --- Bounded templates (content-authorable) --------------------

/** A horizontal runner segment. The generator expands it into solids/objects. */
export interface SegmentTemplate {
  readonly id: string;
  readonly entrySocket: string;
  readonly exitSocket: string;
  readonly weight: number;
  /** Difficulty band; a segment is eligible when band <= the requested difficulty. */
  readonly difficulty: number;
  readonly tags: readonly string[];
  /** Horizontal extent in world units. */
  readonly length: number;
  /** World-y of this segment's ground top. */
  readonly groundY: number;
  /** Optional pit: no ground between [gapStart, gapStart+gapWidth). */
  readonly gapStart?: number;
  readonly gapWidth?: number;
  /** Hazard tile x-offsets within the segment. */
  readonly hazards?: readonly number[];
  /** Collectible x-offsets within the segment. */
  readonly collectibles?: readonly number[];
  /** Max times this template may appear back-to-back (default 1). */
  readonly maxRepeat?: number;
}

export interface SegmentChainConfig {
  readonly kind: 'segment-chain';
  /** Present when this config is a document entry; used for the manifest's generatorId. */
  readonly id?: string;
  readonly templates: readonly SegmentTemplate[];
  /** Number of segments to chain. */
  readonly count: number;
  /** Only templates with difficulty <= this are eligible (default: no filter). */
  readonly difficulty?: number;
  /** A start template must carry one of these tags (default: tag 'start'). */
  readonly startTags?: readonly string[];
  /** Global cap on identical consecutive templates (default 2). */
  readonly maxImmediateRepeat?: number;
}

export type DoorSide = 'n' | 's' | 'e' | 'w';

export interface RoomTemplate {
  readonly id: string;
  /** Which walls carry a doorway. */
  readonly doors: readonly DoorSide[];
  readonly width: number;
  readonly height: number;
  readonly weight: number;
  readonly tags: readonly string[];
  /** Number of Enemy objects the generator scatters deterministically. */
  readonly enemies?: number;
}

export interface RoomGraphConfig {
  readonly kind: 'room-graph';
  readonly id?: string;
  readonly templates: readonly RoomTemplate[];
  /** Total rooms (critical path + branches), best-effort within bounds. */
  readonly roomCount: number;
  readonly criticalPathLength: number;
  readonly maxBranches: number;
  /** Start room must carry one of these tags (default: tag 'start'). */
  readonly startTags?: readonly string[];
  /** Exit room must carry one of these tags (default: tag 'exit'). */
  readonly exitTags?: readonly string[];
  /** Every listed tag must appear on at least one placed room. */
  readonly requiredTags?: readonly string[];
  /** Bounded deterministic retry budget when a candidate graph fails validation (default 8). */
  readonly maxRetries?: number;
}

export interface RoadSegmentTemplate {
  readonly id: string;
  /** Heading in degrees the segment expects to be entered / left at. */
  readonly entryHeading: number;
  readonly exitHeading: number;
  readonly length: number;
  readonly width: number;
  readonly weight: number;
  readonly difficulty: number;
  readonly tags: readonly string[];
  /** Obstacle solid x-offsets within the segment. */
  readonly obstacles?: readonly number[];
}

export interface RoadChainConfig {
  readonly kind: 'road-chain';
  readonly id?: string;
  readonly templates: readonly RoadSegmentTemplate[];
  readonly count: number;
  readonly difficulty?: number;
}

export type GeneratorConfig = SegmentChainConfig | RoomGraphConfig | RoadChainConfig;
export type GeneratorKind = GeneratorConfig['kind'];

export interface GenerationDoc {
  readonly schemaVersion: number;
  /** Base seed for every generator in this document. */
  readonly seed: number;
  readonly generators: readonly ({ readonly id: string } & GeneratorConfig)[];
}

// --- Generation context / result / manifest -------------------

export interface GenerationContext {
  readonly seed: GenerationSeed;
  readonly generatorId: string;
  readonly kind: GeneratorKind;
  /** Requested size/count (segments or rooms). */
  readonly size: number;
  readonly difficulty?: number;
  readonly templateIds: readonly string[];
}

export interface GenerationGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly viaDoor: DoorSide;
}

export interface GenerationManifest {
  readonly seed: GenerationSeed;
  readonly generatorId: string;
  readonly kind: GeneratorKind;
  /** Template ids in generation order (segment/road chain) or room placement order (graph). */
  readonly chosenTemplates: readonly string[];
  /** For room-graph: the placed node ids and their connections. Empty for chains. */
  readonly graph: { readonly nodes: readonly string[]; readonly edges: readonly GenerationGraphEdge[] };
  /** Salient generation parameters, echoed for reproducibility. */
  readonly params: Readonly<Record<string, number | string | boolean>>;
  readonly retries: number;
}

export interface GenerationValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface GenerationResult<T = NormalizedLevel> {
  readonly output: T;
  readonly manifest: GenerationManifest;
  readonly validation: GenerationValidationResult;
}

// --- Service --------------------------------------------------

export interface GenerationRunOptions {
  /** Override the document's base seed. */
  readonly seed?: unknown;
  /** Override the config's count / roomCount. */
  readonly size?: number;
  /** Override the config's difficulty. */
  readonly difficulty?: number;
}

export interface GenerationService {
  /** Ids of every generator in the loaded document. */
  availableGenerators(): readonly string[];
  normalizeSeed(input: unknown): GenerationSeed;
  /** Run one generator. Deterministic for a given (generatorId, effective seed, size, difficulty). */
  generate(generatorId: string, options?: GenerationRunOptions): GenerationResult;
  /** Re-check a result's output against its kind's structural rules. */
  validate(result: GenerationResult): GenerationValidationResult;
}

export class UnknownGeneratorError extends Error {
  constructor(id: string) {
    super(`No generator defined with id "${id}" in content/generation.json.`);
    this.name = 'UnknownGeneratorError';
  }
}

// --- Pure helpers -------------------------------------------

const EMPTY_LEVEL = (id: string): NormalizedLevel => ({
  schemaVersion: 1,
  id,
  mapWidth: 0,
  mapHeight: 0,
  tileWidth: 32,
  tileHeight: 32,
  tileLayers: [],
  solids: [],
  objects: [],
});

/** A per-call object-id allocator - no module-level mutable state, so two
 * concurrent generate() calls can never interleave ids. */
function makeObjFactory(): (
  className: string,
  x: number,
  y: number,
  width: number,
  height: number,
  properties?: Record<string, string | number | boolean>,
) => NormalizedLevelObject {
  let id = 1;
  return (className, x, y, width, height, properties = {}) => ({
    id: id++,
    class: className,
    name: className,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    properties,
  });
}

/**
 * Expand a `segment-chain` config into a NormalizedLevel plus a manifest.
 * Pure and deterministic.
 */
export function generateSegmentChain(
  config: SegmentChainConfig,
  seed: unknown,
  levelId: string,
  overrides: { size?: number; difficulty?: number } = {},
): GenerationResult {
  const rng = createRng(seed);
  const obj = makeObjFactory();
  const normSeed = normalizeSeed(seed);
  const count = Math.max(1, Math.trunc(overrides.size ?? config.count));
  const difficulty = overrides.difficulty ?? config.difficulty;
  const startTags = config.startTags ?? ['start'];
  const maxImmediate = config.maxImmediateRepeat ?? 2;
  const errors: string[] = [];
  const chosen: string[] = [];
  const solids: NormalizedSolid[] = [];
  const objects: NormalizedLevelObject[] = [];

  const eligibleByDifficulty = (t: SegmentTemplate): boolean => difficulty === undefined || t.difficulty <= difficulty;

  const startPool = config.templates.filter((t) => startTags.some((tag) => t.tags.includes(tag)) && eligibleByDifficulty(t));
  const firstPool = startPool.length > 0 ? startPool : config.templates.filter(eligibleByDifficulty);
  if (firstPool.length === 0) {
    return {
      output: EMPTY_LEVEL(levelId),
      manifest: manifestFor(normSeed, 'segment-chain', config.id ?? levelId, [], { count, difficulty: difficulty ?? -1 }, 0),
      validation: { valid: false, errors: ['no eligible start template'] },
    };
  }

  let cursorX = 0;
  let currentExit: string | null = null;
  const recent: string[] = [];

  for (let i = 0; i < count; i++) {
    const exitSocket = currentExit;
    let pool: SegmentTemplate[] =
      exitSocket === null
        ? [...firstPool]
        : config.templates.filter((t) => t.entrySocket === exitSocket && eligibleByDifficulty(t));
    // repetition policy
    pool = pool.filter((t) => {
      const cap = t.maxRepeat ?? 1;
      let run = 0;
      for (let k = recent.length - 1; k >= 0 && recent[k] === t.id; k--) run++;
      return run < cap && !(recent.slice(-maxImmediate).every((r) => r === t.id) && recent.length >= maxImmediate);
    });
    if (pool.length === 0) {
      errors.push(`no eligible segment after "${currentExit ?? '(start)'}" at index ${i}`);
      break;
    }
    const pick = rng.weightedChoose(pool.map((t) => ({ value: t, weight: t.weight })));
    chosen.push(pick.id);
    recent.push(pick.id);

    // expand
    const gy = pick.groundY;
    if (pick.gapStart !== undefined && pick.gapWidth !== undefined && pick.gapWidth > 0) {
      const g0 = Math.max(0, pick.gapStart);
      if (g0 > 0) solids.push({ x: cursorX, y: gy, width: g0, height: 40 });
      const after = g0 + pick.gapWidth;
      if (after < pick.length) solids.push({ x: cursorX + after, y: gy, width: pick.length - after, height: 40 });
    } else {
      solids.push({ x: cursorX, y: gy, width: pick.length, height: 40 });
    }
    if (i === 0) {
      objects.push(obj('PlayerSpawn', cursorX + 20, gy - 60, 0, 0, { facing: 'right' }));
    }
    for (const hx of pick.hazards ?? []) objects.push(obj('Hazard', cursorX + hx, gy - 18, 24, 18, { damage: 10 }));
    for (const cx of pick.collectibles ?? []) objects.push(obj('Collectible', cursorX + cx, gy - 48, 16, 16, { itemId: 'coin-1', value: 5 }));

    cursorX += pick.length;
    currentExit = pick.exitSocket;
  }

  objects.push(obj('Exit', cursorX - 24, (solids[solids.length - 1]?.y ?? 500) - 48, 24, 48, { exitId: 'exit-1' }));

  const output: NormalizedLevel = {
    ...EMPTY_LEVEL(levelId),
    mapWidth: Math.ceil(cursorX / 32),
    mapHeight: 20,
    solids,
    objects,
  };
  const validation = validateSegmentChain(output, chosen.length, count, errors);
  return {
    output,
    manifest: manifestFor(normSeed, 'segment-chain', config.id ?? levelId, chosen, { count, difficulty: difficulty ?? -1 }, 0),
    validation,
  };
}

function validateSegmentChain(
  level: NormalizedLevel,
  produced: number,
  requested: number,
  priorErrors: readonly string[],
): GenerationValidationResult {
  const errors = [...priorErrors];
  if (level.solids.length === 0) errors.push('no ground produced');
  if (produced < requested) errors.push(`only ${produced}/${requested} segments chained`);
  if (!level.objects.some((o) => o.class === 'PlayerSpawn')) errors.push('no safe player spawn');
  // connectivity: sort solids by x; consecutive ground pieces must not leave an
  // un-jumpable void wider than 220 units (a runner gap budget).
  const grounds = level.solids.filter((s) => s.height >= 20).sort((a, b) => a.x - b.x);
  for (let i = 1; i < grounds.length; i++) {
    const prev = grounds[i - 1]!;
    const gap = grounds[i]!.x - (prev.x + prev.width);
    if (gap > 220) errors.push(`un-traversable gap of ${gap} at x=${prev.x + prev.width}`);
  }
  return { valid: errors.length === 0, errors };
}

function manifestFor(
  seed: number,
  kind: GeneratorKind,
  generatorId: string,
  chosenTemplates: readonly string[],
  params: Record<string, number | string | boolean>,
  retries: number,
  graph: GenerationManifest['graph'] = { nodes: [], edges: [] },
): GenerationManifest {
  return { seed, generatorId, kind, chosenTemplates, graph, params, retries };
}

const OPPOSITE: Readonly<Record<DoorSide, DoorSide>> = { n: 's', s: 'n', e: 'w', w: 'e' };
const DELTA: Readonly<Record<DoorSide, readonly [number, number]>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Expand a `room-graph` config into a NormalizedLevel plus a manifest. Pure and deterministic. */
export function generateRoomGraph(
  config: RoomGraphConfig,
  seed: unknown,
  levelId: string,
  overrides: { size?: number; difficulty?: number } = {},
): GenerationResult {
  const normSeed = normalizeSeed(seed);
  const startTags = config.startTags ?? ['start'];
  const exitTags = config.exitTags ?? ['exit'];
  const roomCount = Math.max(2, Math.trunc(overrides.size ?? config.roomCount));
  const critical = Math.max(2, Math.min(config.criticalPathLength, roomCount));
  const maxRetries = Math.max(0, config.maxRetries ?? 8);

  const ROOM_W = 320;
  const ROOM_H = 240;

  interface Placed {
    id: string;
    template: RoomTemplate;
    cx: number;
    cy: number;
  }

  let attempt = 0;
  let lastErrors: string[] = ['unset'];
  for (; attempt <= maxRetries; attempt++) {
    const rng = createRng((normSeed + attempt * 0x9e3779b9) >>> 0);
    const placed: Placed[] = [];
    const occupied = new Map<string, Placed>();
    const edges: GenerationGraphEdge[] = [];
    const key = (x: number, y: number): string => `${x},${y}`;

    const startPool = config.templates.filter((t) => startTags.some((tg) => t.tags.includes(tg)));
    if (startPool.length === 0) {
      lastErrors = ['no start-room template'];
      break;
    }
    const startTemplate = rng.weightedChoose(startPool.map((t) => ({ value: t, weight: t.weight })));
    const start: Placed = { id: 'r0', template: startTemplate, cx: 0, cy: 0 };
    placed.push(start);
    occupied.set(key(0, 0), start);

    const extendFrom = (from: Placed, wantTags: readonly string[] | null): Placed | null => {
      const openSides = from.template.doors.filter((d) => !occupied.has(key(from.cx + DELTA[d][0], from.cy + DELTA[d][1])));
      if (openSides.length === 0) return null;
      const side = rng.choose(openSides);
      const nx = from.cx + DELTA[side][0];
      const ny = from.cy + DELTA[side][1];
      const need = OPPOSITE[side];
      let pool = config.templates.filter((t) => t.doors.includes(need));
      if (wantTags) pool = pool.filter((t) => wantTags.some((tg) => t.tags.includes(tg)));
      if (pool.length === 0) return null;
      const tpl = rng.weightedChoose(pool.map((t) => ({ value: t, weight: t.weight })));
      const room: Placed = { id: `r${placed.length}`, template: tpl, cx: nx, cy: ny };
      placed.push(room);
      occupied.set(key(nx, ny), room);
      edges.push({ from: from.id, to: room.id, viaDoor: side });
      return room;
    };

    // critical path
    let cursor = start;
    let brokePath = false;
    for (let i = 1; i < critical; i++) {
      const isLast = i === critical - 1;
      const next = extendFrom(cursor, isLast ? exitTags : null);
      if (!next) {
        brokePath = true;
        break;
      }
      cursor = next;
    }
    const exitRoom = cursor;

    // bounded branches
    let branches = 0;
    let guard = 0;
    while (placed.length < roomCount && branches < config.maxBranches && guard++ < roomCount * 4) {
      const anchor = rng.choose(placed);
      if (extendFrom(anchor, null)) branches++;
    }

    // validation
    const errors: string[] = [];
    if (brokePath) errors.push('critical path could not be completed');
    if (!exitTags.some((tg) => exitRoom.template.tags.includes(tg))) errors.push('exit room lacks an exit tag');
    // connectivity BFS
    const adj = new Map<string, string[]>();
    const link = (a: string, b: string): void => {
      const list = adj.get(a);
      if (list) list.push(b);
      else adj.set(a, [b]);
    };
    for (const e of edges) {
      link(e.from, e.to);
      link(e.to, e.from);
    }
    const seen = new Set<string>(['r0']);
    const stack = ['r0'];
    while (stack.length) {
      const n = stack.pop()!;
      for (const m of adj.get(n) ?? []) {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    if (seen.size !== placed.length) errors.push(`graph not fully connected (${seen.size}/${placed.length})`);
    if (!seen.has(exitRoom.id)) errors.push('exit not reachable from start');
    for (const tag of config.requiredTags ?? []) {
      if (!placed.some((p) => p.template.tags.includes(tag))) errors.push(`required tag "${tag}" absent`);
    }

    if (errors.length === 0) {
      // materialize
      const obj = makeObjFactory();
      const solids: NormalizedSolid[] = [];
      const objects: NormalizedLevelObject[] = [];
      let minX = 0;
      let minY = 0;
      for (const p of placed) {
        minX = Math.min(minX, p.cx);
        minY = Math.min(minY, p.cy);
      }
      const roomRng = createRng((normSeed + 777) >>> 0);
      for (const p of placed) {
        const ox = (p.cx - minX) * ROOM_W;
        const oy = (p.cy - minY) * ROOM_H;
        const t = 16;
        const doorGap = 64;
        const connectedSides = new Set<DoorSide>();
        for (const e of edges) {
          if (e.from === p.id) connectedSides.add(e.viaDoor);
          if (e.to === p.id) connectedSides.add(OPPOSITE[e.viaDoor]);
        }
        // four walls, each split around a centered doorway when connected
        const wall = (side: DoorSide): void => {
          const horiz = side === 'n' || side === 's';
          const wy = side === 'n' ? oy : side === 's' ? oy + ROOM_H - t : oy;
          const wx = side === 'w' ? ox : side === 'e' ? ox + ROOM_W - t : ox;
          if (!connectedSides.has(side)) {
            solids.push(horiz ? { x: ox, y: wy, width: ROOM_W, height: t } : { x: wx, y: oy, width: t, height: ROOM_H });
            return;
          }
          if (horiz) {
            const half = (ROOM_W - doorGap) / 2;
            solids.push({ x: ox, y: wy, width: half, height: t });
            solids.push({ x: ox + half + doorGap, y: wy, width: half, height: t });
          } else {
            const half = (ROOM_H - doorGap) / 2;
            solids.push({ x: wx, y: oy, width: t, height: half });
            solids.push({ x: wx, y: oy + half + doorGap, width: t, height: half });
          }
        };
        (['n', 's', 'e', 'w'] as DoorSide[]).forEach(wall);

        if (p.id === 'r0') objects.push(obj('PlayerSpawn', ox + ROOM_W / 2, oy + ROOM_H / 2, 0, 0, { facing: 'right' }));
        if (p.id === exitRoom.id && p.id !== 'r0') objects.push(obj('Exit', ox + ROOM_W / 2, oy + ROOM_H / 2, 24, 24, { exitId: 'exit-1' }));
        const enemies = p.template.enemies ?? 0;
        for (let e = 0; e < enemies; e++) {
          objects.push(
            obj('Enemy', ox + 60 + roomRng.nextInt(Math.max(1, ROOM_W - 120)), oy + 60 + roomRng.nextInt(Math.max(1, ROOM_H - 120)), 24, 24, {
              enemyType: 'grunt',
            }),
          );
        }
      }
      let maxX = 0;
      let maxY = 0;
      for (const p of placed) {
        maxX = Math.max(maxX, (p.cx - minX) * ROOM_W + ROOM_W);
        maxY = Math.max(maxY, (p.cy - minY) * ROOM_H + ROOM_H);
      }
      const output: NormalizedLevel = {
        ...EMPTY_LEVEL(levelId),
        mapWidth: Math.ceil(maxX / 32),
        mapHeight: Math.ceil(maxY / 32),
        solids,
        objects,
      };
      return {
        output,
        manifest: manifestFor(
          normSeed,
          'room-graph',
          config.id ?? levelId,
          placed.map((p) => p.template.id),
          { roomCount: placed.length, criticalPathLength: critical, maxBranches: config.maxBranches },
          attempt,
          { nodes: placed.map((p) => p.id), edges },
        ),
        validation: { valid: true, errors: [] },
      };
    }
    lastErrors = errors;
  }

  return {
    output: EMPTY_LEVEL(levelId),
    manifest: manifestFor(normSeed, 'room-graph', config.id ?? levelId, [], { roomCount, criticalPathLength: critical, maxBranches: config.maxBranches }, attempt),
    validation: { valid: false, errors: lastErrors },
  };
}

/** Expand a `road-chain` config into a NormalizedLevel plus a manifest. Pure and deterministic. */
export function generateRoadChain(
  config: RoadChainConfig,
  seed: unknown,
  levelId: string,
  overrides: { size?: number; difficulty?: number } = {},
): GenerationResult {
  const rng = createRng(seed);
  const obj = makeObjFactory();
  const normSeed = normalizeSeed(seed);
  const count = Math.max(1, Math.trunc(overrides.size ?? config.count));
  const difficulty = overrides.difficulty ?? config.difficulty;
  const eligible = (t: RoadSegmentTemplate): boolean => difficulty === undefined || t.difficulty <= difficulty;
  const errors: string[] = [];
  const chosen: string[] = [];
  const solids: NormalizedSolid[] = [];
  const objects: NormalizedLevelObject[] = [];

  const startPool = config.templates.filter((t) => t.entryHeading === 0 && eligible(t));
  const firstPool = startPool.length > 0 ? startPool : config.templates.filter(eligible);
  if (firstPool.length === 0) {
    return {
      output: EMPTY_LEVEL(levelId),
      manifest: manifestFor(normSeed, 'road-chain', config.id ?? levelId, [], { count, difficulty: difficulty ?? -1 }, 0),
      validation: { valid: false, errors: ['no eligible road segment'] },
    };
  }

  let cursorY = 0;
  let currentHeading: number | null = null;
  for (let i = 0; i < count; i++) {
    const heading = currentHeading;
    const pool: RoadSegmentTemplate[] =
      heading === null ? [...firstPool] : config.templates.filter((t) => t.entryHeading === heading && eligible(t));
    if (pool.length === 0) {
      errors.push(`no road segment matching heading ${currentHeading} at index ${i}`);
      break;
    }
    const pick = rng.weightedChoose(pool.map((t) => ({ value: t, weight: t.weight })));
    chosen.push(pick.id);
    // road runs "up" the screen: each segment is a vertical strip of collision on both shoulders
    const laneLeft = 480 - pick.width / 2;
    solids.push({ x: laneLeft - 16, y: cursorY - pick.length, width: 16, height: pick.length });
    solids.push({ x: laneLeft + pick.width, y: cursorY - pick.length, width: 16, height: pick.length });
    if (i === 0) objects.push(obj('PlayerSpawn', 480, cursorY - 40, 0, 0, { facing: 'up' }));
    for (const ox of pick.obstacles ?? []) objects.push(obj('Hazard', laneLeft + ox, cursorY - pick.length / 2, 28, 28, { damage: 10 }));
    cursorY -= pick.length;
    currentHeading = pick.exitHeading;
  }

  const valid = errors.length === 0 && solids.length >= 2 && objects.some((o) => o.class === 'PlayerSpawn');
  if (!valid && errors.length === 0) errors.push('road chain produced no drivable strip');
  const output: NormalizedLevel = { ...EMPTY_LEVEL(levelId), mapWidth: 30, mapHeight: Math.ceil(Math.abs(cursorY) / 32), solids, objects };
  return {
    output,
    manifest: manifestFor(normSeed, 'road-chain', config.id ?? levelId, chosen, { count, difficulty: difficulty ?? -1 }, 0),
    validation: { valid, errors },
  };
}

/** Dispatch on kind. */
export function runGenerator(
  config: { readonly id: string } & GeneratorConfig,
  seed: unknown,
  levelId: string,
  overrides: { size?: number; difficulty?: number } = {},
): GenerationResult {
  switch (config.kind) {
    case 'segment-chain':
      return generateSegmentChain(config, seed, levelId, overrides);
    case 'room-graph':
      return generateRoomGraph(config, seed, levelId, overrides);
    case 'road-chain':
      return generateRoadChain(config, seed, levelId, overrides);
  }
}

/** Structural re-validation of an already-produced result. */
export function validateGenerationResult(result: GenerationResult): GenerationValidationResult {
  const level = result.output;
  const errors: string[] = [];
  if (level.solids.length === 0) errors.push('no collision geometry');
  if (result.manifest.kind !== 'road-chain' && !level.objects.some((o) => o.class === 'PlayerSpawn')) {
    errors.push('no player spawn');
  }
  if (result.manifest.kind === 'room-graph') {
    if (!level.objects.some((o) => o.class === 'Exit')) errors.push('no exit object');
  }
  return { valid: errors.length === 0, errors };
}
