import type {
  CapabilityRegistry,
  GameContext,
  InstalledSystemPack,
  SaveStore,
  SystemPackDefinition,
  VersionedRecord,
  WorldConditionCheck,
  WorldConnectionDefinition,
  WorldGraphCondition,
  WorldGraphDefinition,
  WorldGraphSave,
  WorldGraphService,
  WorldMapState,
  WorldNodeDefinition,
  WorldTransitionResult,
} from '@sw2d/contracts';
import { validateWorldGraphDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * World-graph pack: reusable location graph, room transitions and map
 * (capability program Phase 8), publishing `world.graph`. Composes with
 * `world.state` - traversal conditions read world flags, item counts and
 * progression unlocks through the existing capabilities; nothing here
 * duplicates that state.
 *
 * Renderer-independent: this pack moves the *graph pointer* and discovery
 * state. The scene transition (tear down the old room, build the new one,
 * place the player at an entrance) is a `@sw2d/runtime` bridge that consumes
 * this service.
 */

export const WORLD_GRAPH_SAVE_SLOT = 'world-graph';
const SAVE_VERSION = 1;

interface WorldGraphSaveRecord extends VersionedRecord {
  readonly currentNodeId: string;
  readonly discovered: readonly string[];
  readonly visited: readonly string[];
}

interface ConditionReaders {
  hasFlag(flag: string): boolean;
  itemCount(itemId: string): number;
  isUnlocked(unlockId: string): boolean;
}

function readersFrom(capabilities: CapabilityRegistry): ConditionReaders {
  const world = capabilities.get<{ hasFlag(f: string): boolean }>(CAPABILITY_IDS.world);
  const items = capabilities.get<{ count(id: string): number }>(CAPABILITY_IDS.items);
  const progression = capabilities.get<{ isUnlocked(id: string): boolean; itemCount(id: string): number }>(CAPABILITY_IDS.progression);
  return {
    hasFlag: (flag) => world?.hasFlag(flag) ?? false,
    itemCount: (id) => items?.count(id) ?? progression?.itemCount(id) ?? 0,
    isUnlocked: (id) => progression?.isUnlocked(id) ?? false,
  };
}

class WorldGraphServiceImpl implements WorldGraphService {
  readonly #def: WorldGraphDefinition;
  readonly #nodes = new Map<string, WorldNodeDefinition>();
  readonly #connections = new Map<string, { node: string; conn: WorldConnectionDefinition }>();
  readonly #readers: ConditionReaders;
  readonly #saves: SaveStore | undefined;
  #current: string;
  readonly #discovered = new Set<string>();
  readonly #visited = new Set<string>();

  constructor(def: WorldGraphDefinition, readers: ConditionReaders, saves: SaveStore | undefined) {
    validateWorldGraphDefinition(def);
    this.#def = def;
    this.#readers = readers;
    this.#saves = saves;
    for (const node of def.nodes) {
      this.#nodes.set(node.id, node);
      for (const conn of node.connections) this.#connections.set(conn.id, { node: node.id, conn });
    }
    this.#current = def.startNodeId;
    this.#discovered.add(def.startNodeId);
    this.#visited.add(def.startNodeId);
    if (saves) {
      const loaded = saves.load<WorldGraphSaveRecord>(WORLD_GRAPH_SAVE_SLOT, {
        currentVersion: SAVE_VERSION,
        createDefault: () => ({ schemaVersion: SAVE_VERSION, currentNodeId: def.startNodeId, discovered: [def.startNodeId], visited: [def.startNodeId] }),
      });
      this.loadSave({ schemaVersion: SAVE_VERSION, currentNodeId: loaded.value.currentNodeId, discovered: loaded.value.discovered, visited: loaded.value.visited });
    }
  }

  definitionId(): string {
    return this.#def.id;
  }

  currentNode(): WorldNodeDefinition {
    return this.#nodes.get(this.#current)!;
  }

  node(id: string): WorldNodeDefinition | undefined {
    return this.#nodes.get(id);
  }

  connections(nodeId?: string): readonly WorldConnectionDefinition[] {
    const node = this.#nodes.get(nodeId ?? this.#current);
    return node ? node.connections : [];
  }

  #evaluate(condition: WorldGraphCondition): boolean {
    switch (condition.kind) {
      case 'flag':
        return this.#readers.hasFlag(condition.flag) === (condition.value ?? true);
      case 'item':
        return this.#readers.itemCount(condition.itemId) >= (condition.min ?? 1);
      case 'progression-unlock':
        return this.#readers.isUnlocked(condition.unlockId);
      case 'visited':
        return this.#visited.has(condition.nodeId);
    }
  }

  canTraverse(connectionId: string): WorldConditionCheck {
    const entry = this.#connections.get(connectionId);
    if (!entry) return { allowed: false, failed: [] };
    const failed = (entry.conn.conditions ?? []).filter((c) => !this.#evaluate(c));
    return { allowed: failed.length === 0, failed };
  }

  requestTransition(connectionId: string): WorldTransitionResult {
    const entry = this.#connections.get(connectionId);
    if (!entry) return { ok: false, connectionId, reason: 'unknown-connection' };
    const dest = this.#nodes.get(entry.conn.destinationNodeId);
    if (!dest) return { ok: false, connectionId, reason: 'unknown-destination' };
    const check = this.canTraverse(connectionId);
    if (!check.allowed) return { ok: false, connectionId, reason: 'condition-failed', failed: check.failed };
    this.#current = dest.id;
    this.#discovered.add(dest.id);
    this.#visited.add(dest.id);
    this.#persist();
    return { ok: true, connectionId, toNodeId: dest.id, toEntranceId: entry.conn.destinationEntranceId };
  }

  markDiscovered(nodeId: string): void {
    if (this.#nodes.has(nodeId) && !this.#discovered.has(nodeId)) {
      this.#discovered.add(nodeId);
      this.#persist();
    }
  }

  isDiscovered(nodeId: string): boolean {
    return this.#discovered.has(nodeId);
  }

  markVisited(nodeId: string): void {
    if (this.#nodes.has(nodeId) && !this.#visited.has(nodeId)) {
      this.#visited.add(nodeId);
      this.#discovered.add(nodeId);
      this.#persist();
    }
  }

  isVisited(nodeId: string): boolean {
    return this.#visited.has(nodeId);
  }

  discoveredNodes(): readonly string[] {
    return [...this.#discovered].sort();
  }

  visitedNodes(): readonly string[] {
    return [...this.#visited].sort();
  }

  mapState(): WorldMapState {
    const nodes = this.#def.nodes.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      mapX: n.mapX,
      mapY: n.mapY,
      discovered: this.#discovered.has(n.id),
      visited: this.#visited.has(n.id),
      current: n.id === this.#current,
    }));
    const edges = [...this.#connections.values()].map(({ node, conn }) => ({
      id: conn.id,
      from: node,
      to: conn.destinationNodeId,
      ...(conn.mapLabel !== undefined ? { label: conn.mapLabel } : {}),
      known: this.#discovered.has(node) && this.#discovered.has(conn.destinationNodeId),
    }));
    return { currentNodeId: this.#current, discovered: this.discoveredNodes(), visited: this.visitedNodes(), nodes, edges };
  }

  reset(): void {
    this.#current = this.#def.startNodeId;
    this.#discovered.clear();
    this.#visited.clear();
    this.#discovered.add(this.#def.startNodeId);
    this.#visited.add(this.#def.startNodeId);
    this.#persist();
  }

  toSave(): WorldGraphSave {
    return { schemaVersion: SAVE_VERSION, currentNodeId: this.#current, discovered: this.discoveredNodes(), visited: this.visitedNodes() };
  }

  loadSave(save: WorldGraphSave): void {
    this.#discovered.clear();
    this.#visited.clear();
    for (const id of save.discovered) if (this.#nodes.has(id)) this.#discovered.add(id);
    for (const id of save.visited) if (this.#nodes.has(id)) (this.#visited.add(id), this.#discovered.add(id));
    this.#current = this.#nodes.has(save.currentNodeId) ? save.currentNodeId : this.#def.startNodeId;
    this.#discovered.add(this.#def.startNodeId);
    this.#visited.add(this.#def.startNodeId);
    this.#discovered.add(this.#current);
  }

  #persist(): void {
    this.#saves?.save<WorldGraphSaveRecord>(WORLD_GRAPH_SAVE_SLOT, {
      schemaVersion: SAVE_VERSION,
      currentNodeId: this.#current,
      discovered: this.discoveredNodes(),
      visited: this.visitedNodes(),
    });
  }
}

export interface WorldGraphConfig {
  /** Persist current-node + discovered/visited through `context.saves`. Default false. */
  readonly persist?: boolean;
}

export const worldGraphPack: SystemPackDefinition<WorldGraphConfig, GameContext> = {
  id: PACK_IDS.worldGraph,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.worldGraph],
  dependencies: [],

  install(context: GameContext, config: WorldGraphConfig): InstalledSystemPack {
    const def = context.content.data['world-graph']?.value as WorldGraphDefinition | undefined;
    if (!def) {
      // Installed but no document: provide an inert single-node graph so the
      // capability is present and every method is safe.
      const stub: WorldGraphDefinition = {
        schemaVersion: 1,
        id: 'empty',
        startNodeId: 'root',
        nodes: [{ id: 'root', displayName: 'Root', level: 'levels/main', mapX: 0, mapY: 0, entrances: [{ id: 'start', x: 0, y: 0 }], connections: [] }],
      };
      const service = new WorldGraphServiceImpl(stub, readersFrom(context.capabilities), undefined);
      const handle = context.capabilities.provide(CAPABILITY_IDS.worldGraph, service);
      return { id: PACK_IDS.worldGraph, dispose: () => handle.dispose() };
    }
    const saves = config?.persist ? context.saves : undefined;
    const service = new WorldGraphServiceImpl(def, readersFrom(context.capabilities), saves);
    const handle = context.capabilities.provide(CAPABILITY_IDS.worldGraph, service);
    return {
      id: PACK_IDS.worldGraph,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { WorldGraphService } from '@sw2d/contracts';
