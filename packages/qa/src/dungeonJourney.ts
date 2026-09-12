import type { Harness } from './harness.ts';
import { readShellState } from './snapshot.ts';

/**
 * Shared journey verbs for the room-graph dungeon starters (dungeon-crawler,
 * action-roguelite - Final Product Completion Wave 2). The generated top-down
 * shell contributes the generation manifest (room ids + door edges) and the
 * dungeon snapshot (player, enemies with rooms and agent states, exit); this
 * module turns those into "walk to that room / enemy / exit" steps by
 * reconstructing the 320x240 room grid from the door graph and routing
 * through doorways. It asserts nothing - a spec owns its oracle.
 */

export interface DungeonEnemy {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly room: string;
  readonly state: string;
}

export interface DungeonSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly playerHealth: number;
  readonly playerMaxHealth: number;
  readonly enemiesAlive: number;
  readonly enemiesTotal: number;
  readonly room: string;
  readonly roomsVisited: number;
  readonly roomsWithEnemies: number;
  readonly roomsCleared: number;
  readonly states: { readonly idle: number; readonly chase: number; readonly patrol: number };
  readonly nearId: string | null;
  readonly exitOpen: boolean;
  readonly currency: number;
  readonly kills: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly exitX: number;
  readonly exitY: number;
  readonly enemies: readonly DungeonEnemy[];
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly run: {
    readonly index: number;
    readonly phase: string;
    readonly cause: string | null;
    readonly metaEarned: number;
    readonly metaCurrency: number;
    readonly unlocked: readonly string[];
    readonly nextUnlock: string | null;
    readonly loadout: { readonly maxHealthBonus: number; readonly damageBonus: number };
    readonly loadOutcome: string;
  } | null;
}

export interface DungeonShell {
  readonly x: number;
  readonly y: number;
  readonly dungeon?: DungeonSnap;
  readonly generation?: { readonly graph: { readonly nodes: readonly string[]; readonly edges: readonly { from: string; to: string; viaDoor: 'n' | 's' | 'e' | 'w' }[] } };
}

const ROOM_W = 320;
const ROOM_H = 240;
const DELTA: Record<'n' | 's' | 'e' | 'w', readonly [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export interface RoomMap {
  /** room cell key ("cx,cy" after normalisation) -> node id */
  readonly byCell: ReadonlyMap<string, string>;
  readonly cellOf: ReadonlyMap<string, readonly [number, number]>;
  readonly neighbours: ReadonlyMap<string, readonly string[]>;
}

/** Rebuild the room grid the generator laid out from the manifest's door graph (r0 at the origin, then normalised). */
export function buildRoomMap(shell: DungeonShell): RoomMap {
  const edges = shell.generation?.graph.edges ?? [];
  const pos = new Map<string, [number, number]>([['r0', [0, 0]]]);
  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const from = pos.get(e.from);
      if (from && !pos.has(e.to)) {
        const [dx, dy] = DELTA[e.viaDoor];
        pos.set(e.to, [from[0] + dx, from[1] + dy]);
        changed = true;
      }
    }
  }
  for (const e of edges) link(e.from, e.to);
  let minX = 0;
  let minY = 0;
  for (const [x, y] of pos.values()) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  const byCell = new Map<string, string>();
  const cellOf = new Map<string, readonly [number, number]>();
  for (const [id, [x, y]] of pos) {
    const cell: readonly [number, number] = [x - minX, y - minY];
    byCell.set(`${cell[0]},${cell[1]}`, id);
    cellOf.set(id, cell);
  }
  return { byCell, cellOf, neighbours: adjacency };
}

function roomCentre(cell: readonly [number, number]): { x: number; y: number } {
  return { x: cell[0] * ROOM_W + ROOM_W / 2, y: cell[1] * ROOM_H + ROOM_H / 2 };
}

/** BFS over door edges from `from` to `to`; returns the node path (inclusive) or null. */
export function routeRooms(map: RoomMap, from: string, to: string): readonly string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of map.neighbours.get(node) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, node);
      if (next === to) {
        const path = [to];
        let cursor = to;
        while (cursor !== from) {
          cursor = prev.get(cursor)!;
          path.unshift(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function readDungeon(harness: Harness): Promise<DungeonShell> {
  return readShellState<DungeonShell>(harness, 'game.top-down-shell');
}

/** Hold the arrow keys that reduce the distance to (x, y) until within `tolerance`, or the budget runs out. */
export async function walkTo(
  harness: Harness,
  x: number,
  y: number,
  options: { readonly tolerance?: number; readonly maxSteps?: number; readonly stopWhen?: ((shell: DungeonShell) => boolean) | undefined } = {},
): Promise<DungeonShell> {
  const tolerance = options.tolerance ?? 8;
  const maxSteps = options.maxSteps ?? 200;
  const held = new Set<string>();
  const set = async (codes: readonly string[]): Promise<void> => {
    for (const code of [...held]) {
      if (!codes.includes(code)) {
        await harness.keyUp(code);
        held.delete(code);
      }
    }
    for (const code of codes) {
      if (!held.has(code)) {
        await harness.keyDown(code);
        held.add(code);
      }
    }
  };
  let shell = await readDungeon(harness);
  try {
    for (let step = 0; step < maxSteps; step++) {
      const dx = x - shell.x;
      const dy = y - shell.y;
      if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) break;
      if (options.stopWhen?.(shell)) break;
      const codes: string[] = [];
      if (Math.abs(dx) > tolerance) codes.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (Math.abs(dy) > tolerance) codes.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await set(codes);
      await harness.stepFrames(2);
      shell = await readDungeon(harness);
    }
  } finally {
    await set([]);
    await harness.stepFrames(1);
  }
  return shell;
}

/** Walk room to room along the door graph to `targetRoom` (a node id), passing through each doorway's centre. */
export async function walkToRoom(harness: Harness, map: RoomMap, targetRoom: string, stopWhen?: (shell: DungeonShell) => boolean): Promise<DungeonShell> {
  let shell = await readDungeon(harness);
  const current = map.byCell.get(shell.dungeon?.room ?? '') ?? 'r0';
  const path = routeRooms(map, current, targetRoom);
  if (!path) return shell;
  for (let i = 1; i < path.length; i++) {
    const a = map.cellOf.get(path[i - 1]!)!;
    const b = map.cellOf.get(path[i]!)!;
    const ca = roomCentre(a);
    const cb = roomCentre(b);
    const doorX = (ca.x + cb.x) / 2;
    const doorY = (ca.y + cb.y) / 2;
    const horizontal = a[1] === b[1];
    // Line up with the doorway inside the current room, cross it, then settle in the next room's centre lane.
    const before = horizontal ? { x: ca.x + Math.sign(cb.x - ca.x) * (ROOM_W / 2 - 60), y: doorY } : { x: doorX, y: ca.y + Math.sign(cb.y - ca.y) * (ROOM_H / 2 - 60) };
    const after = horizontal ? { x: cb.x - Math.sign(cb.x - ca.x) * (ROOM_W / 2 - 60), y: doorY } : { x: doorX, y: cb.y - Math.sign(cb.y - ca.y) * (ROOM_H / 2 - 60) };
    shell = await walkTo(harness, before.x, before.y, { stopWhen });
    if (stopWhen?.(shell)) return shell;
    shell = await walkTo(harness, after.x, after.y, { stopWhen });
    if (stopWhen?.(shell)) return shell;
  }
  return shell;
}

/** Approach the nearest living enemy in the player's room and strike until it dies (or the budget runs out). */
export async function fightNearestInRoom(harness: Harness, maxSteps = 240): Promise<DungeonShell> {
  let shell = await readDungeon(harness);
  const room = shell.dungeon?.room;
  let target = shell.dungeon?.enemies.find((e) => e.room === room) ?? null;
  for (let step = 0; step < maxSteps && target; step++) {
    const d = shell.dungeon!;
    const live = d.enemies.find((e) => e.id === target!.id);
    if (!live) break;
    if (d.nearId) {
      await harness.keyTap('KeyJ');
      await harness.stepFrames(10);
    } else {
      shell = await walkTo(harness, live.x, live.y, { tolerance: 40, maxSteps: 12, stopWhen: (s) => s.dungeon?.nearId !== null });
    }
    shell = await readDungeon(harness);
    if (shell.dungeon?.outcome !== 'playing') break;
    target = shell.dungeon.enemies.find((e) => e.id === target!.id) ?? null;
  }
  return shell;
}
