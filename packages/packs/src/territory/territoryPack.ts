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
  private ox = 0;
  private oy = 0;
  private readonly progress = new Map<string, number>();
  private readonly ownedSet = new Set<string>();
  private holdingId: string | null = null;
  private last: string | null = null;
  private current: TerritoryOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: TerritoryCatalog,
  ) {}

  mode(): TerritoryMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.zones.length > 0 && this.catalog.zones[0]?.id !== 'none';
  }

  setOccupant(x: number, y: number): void {
    if (!this.active()) return;
    this.ox = x;
    this.oy = y;
  }

  tick(deltaMs: number): void {
    if (!this.active() || this.current !== 'playing') return;
    this.holdingId = null;
    for (const zone of this.catalog.zones) {
      if (zone.id === 'none' || this.ownedSet.has(zone.id)) continue;
      if (Math.hypot(this.ox - zone.x, this.oy - zone.y) <= zone.radius) {
        this.holdingId = zone.id;
        const next = (this.progress.get(zone.id) ?? 0) + deltaMs;
        this.progress.set(zone.id, next);
        if (next >= zone.holdMs) {
          this.ownedSet.add(zone.id);
          this.last = `owned-${zone.id}`;
          this.events.emit('territory:owned', { zoneId: zone.id, owned: this.ownedSet.size });
        }
      }
    }
    const live = this.catalog.zones.filter((z) => z.id !== 'none');
    if (live.length > 0 && this.ownedSet.size >= live.length) {
      this.current = 'complete';
      this.last = 'all-owned';
      this.events.emit('territory:completed', { mode: this.catalog.mode });
    }
  }

  owned(): readonly string[] {
    return [...this.ownedSet];
  }

  holding(): string | null {
    return this.holdingId;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): TerritoryOutcome {
    return this.current;
  }

  reset(): void {
    this.ox = 0;
    this.oy = 0;
    this.progress.clear();
    this.ownedSet.clear();
    this.holdingId = null;
    this.last = null;
    this.current = 'playing';
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
