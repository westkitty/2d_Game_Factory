/**
 * Local multiplayer seats pack (Category-C capability program, Wave 7).
 *
 * Renderer-neutral input ownership for keyboard plus assigned gamepads. Hotseat owns turns and
 * scores; versus only publishes per-seat axes so `sw2d.ball-paddle` can drive
 * a human opponent instead of lerp AI. Empty catalogs (fewer than two
 * players) stay inert. Presentation and optional net transport remain outside.
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
  private padAxes: number[] = [];
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

  setGamepadAxes(axes: readonly number[]): void {
    this.padAxes = [...axes];
  }

  axis(playerIndex: number): number {
    const player = this.catalog.players[playerIndex];
    if (!player) return 0;
    const pos = (player.positive ?? []).some((code) => this.held.has(code));
    const neg = (player.negative ?? []).some((code) => this.held.has(code));
    const keyboard = pos === neg ? 0 : pos ? 1 : -1;
    const gamepad = this.padAxes[playerIndex] ?? 0;
    return Math.abs(gamepad) > Math.abs(keyboard) ? gamepad : keyboard;
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
    this.seat = (this.seat + 1) % this.catalog.players.length;
    this.events.emit('localPlay:turnChanged', { playerIndex: this.seat, turns: this.turnCount });
    if (this.turnCount >= this.catalog.hotseat.turns) {
      const best = Math.max(...this.points);
      this.champ = this.points.findIndex((score) => score === best);
      this.current = 'complete';
      this.events.emit('localPlay:completed', { winner: this.champ });
    }
  }

  reset(): void {
    this.held = new Set();
    this.padAxes = [];
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
