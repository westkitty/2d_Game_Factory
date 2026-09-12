/**
 * Capture-zone / territory ownership (Category-C Wave 30).
 *
 * Renderer-neutral occupancy over time. Overlay RTS/territory kits stay
 * local. Empty catalogs stay inert.
 *
 * Bounded modes: stand (the player holds circles) and occupy (a commanded
 * unit holds circles). Not box-select and not strategy.turns.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
  TerritoryCatalog,
  TerritoryMode,
  TerritoryOccupant,
  TerritoryOutcome,
  TerritoryService,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

const EMPTY_CATALOG: TerritoryCatalog = {
  schemaVersion: 1,
  mode: 'stand',
  zones: [{ id: 'none', x: 0, y: 0, radius: 1, holdMs: 1 }],
};

class TerritoryServiceImpl implements TerritoryService {
  private occupants: TerritoryOccupant[] = [];
  private readonly capture = new Map<string, number>();
  private readonly owners = new Map<string, string>();
  private readonly scores = new Map<string, number>();
  private holdingId: string | null = null;
  private contestedIds: string[] = [];
  private last: string | null = null;
  private current: TerritoryOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: TerritoryCatalog,
  ) {
    for (const faction of this.factions()) this.scores.set(faction, 0);
  }

  mode(): TerritoryMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.zones.length > 0 && this.catalog.zones[0]?.id !== 'none';
  }

  setOccupant(x: number, y: number): void {
    if (!this.active()) return;
    this.occupants = [{ faction: this.factions()[0] ?? 'player', x, y }];
  }

  setOccupants(occupants: readonly TerritoryOccupant[]): void {
    if (!this.active()) return;
    this.occupants = occupants.map((entry) => ({ faction: entry.faction, x: entry.x, y: entry.y }));
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    this.holdingId = null;
    this.contestedIds = [];
    const dt = Math.max(0, deltaMs);
    for (const zone of this.catalog.zones) {
      if (zone.id === 'none') continue;
      const present = new Map<string, number>();
      for (const occupant of this.occupants) {
        if (Math.hypot(occupant.x - zone.x, occupant.y - zone.y) <= zone.radius) {
          present.set(occupant.faction, (present.get(occupant.faction) ?? 0) + 1);
        }
      }
      const factionsHere = [...present.keys()];
      if (factionsHere.length > 1) {
        this.contestedIds.push(zone.id);
        const current = this.capture.get(zone.id) ?? 0;
        this.capture.set(zone.id, Math.max(0, current - dt));
        this.last = `contested-${zone.id}`;
        continue;
      }
      if (factionsHere.length === 1) {
        const faction = factionsHere[0]!;
        this.holdingId = zone.id;
        if (this.owners.get(zone.id) === faction) continue;
        const next = (this.capture.get(zone.id) ?? 0) + dt;
        this.capture.set(zone.id, next);
        if (next >= zone.holdMs) {
          const previous = this.owners.get(zone.id);
          if (previous && previous !== faction) this.scores.set(previous, Math.max(0, (this.scores.get(previous) ?? 0) - 1));
          this.owners.set(zone.id, faction);
          this.scores.set(faction, (this.scores.get(faction) ?? 0) + 1);
          this.capture.set(zone.id, zone.holdMs);
          this.last = `owned-${zone.id}`;
          this.events.emit('territory:owned', { zoneId: zone.id, owned: this.owners.size });
        }
      } else if (!this.owners.has(zone.id)) {
        const current = this.capture.get(zone.id) ?? 0;
        this.capture.set(zone.id, Math.max(0, current - dt * 0.5));
      }
    }
    const live = this.catalog.zones.filter((z) => z.id !== 'none');
    const needed = this.catalog.victoryScore ?? live.length;
    const lead = Math.max(0, ...this.factions().map((faction) => this.scores.get(faction) ?? 0));
    if (live.length > 0 && lead >= needed) {
      this.current = 'complete';
      this.last = 'all-owned';
      this.events.emit('territory:completed', { mode: this.catalog.mode });
    }
  }

  owned(): readonly string[] {
    return [...this.owners.keys()];
  }

  owner(zoneId: string): string | null {
    return this.owners.get(zoneId) ?? null;
  }

  holding(): string | null {
    return this.holdingId;
  }

  contested(): readonly string[] {
    return this.contestedIds;
  }

  progress(zoneId: string): number {
    return this.capture.get(zoneId) ?? 0;
  }

  score(faction: string): number {
    return this.scores.get(faction) ?? 0;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): TerritoryOutcome {
    return this.current;
  }

  reset(): void {
    this.occupants = [];
    this.capture.clear();
    this.owners.clear();
    this.scores.clear();
    for (const faction of this.factions()) this.scores.set(faction, 0);
    this.holdingId = null;
    this.contestedIds = [];
    this.last = null;
    this.current = 'playing';
  }

  private factions(): readonly string[] {
    return this.catalog.factions && this.catalog.factions.length > 0 ? this.catalog.factions : ['player'];
  }
}

export const territoryPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.territory,
  version: '1.0.0',
  provides: [CAPABILITY_IDS.territory],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['territory']?.value as TerritoryCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new TerritoryServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.territory, service);
    return {
      id: PACK_IDS.territory,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { TerritoryService };
