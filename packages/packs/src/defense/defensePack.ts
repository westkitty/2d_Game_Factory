import type {
  BaseState,
  CaptureZoneState,
  DefenseDocument,
  DefenseEvent,
  DefenseService,
  GameContext,
  TerritoryEvent,
  TerritoryService,
  TowerPlacementResult,
  TowerState,
  ZoneOccupant,
  SystemPackDefinition,
  WeaponsService,
  NavGridSpec,
} from '@sw2d/contracts';
import {
  evaluateTowerPlacement,
  footprintRect,
  refundFor,
  resolveTowerStats,
  selectTarget,
  tickCaptureZone,
  validateDefenseDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { NavGrid, NavService } from '@sw2d/contracts';
import defenseConfigSchema from '../../schemas/defense-config.schema.json' with { type: 'json' };

export const DEFENSE_CONFIG_SCHEMA_ID = defenseConfigSchema.$id;
registerSchema(defenseConfigSchema);

export interface DefenseConfig {
  readonly documentName?: string;
  /** An already-defined grid whose routes blocking towers must preserve. */
  readonly navigationGridId?: string;
  /** Define a grid before defense installs; this is the generated-game path. */
  readonly navigationGrid?: { readonly id: string; readonly spec: NavGridSpec };
}

export class MissingDefenseDocumentError extends Error {
  constructor(documentName: string) {
    super(`sw2d.defense requires a "${documentName}" content document. Author content/defense.json ` +
      '(urn:sw2d:schema:content-defense:v1).');
    this.name = 'MissingDefenseDocumentError';
  }
}

export class MissingDefenseNavigationError extends Error {
  constructor() {
    super('A blocking tower requires world.navigation and a configured navigationGridId so every required route can be checked.');
    this.name = 'MissingDefenseNavigationError';
  }
}

class DefenseServiceImpl implements DefenseService {
  readonly #doc: DefenseDocument;
  readonly #definitions = new Map<string, NonNullable<DefenseDocument['towers']>[number]>();
  readonly #towers = new Map<string, TowerState>();
  readonly #bases = new Map<string, BaseState>();
  readonly #targets = new Map<string, Parameters<typeof selectTarget>[3][number]>();
  readonly #events: DefenseEvent[] = [];
  readonly #grid: NavGrid | undefined;
  readonly #weapons: WeaponsService | undefined;
  #funds: number;
  #nextId = 1;
  #elapsedMs = 0;

  constructor(document: DefenseDocument, grid?: NavGrid, weapons?: WeaponsService) {
    validateDefenseDocument(document);
    this.#doc = document;
    this.#grid = grid;
    this.#weapons = weapons;
    this.#funds = document.startingFunds ?? 0;
    for (const definition of document.towers ?? []) this.#definitions.set(definition.id, definition);
    for (const base of document.bases ?? []) {
      this.#bases.set(base.id, { id: base.id, health: base.maxHealth, maxHealth: base.maxHealth, breaches: 0, destroyed: false });
    }
  }

  towers(): readonly TowerState[] { return [...this.#towers.values()].sort((a, b) => a.instanceId.localeCompare(b.instanceId)); }
  tower(id: string): TowerState | undefined { return this.#towers.get(id); }
  definitions() { return [...this.#definitions.values()]; }
  funds(): number { return this.#funds; }
  lanes() { return this.#doc.lanes ?? []; }
  bases() { return [...this.#bases.values()]; }

  #routeIntact(position: { x: number; y: number }, definitionId: string): boolean {
    const definition = this.#definitions.get(definitionId)!;
    if (!definition.blocking) return true;
    const grid = this.#grid;
    if (!grid) return false;
    const rect = footprintRect(position, definition.footprint);
    const changed: Array<{ col: number; row: number; wasWalkable: boolean }> = [];
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      const [x, y] = grid.cellToWorld(col, row);
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        changed.push({ col, row, wasWalkable: grid.isWalkable(col, row) });
        grid.setWalkable(col, row, false);
      }
    }
    try {
      return (this.#doc.routes ?? []).every((route) => grid.findPath(grid.worldToCell(route.fromX, route.fromY), grid.worldToCell(route.toX, route.toY)) !== null);
    } finally {
      for (const cell of changed) grid.setWalkable(cell.col, cell.row, cell.wasWalkable);
    }
  }

  #evaluate(definitionId: string, x: number, y: number): TowerPlacementResult {
    const definition = this.#definitions.get(definitionId);
    if (!definition) return { ok: false, reason: 'unknown-tower', definitionId, position: { x, y }, cost: 0 };
    const reason = evaluateTowerPlacement(
      definition, { x, y }, this.#doc.zones ?? [],
      this.towers().map((tower) => footprintRect(tower.position, this.#definitions.get(tower.definitionId)?.footprint)),
      this.#funds, () => this.#routeIntact({ x, y }, definitionId),
    );
    return { ok: reason === undefined, ...(reason ? { reason } : {}), definitionId, position: { x, y }, cost: definition.cost };
  }

  canPlace(definitionId: string, x: number, y: number): TowerPlacementResult { return this.#evaluate(definitionId, x, y); }
  place(definitionId: string, x: number, y: number): TowerPlacementResult {
    const result = this.#evaluate(definitionId, x, y);
    if (!result.ok) return result;
    const definition = this.#definitions.get(definitionId)!;
    const instanceId = `tower-${this.#nextId++}`;
    const stats = resolveTowerStats(definition, 0);
    const state: TowerState = { instanceId, definitionId, position: { x, y }, tier: 0, ...stats, targetId: null };
    this.#towers.set(instanceId, state);
    // Towers pick targets, but Phase 3's weapons service remains the single
    // owner of cooldown, ammo and projectile creation.
    if (this.#weapons?.lookup(state.weaponId)) this.#weapons.equip(instanceId, state.weaponId);
    this.#funds -= definition.cost;
    this.#events.push({ kind: 'tower-placed', instanceId, definitionId, cost: definition.cost });
    return { ...result, instanceId };
  }
  upgrade(instanceId: string) {
    const state = this.#towers.get(instanceId); const definition = state && this.#definitions.get(state.definitionId);
    const tier = definition?.upgrades?.[state?.tier ?? 0];
    if (!state || !definition || !tier || this.#funds < tier.cost) return { ok: false, tier: state?.tier ?? 0, cost: tier?.cost ?? 0 };
    const nextTier = state.tier + 1; const stats = resolveTowerStats(definition, nextTier);
    this.#towers.set(instanceId, { ...state, tier: nextTier, ...stats }); this.#funds -= tier.cost;
    this.#events.push({ kind: 'tower-upgraded', instanceId, tier: nextTier, cost: tier.cost });
    return { ok: true, tier: nextTier, cost: tier.cost };
  }
  sell(instanceId: string) {
    const state = this.#towers.get(instanceId); const definition = state && this.#definitions.get(state.definitionId);
    if (!state || !definition) return { ok: false, refund: 0 };
    const refund = refundFor(definition, state.invested); this.#funds += refund; this.#towers.delete(instanceId);
    this.#events.push({ kind: 'tower-sold', instanceId, refund }); return { ok: true, refund };
  }
  breach(laneId: string): BaseState | undefined {
    const lane = (this.#doc.lanes ?? []).find((item) => item.id === laneId); if (!lane) return undefined;
    const definition = (this.#doc.bases ?? []).find((item) => item.id === lane.objectiveId); const base = this.#bases.get(lane.objectiveId);
    if (!definition || !base || base.destroyed) return base;
    const health = Math.max(0, base.health - definition.breachDamage); const next = { ...base, health, breaches: base.breaches + 1, destroyed: health === 0 };
    this.#bases.set(base.id, next); this.#events.push({ kind: 'base-breached', baseId: base.id, damage: definition.breachDamage, health });
    if (next.destroyed) this.#events.push({ kind: 'base-destroyed', baseId: base.id }); return next;
  }
  setTargets(targets: readonly Parameters<typeof selectTarget>[3][number][]): void { this.#targets.clear(); for (const target of targets) this.#targets.set(target.id, target); }
  update(deltaMs: number): void {
    this.#elapsedMs += Math.max(0, deltaMs);
    for (const state of this.towers()) {
      const definition = this.#definitions.get(state.definitionId)!;
      const target = selectTarget(definition.targetPolicy, state.position, state.range, [...this.#targets.values()]);
      const next = { ...state, targetId: target?.id ?? null }; this.#towers.set(state.instanceId, next);
      if (target) {
        const fired = this.#weapons?.tryFire({ ownerId: state.instanceId, originX: state.position.x, originY: state.position.y, dirX: target.x - state.position.x, dirY: target.y - state.position.y, nowMs: this.#elapsedMs });
        // No weapons pack means targeting is still observable but never claims
        // that a second projectile engine was made here.
        if (!this.#weapons || fired?.fired) this.#events.push({ kind: 'tower-fired', instanceId: state.instanceId, targetId: target.id });
      }
    }
  }
  reset(): void { this.#towers.clear(); this.#targets.clear(); this.#events.length = 0; this.#funds = this.#doc.startingFunds ?? 0; this.#nextId = 1; this.#elapsedMs = 0; for (const base of this.#doc.bases ?? []) this.#bases.set(base.id, { id: base.id, health: base.maxHealth, maxHealth: base.maxHealth, breaches: 0, destroyed: false }); }
  drainEvents(): readonly DefenseEvent[] { return this.#events.splice(0); }
}

class TerritoryServiceImpl implements TerritoryService {
  readonly #doc: DefenseDocument; readonly #zones = new Map<string, CaptureZoneState>(); readonly #scores = new Map<string, number>(); readonly #events: TerritoryEvent[] = []; #occupants: readonly ZoneOccupant[] = [];
  constructor(document: DefenseDocument) { this.#doc = document; this.reset(); }
  zones(): readonly CaptureZoneState[] { return [...this.#zones.values()]; }
  zone(id: string): CaptureZoneState | undefined { return this.#zones.get(id); }
  setOccupants(occupants: readonly ZoneOccupant[]): void { this.#occupants = occupants; }
  score(teamId: string): number { return this.#scores.get(teamId) ?? 0; }
  scores(): Readonly<Record<string, number>> { return Object.fromEntries([...this.#scores.entries()].sort((a,b) => a[0].localeCompare(b[0]))); }
  update(deltaMs: number): void { for (const definition of this.#doc.captureZones ?? []) { const previous = this.#zones.get(definition.id)!; const next = tickCaptureZone(definition, previous, this.#occupants, deltaMs); this.#zones.set(definition.id, next); if (previous.contested !== next.contested) this.#events.push({ kind: 'zone-contested', zoneId: definition.id, contested: next.contested }); if (previous.owner !== next.owner && next.owner) this.#events.push({ kind: 'zone-captured', zoneId: definition.id, owner: next.owner }); if (previous.owner === next.owner && next.owner && definition.scorePerSecond) { const amount = definition.scorePerSecond * deltaMs / 1000; this.#scores.set(next.owner, this.score(next.owner) + amount); this.#events.push({ kind: 'score', teamId: next.owner, amount }); } } }
  reset(): void { this.#zones.clear(); this.#scores.clear(); this.#events.length = 0; for (const definition of this.#doc.captureZones ?? []) this.#zones.set(definition.id, { id: definition.id, owner: definition.initialOwner ?? null, capturingTeam: null, progress: 0, contested: false, occupants: {} }); }
  drainEvents(): readonly TerritoryEvent[] { return this.#events.splice(0); }
}

export const defensePack: SystemPackDefinition<DefenseConfig, GameContext> = {
  id: PACK_IDS.defense, version: '0.1.0', provides: [CAPABILITY_IDS.defense, CAPABILITY_IDS.territory], dependencies: [CAPABILITY_IDS.navigation], configSchemaId: DEFENSE_CONFIG_SCHEMA_ID,
  install(context, config) {
    const documentName = config?.documentName ?? 'defense'; const document = context.content.data[documentName]?.value as DefenseDocument | undefined;
    if (!document) throw new MissingDefenseDocumentError(documentName);
    const hasBlocking = (document.towers ?? []).some((tower) => tower.blocking);
    const navigation = context.capabilities.get<NavService>(CAPABILITY_IDS.navigation);
    const grid = config?.navigationGrid
      ? navigation?.defineGrid(config.navigationGrid.id, config.navigationGrid.spec)
      : config?.navigationGridId ? navigation?.grid(config.navigationGridId) : undefined;
    if (hasBlocking && !grid) throw new MissingDefenseNavigationError();
    const weapons = context.capabilities.get<WeaponsService>(CAPABILITY_IDS.weapons);
    const defense = new DefenseServiceImpl(document, grid, weapons); const territory = new TerritoryServiceImpl(document);
    const defenseHandle = context.capabilities.provide(CAPABILITY_IDS.defense, defense); const territoryHandle = context.capabilities.provide(CAPABILITY_IDS.territory, territory);
    return { id: PACK_IDS.defense, update(deltaMs) { defense.update(deltaMs); territory.update(deltaMs); }, dispose() { territoryHandle.dispose(); defenseHandle.dispose(); } };
  },
};

export { DefenseServiceImpl, TerritoryServiceImpl };
export type { DefenseService, TerritoryService } from '@sw2d/contracts';
