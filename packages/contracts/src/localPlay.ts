/**
 * Local multiplayer seats (Category-C capability program, Wave 7).
 *
 * Renderer-neutral input ownership for one keyboard. Two bounded modes:
 *   - `hotseat` — pass-and-play turns and scores (local-party-game).
 *   - `versus`  — simultaneous disjoint axes (pong P1 arrows / P2 WASD).
 *
 * Not netcode, not gamepads, not split-screen cameras, not more than two
 * seats. Does not replace `sw2d.ball-paddle` scoring; versus only publishes
 * per-seat axes the table can consume.
 */

export const LOCAL_PLAY_CAPABILITY_ID = 'arcade.seats';

export type LocalPlayMode = 'hotseat' | 'versus';
export type LocalPlayOutcome = 'playing' | 'complete';

export interface LocalPlayPlayerDef {
  readonly id: string;
  readonly label: string;
  readonly negative?: readonly string[];
  readonly positive?: readonly string[];
}

export interface LocalPlayHotseatDef {
  readonly turns: number;
  readonly pointsCycle: readonly number[];
}

/** The validated `content/local-play.json` document. */
export interface LocalPlayCatalog {
  readonly schemaVersion: number;
  readonly mode: LocalPlayMode;
  readonly players: readonly LocalPlayPlayerDef[];
  readonly hotseat?: LocalPlayHotseatDef;
}

export interface LocalPlayService {
  mode(): LocalPlayMode;
  /** False when the catalog has fewer than two seats. */
  active(): boolean;
  setHeld(codes: readonly string[]): void;
  axis(playerIndex: number): number;
  currentPlayer(): number;
  scores(): readonly number[];
  turns(): number;
  winner(): number | null;
  lastResult(): string | null;
  outcome(): LocalPlayOutcome;
  act(): void;
  reset(): void;
}

export class DuplicateLocalPlayIdError extends Error {
  constructor(id: string) {
    super(`Duplicate local-play id \"${id}\" in content/local-play.json.`);
    this.name = 'DuplicateLocalPlayIdError';
  }
}
