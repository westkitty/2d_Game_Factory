/**
 * Local multiplayer & gamepad routing (post-ten program Phase 15).
 *
 * Player identity is a ROUTING dimension, not a new input vocabulary.
 * `ActionInput` (input.ts) is untouched and remains the semantic abstraction:
 *
 *   physical devices -> adapters -> PlayerInputHub -> per-player ActionInput
 *
 * There is deliberately no `P1_MOVE_LEFT`. Every player receives the same
 * `ActionId` vocabulary on a separate channel, so a controller family, a system
 * pack and a generated shell all keep reading the actions they already know.
 *
 * Everything here is renderer-neutral and browser-neutral. The `Gamepad` object
 * never appears: a poll produces a plain `GamepadSnapshot`, which is both what
 * makes the adapter testable and what stops a stale browser object being
 * retained across a disconnect.
 */

import type { ActionId } from './actions.ts';
import type { ActionBindings, ActionInput } from './input.ts';
import type { Disposable } from './disposable.ts';

export const PLAYER_INPUT_CAPABILITY_ID = 'input.players';

export type PlayerId = string;

// --- Devices -------------------------------------------------------------

/**
 * What a player slot is driven by. Bounded on purpose: a device the hub cannot
 * name is a device it cannot deduplicate, and duplicate ownership is the whole
 * failure this phase exists to prevent.
 */
export type DeviceAssignment =
  | { readonly kind: 'keyboard-profile'; readonly profileId: string }
  | { readonly kind: 'gamepad-index'; readonly index: number };

export type DeviceKind = DeviceAssignment['kind'];

/** Stable, order-independent identity for a device assignment. */
export function deviceKey(device: DeviceAssignment): string {
  return device.kind === 'keyboard-profile'
    ? `keyboard-profile:${device.profileId}`
    : `gamepad-index:${device.index}`;
}

export function sameDevice(a: DeviceAssignment, b: DeviceAssignment): boolean {
  return deviceKey(a) === deviceKey(b);
}

/**
 * A named set of physical key bindings one local player can own.
 *
 * Reuses `ActionBindings` rather than inventing a parallel mapping format, so a
 * profile is authored, validated and remapped exactly like any other binding set.
 */
export interface KeyboardProfile {
  readonly id: string;
  readonly displayName: string;
  readonly bindings: ActionBindings;
}

// --- Slots ---------------------------------------------------------------

export type PlayerJoinState = 'empty' | 'joined' | 'ready';

export interface PlayerSlot {
  readonly playerId: PlayerId;
  /** Stable 0-based roster position. Never changes for the life of the hub. */
  readonly index: number;
  readonly displayName: string;
  readonly joined: boolean;
  readonly ready: boolean;
  /**
   * Whether the assigned device is currently usable. A keyboard profile is
   * always connected; a gamepad slot follows the browser's connection state.
   */
  readonly connected: boolean;
  readonly device: DeviceAssignment | null;
  readonly state: PlayerJoinState;
}

export type PlayerJoinRejection =
  | 'unknown-player'
  | 'already-joined'
  | 'not-joined'
  | 'roster-full'
  | 'device-taken'
  | 'unknown-device'
  | 'device-disconnected';

export type PlayerJoinResult =
  | { readonly ok: true; readonly slot: PlayerSlot }
  | { readonly ok: false; readonly reason: PlayerJoinRejection; readonly detail?: string };

// --- Roster configuration ------------------------------------------------

export interface GamepadDeadzoneConfig {
  /** Applied radially to a declared stick pair, and scalar to a lone axis. */
  readonly stick: number;
  /** Applied scalar to analog button/trigger values. */
  readonly trigger: number;
}

export interface PlayerRosterConfig {
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** When true, `canStart()` also requires every joined player to be ready. */
  readonly requireReady: boolean;
  /**
   * Explicit slot ids. When omitted the hub generates `p1`..`pN` for `maxPlayers`.
   * Supplying them lets content name slots meaningfully ("red", "blue").
   */
  readonly playerIds?: readonly string[];
  readonly deadzone?: GamepadDeadzoneConfig;
  /** Extra or replacement keyboard profiles. Merged over the runtime defaults by id. */
  readonly keyboardProfiles?: readonly KeyboardProfile[];
}

/** Content document shape for `content/players.json`. */
export interface PlayerRosterDocument {
  readonly schemaVersion: 1;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly requireReady?: boolean;
  readonly playerIds?: readonly string[];
  readonly deadzone?: GamepadDeadzoneConfig;
}

export const DEFAULT_GAMEPAD_DEADZONE: GamepadDeadzoneConfig = { stick: 0.25, trigger: 0.1 };

export class InvalidPlayerRosterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlayerRosterError';
  }
}

/** Semantic checks the JSON schema cannot express. */
export function validatePlayerRosterDocument(doc: PlayerRosterDocument): void {
  if (!Number.isInteger(doc.minPlayers) || doc.minPlayers < 1) {
    throw new InvalidPlayerRosterError(`minPlayers must be an integer >= 1 (got ${String(doc.minPlayers)}).`);
  }
  if (!Number.isInteger(doc.maxPlayers) || doc.maxPlayers < 1) {
    throw new InvalidPlayerRosterError(`maxPlayers must be an integer >= 1 (got ${String(doc.maxPlayers)}).`);
  }
  if (doc.minPlayers > doc.maxPlayers) {
    throw new InvalidPlayerRosterError(
      `minPlayers (${doc.minPlayers}) must not exceed maxPlayers (${doc.maxPlayers}).`,
    );
  }
  if (doc.playerIds) {
    if (doc.playerIds.length !== doc.maxPlayers) {
      throw new InvalidPlayerRosterError(
        `playerIds lists ${doc.playerIds.length} id(s) but maxPlayers is ${doc.maxPlayers}.`,
      );
    }
    const seen = new Set<string>();
    for (const id of doc.playerIds) {
      if (seen.has(id)) throw new InvalidPlayerRosterError(`Duplicate playerId: "${id}".`);
      seen.add(id);
    }
  }
  if (doc.deadzone) {
    for (const [name, value] of [
      ['stick', doc.deadzone.stick],
      ['trigger', doc.deadzone.trigger],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new InvalidPlayerRosterError(`deadzone.${name} must be in [0, 1) (got ${String(value)}).`);
      }
    }
  }
}

// --- Gamepad snapshots ---------------------------------------------------

/**
 * A plain, immediately-consumed reading of one gamepad.
 *
 * Deliberately not `Gamepad`: the browser reuses and invalidates those objects,
 * and retaining one across a disconnect is how phantom held state survives.
 */
export interface GamepadSnapshot {
  readonly index: number;
  readonly connected: boolean;
  readonly id: string;
  readonly mapping: string;
  readonly axes: readonly number[];
  /** Analog values 0..1, one per button. */
  readonly buttons: readonly number[];
}

/** Where snapshots come from. The browser implementation reads navigator.getGamepads(); tests inject. */
export type GamepadSource = () => readonly (GamepadSnapshot | null)[];

export interface GamepadAxisRef {
  readonly index: number;
  readonly direction: -1 | 1;
}

export interface GamepadBinding {
  readonly buttons?: readonly number[];
  readonly axes?: readonly GamepadAxisRef[];
}

export type GamepadBindings = Readonly<Partial<Record<ActionId, GamepadBinding>>>;

/** A paired analog stick, so a diagonal push gets one radial deadzone rather than two scalar ones. */
export interface GamepadStick {
  readonly id: string;
  readonly xAxis: number;
  readonly yAxis: number;
}

/**
 * W3C "standard" gamepad layout, referenced by index rather than by vendor
 * label: button 0 is the bottom face button on every standard pad, whatever
 * that vendor prints on it.
 */
export const STANDARD_GAMEPAD_STICKS: readonly GamepadStick[] = [
  { id: 'left', xAxis: 0, yAxis: 1 },
  { id: 'right', xAxis: 2, yAxis: 3 },
];

export const STANDARD_GAMEPAD_BINDINGS: GamepadBindings = {
  // Left stick or d-pad drives movement.
  MOVE_LEFT: { axes: [{ index: 0, direction: -1 }], buttons: [14] },
  MOVE_RIGHT: { axes: [{ index: 0, direction: 1 }], buttons: [15] },
  MOVE_UP: { axes: [{ index: 1, direction: -1 }], buttons: [12] },
  MOVE_DOWN: { axes: [{ index: 1, direction: 1 }], buttons: [13] },
  // Bottom face button is jump/confirm, mirroring Space on the keyboard defaults.
  JUMP: { buttons: [0] },
  CONFIRM: { buttons: [0] },
  // Right face button is cancel/back, and doubles as interact.
  CANCEL: { buttons: [1] },
  INTERACT: { buttons: [1] },
  PRIMARY_ACTION: { buttons: [2] },
  SECONDARY_ACTION: { buttons: [3] },
  DASH: { buttons: [5, 7] },
  PAUSE: { buttons: [9] },
  // Right stick aims, matching the digital AIM_* vocabulary (ADR-0016).
  AIM_LEFT: { axes: [{ index: 2, direction: -1 }] },
  AIM_RIGHT: { axes: [{ index: 2, direction: 1 }] },
  AIM_UP: { axes: [{ index: 3, direction: -1 }] },
  AIM_DOWN: { axes: [{ index: 3, direction: 1 }] },
};

// --- Deadzone ------------------------------------------------------------

/**
 * Scalar deadzone with rescaling, so the first movement past the threshold is
 * small rather than a jump to `deadzone`.
 *
 *   |v| <= d  -> 0
 *   otherwise -> sign(v) * (|v| - d) / (1 - d), clamped to -1..1
 */
export function applyDeadzone(value: number, deadzone: number): number {
  if (!Number.isFinite(value)) return 0;
  const d = deadzone <= 0 ? 0 : deadzone >= 1 ? 0.999999 : deadzone;
  const magnitude = Math.abs(value);
  if (magnitude <= d) return 0;
  const scaled = (magnitude - d) / (1 - d);
  const clamped = scaled >= 1 ? 1 : scaled;
  return value < 0 ? -clamped : clamped;
}

/**
 * Radial deadzone for a stick pair. A diagonal push is one vector, so the
 * threshold is applied to its magnitude - per-axis thresholds would make a
 * genuine diagonal need more deflection than a cardinal one.
 */
export function applyRadialDeadzone(
  x: number,
  y: number,
  deadzone: number,
): { readonly x: number; readonly y: number } {
  const px = Number.isFinite(x) ? x : 0;
  const py = Number.isFinite(y) ? y : 0;
  const magnitude = Math.hypot(px, py);
  if (magnitude === 0) return { x: 0, y: 0 };
  const scaled = applyDeadzone(magnitude, deadzone);
  if (scaled === 0) return { x: 0, y: 0 };
  const factor = scaled / magnitude;
  return { x: px * factor, y: py * factor };
}

// --- Service -------------------------------------------------------------

/**
 * The reusable local-multiplayer routing service.
 *
 * Opt-in: a game gets one only when it authors `content/players.json`. Games
 * that do not stay on the single global `ActionInput` exactly as before.
 */
export interface PlayerInputService extends Disposable {
  config(): PlayerRosterConfig;
  keyboardProfiles(): readonly KeyboardProfile[];

  players(): readonly PlayerSlot[];
  slot(playerId: PlayerId): PlayerSlot | undefined;
  joinedPlayers(): readonly PlayerSlot[];
  readyPlayers(): readonly PlayerSlot[];
  connectedPlayers(): readonly PlayerSlot[];

  join(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  leave(playerId: PlayerId): boolean;
  setReady(playerId: PlayerId, ready: boolean): boolean;
  assignDevice(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  releaseDevice(playerId: PlayerId): boolean;

  /** The player's own semantic channel. Undefined for an unknown or unjoined slot. */
  inputForPlayer(playerId: PlayerId): ActionInput | undefined;

  /** Devices not currently owned by any slot, keyboard profiles first then connected pads. */
  availableDevices(): readonly DeviceAssignment[];

  /** Whether `minPlayers` (and `requireReady`, when set) are satisfied. */
  canStart(): boolean;
}
