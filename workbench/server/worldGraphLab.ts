/**
 * World-graph authoring surface (capability program Phase 8).
 *
 * The smallest useful surface: surface the game's `content/world-graph.json`
 * structure - nodes, entrances, connections, their bounded conditions, map
 * coordinates and labels - with the same structural validation the runtime
 * applies (`validateWorldGraphDefinition`) plus start->every-node reachability.
 * A structured list, read-only; editing is ordinary JSON work on the file.
 *
 * Reads `content/world-graph.json`; never writes.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { WorldGraphDefinition } from '@sw2d/contracts';
import { validateWorldGraphDefinition } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import { gameRoot } from './paths.ts';
import { SecurityError } from './security.ts';

export interface WorldGraphInspectResult {
  readonly id: string;
  readonly displayName?: string;
  readonly startNodeId: string;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly reachableFromStart: readonly string[];
  readonly unreachable: readonly string[];
  readonly nodes: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly level: string;
    readonly mapX: number;
    readonly mapY: number;
    readonly entrances: readonly string[];
    readonly connections: readonly {
      readonly id: string;
      readonly to: string;
      readonly toEntrance: string;
      readonly oneWay: boolean;
      readonly mapLabel?: string;
      readonly conditions: readonly string[];
    }[];
  }[];
}

function loadDef(gameId: string): WorldGraphDefinition {
  const file = path.join(gameRoot(gameId), 'content', 'world-graph.json');
  if (!existsSync(file)) throw new SecurityError(404, `No content/world-graph.json in "${gameId}".`);
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return validateContentBundleData({ 'world-graph': raw })['world-graph']!.value as WorldGraphDefinition;
}

function summariseCondition(c: { kind: string; [k: string]: unknown }): string {
  switch (c.kind) {
    case 'flag':
      return `flag ${String(c.flag)} = ${c.value === false ? 'false' : 'true'}`;
    case 'item':
      return `item ${String(c.itemId)} x${Number(c.min ?? 1)}`;
    case 'progression-unlock':
      return `unlock ${String(c.unlockId)}`;
    case 'visited':
      return `visited ${String(c.nodeId)}`;
    default:
      return c.kind;
  }
}

export function inspectWorldGraph(gameId: string): WorldGraphInspectResult {
  const def = loadDef(gameId);

  let valid = true;
  let errors: readonly string[] = [];
  try {
    validateWorldGraphDefinition(def);
  } catch (error) {
    valid = false;
    errors = error instanceof Error ? error.message.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : ['invalid'];
  }

  const adjacency = new Map<string, string[]>();
  for (const node of def.nodes) adjacency.set(node.id, node.connections.map((c) => c.destinationNodeId));
  const seen = new Set<string>([def.startNodeId]);
  const stack = [def.startNodeId];
  while (stack.length) {
    const n = stack.pop()!;
    for (const m of adjacency.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }

  return {
    id: def.id,
    ...(def.displayName !== undefined ? { displayName: def.displayName } : {}),
    startNodeId: def.startNodeId,
    valid,
    errors,
    reachableFromStart: [...seen].sort(),
    unreachable: def.nodes.map((n) => n.id).filter((id) => !seen.has(id)).sort(),
    nodes: def.nodes.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      level: n.level,
      mapX: n.mapX,
      mapY: n.mapY,
      entrances: n.entrances.map((e) => e.id),
      connections: n.connections.map((c) => ({
        id: c.id,
        to: c.destinationNodeId,
        toEntrance: c.destinationEntranceId,
        oneWay: c.oneWay ?? false,
        ...(c.mapLabel !== undefined ? { mapLabel: c.mapLabel } : {}),
        conditions: (c.conditions ?? []).map(summariseCondition),
      })),
    })),
  };
}
