/**
 * Local multiplayer seats pack (Category-C capability program, Wave 7).
 *
 * Renderer-neutral input ownership for one keyboard. Hotseat owns turns and
 * scores; versus only publishes per-seat axes so `sw2d.ball-paddle` can drive
 * a human opponent instead of lerp AI. Empty catalogs (fewer than two
 * players) stay inert. Not netcode, not gamepads, not split-screen.
 */

import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  LocalPlayCatalog,
  LocalPlayMode,
  LocalPlayOutcome,
  LocalPlayService,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateLocalPlayIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

function assertUniqueIds(catalog: LocalPlayCatalog): void {
  const seen = new Set<string>();
  for (const player of catalog.players) {
    if (seen.has(player.id)) throw new DuplicateLocalPlayIdError(player.id);
    seen.add(player.id);
  }
}

const EMPTY_CATALOG: LocalPlayCatalog = {
  schemaVersion: 1,
  mode: 'hotseat',
  players: [],
};

class LocalPlayServiceImpl implements LocalPlayService {
  private held = new Set<string>();
  private seat = 0;
  private points: number[];
  private turnCount = 0;
  private champ: number | null = null;
  private last: string | null = null;
  private current: LocalPlayOutcome = 'playing';

  constructor(
    private readonly events: EventBus,
    private readonly catalog: LocalPlayCatalog,
  ) {
    assertUniqueIds(catalog);
    this.points = catalog.players.map(() => 0);
  }

  mode(): LocalPlayMode {
    return this.catalog.mode;
  }

  active(): boolean {
    return this.catalog.players.length >= 2;
  }

  setHeld(codes: readonly string[]): void {
    this.held = new Set(codes);
  }

  axis(playerIndex: number): number {
    const player = this.catalog.players[playerIndex];
    if (!player) return 0;
    const pos = (player.positive ?? []).some((code) => this.held.has(code));
    const neg = (player.negative ?? []).some((code) => this.held.has(code));
    if (pos === neg) return 0;
    return pos ? 1 : -1;
  }

  currentPlayer(): number {
    return this.seat;
  }

  scores(): readonly number[] {
    return this.points;
  }

  turns(): number {
    return this.turnCount;
  }

  winner(): number | null {
    return this.champ;
  }

  lastResult(): string | null {
    return this.last;
  }

  outcome(): LocalPlayOutcome {
    return this.current;
  }

  act(): void {
    if (!this.active() || this.current !== 'playing') return;
    if (this.catalog.mode !== 'hotseat' || !this.catalog.hotseat) return;
    const cycle = this.catalog.hotseat.pointsCycle;
    const amount = cycle[this.turnCount % cycle.length] ?? 1;
    this.points[this.seat] = (this.points[this.seat] ?? 0) + amount;
    this.turnCount += 1;
    this.last = 'party-turn';
    this.events.emit('localPlay:acted', { playerIndex: this.seat, turns: this.turnCount });
    this.seat = this.seat === 0 ? 1 : 0;
    this.events.emit('localPlay:turnChanged', { playerIndex: this.seat, turns: this.turnCount });
    if (this.turnCount >= this.catalog.hotseat.turns) {
      const p1 = this.points[0] ?? 0;
      const p2 = this.points[1] ?? 0;
      this.champ = p1 === p2 ? 0 : p1 > p2 ? 0 : 1;
      this.current = 'complete';
      this.events.emit('localPlay:completed', { winner: this.champ });
    }
  }

  reset(): void {
    this.held = new Set();
    this.seat = 0;
    this.points = this.catalog.players.map(() => 0);
    this.turnCount = 0;
    this.champ = null;
    this.last = null;
    this.current = 'playing';
  }
}

export const localPlayPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.localPlay,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.localPlay],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = (context.content?.data?.['local-play']?.value as LocalPlayCatalog | undefined) ?? EMPTY_CATALOG;
    const service = new LocalPlayServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.localPlay, service);
    return {
      id: PACK_IDS.localPlay,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { LocalPlayService };
