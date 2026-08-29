/**
 * World graph, rooms, transitions and map (capability program Phase 8).
 *
 * Renderer-neutral. A game made of several authored or generated locations
 * describes them as a graph of nodes; each node names a level/content
 * document, carries entrances (where a traveller arrives) and connections
 * (where a traveller may go, gated by bounded conditions). The service tracks
 * the current node, discovery and visited state, and produces a map state.
 *
 * Composes with `world.state` (ADR-0011) - it does not replace it: traversal
 * conditions read world flags / item counts / progression unlocks through the
 * existing capabilities. No Phaser object crosses this boundary; the scene
 * transition bridge lives in `@sw2d/runtime`.
 */

export const WORLD_GRAPH_CAPABILITY_ID = 'world.graph';

// --- Bounded traversal conditions --------------------------------

export type WorldGraphCondition =
  | { readonly kind: 'flag'; readonly flag: string; readonly value?: boolean }
  | { readonly kind: 'item'; readonly itemId: string; readonly min?: number }
  | { readonly kind: 'progression-unlock'; readonly unlockId: string }
  | { readonly kind: 'visited'; readonly nodeId: string };

// --- Definition ------------------------------------------------

export interface WorldEntranceDefinition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facing?: 'left' | 'right' | 'up' | 'down';
  readonly tags?: readonly string[];
}

export interface WorldConnectionDefinition {
  readonly id: string;
  readonly destinationNodeId: string;
  readonly destinationEntranceId: string;
  readonly conditions?: readonly WorldGraphCondition[];
  /** When true the reverse traversal is not implied. Default false. */
  readonly oneWay?: boolean;
  /** Optional label shown on the map for this edge. */
  readonly mapLabel?: string;
}

export interface WorldNodeDefinition {
  readonly id: string;
  readonly displayName: string;
  /** Content-document id of this room's level (e.g. 'levels/hub'). */
  readonly level: string;
  readonly mapX: number;
  readonly mapY: number;
  readonly entrances: readonly WorldEntranceDefinition[];
  readonly connections: readonly WorldConnectionDefinition[];
  readonly tags?: readonly string[];
  /** Optional checkpoint id associated with this node. */
  readonly checkpointId?: string;
}

export interface WorldGraphDefinition {
  readonly schemaVersion: number;
  readonly id: string;
  readonly displayName?: string;
  readonly startNodeId: string;
  readonly nodes: readonly WorldNodeDefinition[];
}

// --- Runtime state ------------------------------------------

export interface WorldMapNode {
  readonly id: string;
  readonly displayName: string;
  readonly mapX: number;
  readonly mapY: number;
  readonly discovered: boolean;
  readonly visited: boolean;
  readonly current: boolean;
}

export interface WorldMapEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  /** True when both endpoints are discovered. */
  readonly known: boolean;
}

export interface WorldMapState {
  readonly currentNodeId: string;
  readonly discovered: readonly string[];
  readonly visited: readonly string[];
  readonly nodes: readonly WorldMapNode[];
  readonly edges: readonly WorldMapEdge[];
}

export interface WorldConditionCheck {
  readonly allowed: boolean;
  readonly failed: readonly WorldGraphCondition[];
}

export interface WorldTransitionResult {
  readonly ok: boolean;
  readonly connectionId: string;
  readonly toNodeId?: string;
  readonly toEntranceId?: string;
  readonly reason?: 'unknown-connection' | 'condition-failed' | 'unknown-destination';
  readonly failed?: readonly WorldGraphCondition[];
}

/** Snapshot for persistence - only ids, never level/runtime objects. */
export interface WorldGraphSave {
  readonly schemaVersion: number;
  readonly currentNodeId: string;
  readonly discovered: readonly string[];
  readonly visited: readonly string[];
}

export interface WorldGraphService {
  definitionId(): string;
  currentNode(): WorldNodeDefinition;
  node(id: string): WorldNodeDefinition | undefined;
  /** Connections leaving `nodeId` (default: the current node). */
  connections(nodeId?: string): readonly WorldConnectionDefinition[];
  /** Evaluate a connection's conditions now. */
  canTraverse(connectionId: string): WorldConditionCheck;
  /**
   * Validate and, if allowed, move the graph's current-node pointer to the
   * connection's destination, marking it discovered + visited. Returns the
   * destination node/entrance ids for the scene bridge to place the player.
   * Does not itself touch any scene.
   */
  requestTransition(connectionId: string): WorldTransitionResult;
  markDiscovered(nodeId: string): void;
  isDiscovered(nodeId: string): boolean;
  markVisited(nodeId: string): void;
  isVisited(nodeId: string): boolean;
  discoveredNodes(): readonly string[];
  visitedNodes(): readonly string[];
  mapState(): WorldMapState;
  /** Back to the start node with only the start node discovered/visited. */
  reset(): void;
  /** Serialize ids for persistence. */
  toSave(): WorldGraphSave;
  /** Restore from a save; unknown ids are dropped and the current node falls back to start. */
  loadSave(save: WorldGraphSave): void;
}

export class WorldGraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldGraphValidationError';
  }
}

/**
 * Structural validation of a definition, independent of any runtime.
 * Throws WorldGraphValidationError listing every problem.
 */
export function validateWorldGraphDefinition(def: WorldGraphDefinition): void {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const node of def.nodes) {
    if (ids.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
    ids.add(node.id);
  }
  if (!ids.has(def.startNodeId)) errors.push(`startNodeId "${def.startNodeId}" is not a node`);
  for (const node of def.nodes) {
    const entranceIds = new Set(node.entrances.map((e) => e.id));
    if (node.entrances.length === 0) errors.push(`node "${node.id}" has no entrances`);
    for (const conn of node.connections) {
      if (!ids.has(conn.destinationNodeId)) {
        errors.push(`connection "${conn.id}" in "${node.id}" targets unknown node "${conn.destinationNodeId}"`);
        continue;
      }
      const dest = def.nodes.find((n) => n.id === conn.destinationNodeId)!;
      if (!dest.entrances.some((e) => e.id === conn.destinationEntranceId)) {
        errors.push(`connection "${conn.id}" targets unknown entrance "${conn.destinationEntranceId}" in "${conn.destinationNodeId}"`);
      }
      void entranceIds;
    }
  }
  if (errors.length > 0) throw new WorldGraphValidationError(`world-graph "${def.id}" invalid:\n  - ${errors.join('\n  - ')}`);
}
