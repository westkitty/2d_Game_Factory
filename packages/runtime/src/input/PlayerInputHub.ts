import {
  DEFAULT_GAMEPAD_DEADZONE,
  deviceKey,
  sameDevice,
  type ActionInput,
  type DeviceAssignment,
  type GamepadSource,
  type KeyboardProfile,
  type PlayerId,
  type PlayerInputService,
  type PlayerJoinResult,
  type PlayerJoinState,
  type PlayerRosterConfig,
  type PlayerSlot,
} from '@sw2d/contracts';
import { ActionInputHost } from './ActionInputHost.ts';
import { KeyboardAdapter } from './KeyboardAdapter.ts';
import { GamepadAdapter } from './GamepadAdapter.ts';
import { mergeKeyboardProfiles } from './keyboardProfiles.ts';

/**
 * Local-multiplayer input routing (post-ten program Phase 15).
 *
 * The hub does not reimplement input. Each player slot owns its own
 * `ActionInputHost` - the same certified edge machine the single-player game
 * uses - with its own adapters bound to that player's device. Player isolation
 * is therefore a property of *ownership*, not of filtering: player two's channel
 * has no adapter listening for player one's keys, so there is no code path along
 * which cross-talk could occur.
 *
 * Frame advancement follows the same single-owner rule as `ActionInputHost`:
 * the runtime calls `update()` exactly once per step, before any scene update.
 *
 * The hub is opt-in. A game gets one only by authoring `content/players.json`.
 */
export class PlayerInputHub implements PlayerInputService {
  readonly #config: PlayerRosterConfig;
  readonly #profiles: readonly KeyboardProfile[];
  readonly #profilesById: ReadonlyMap<string, KeyboardProfile>;
  readonly #gamepadSource: GamepadSource;
  readonly #keyboardTarget: EventTarget;

  /** Slot order is the roster order and never changes. */
  readonly #order: readonly PlayerId[];
  readonly #slots = new Map<PlayerId, MutableSlot>();
  #disposed = false;

  constructor(
    config: PlayerRosterConfig,
    options?: {
      readonly gamepadSource?: GamepadSource;
      /** Where the per-player keyboard adapters listen. Defaults to `window`. */
      readonly keyboardTarget?: EventTarget;
    },
  ) {
    this.#config = {
      ...config,
      deadzone: config.deadzone ?? DEFAULT_GAMEPAD_DEADZONE,
    };
    this.#profiles = mergeKeyboardProfiles(config.keyboardProfiles);
    this.#profilesById = new Map(this.#profiles.map((profile) => [profile.id, profile]));
    this.#gamepadSource = options?.gamepadSource ?? (() => []);
    this.#keyboardTarget = options?.keyboardTarget ?? (typeof window === 'undefined' ? new EventTarget() : window);

    const ids =
      config.playerIds && config.playerIds.length > 0
        ? [...config.playerIds]
        : Array.from({ length: config.maxPlayers }, (_, i) => `p${i + 1}`);
    this.#order = ids;
    ids.forEach((playerId, index) => {
      this.#slots.set(playerId, {
        playerId,
        index,
        displayName: `Player ${index + 1}`,
        joined: false,
        ready: false,
        device: null,
        host: null,
        gamepad: null,
      });
    });
  }

  // --- Reads -------------------------------------------------------------

  config(): PlayerRosterConfig {
    return this.#config;
  }

  keyboardProfiles(): readonly KeyboardProfile[] {
    return this.#profiles;
  }

  /**
   * Total device adapters across every player channel - one per seated player.
   * Read by restart-leak diagnostics for the same reason
   * `ActionInputHost.adapterCount` exists: a channel rebuilt without tearing the
   * old one down is invisible from the outside, but not from here.
   */
  get adapterCount(): number {
    let total = 0;
    for (const slot of this.#slots.values()) total += slot.host?.adapterCount ?? 0;
    return total;
  }

  players(): readonly PlayerSlot[] {
    return this.#order.map((id) => this.#view(this.#slots.get(id)!));
  }

  slot(playerId: PlayerId): PlayerSlot | undefined {
    const slot = this.#slots.get(playerId);
    return slot ? this.#view(slot) : undefined;
  }

  joinedPlayers(): readonly PlayerSlot[] {
    return this.players().filter((slot) => slot.joined);
  }

  readyPlayers(): readonly PlayerSlot[] {
    return this.players().filter((slot) => slot.joined && slot.ready);
  }

  connectedPlayers(): readonly PlayerSlot[] {
    return this.players().filter((slot) => slot.joined && slot.connected);
  }

  inputForPlayer(playerId: PlayerId): ActionInput | undefined {
    const slot = this.#slots.get(playerId);
    return slot?.host ?? undefined;
  }

  availableDevices(): readonly DeviceAssignment[] {
    const taken = new Set<string>();
    for (const slot of this.#slots.values()) {
      if (slot.device) taken.add(deviceKey(slot.device));
    }
    const out: DeviceAssignment[] = [];
    for (const profile of this.#profiles) {
      const device: DeviceAssignment = { kind: 'keyboard-profile', profileId: profile.id };
      if (!taken.has(deviceKey(device))) out.push(device);
    }
    for (const pad of this.#gamepadSource()) {
      if (!pad || !pad.connected) continue;
      const device: DeviceAssignment = { kind: 'gamepad-index', index: pad.index };
      if (!taken.has(deviceKey(device))) out.push(device);
    }
    return out;
  }

  canStart(): boolean {
    const joined = this.joinedPlayers();
    if (joined.length < this.#config.minPlayers) return false;
    if (!this.#config.requireReady) return true;
    return joined.every((slot) => slot.ready);
  }

  // --- Roster mutation ---------------------------------------------------

  join(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult {
    const slot = this.#slots.get(playerId);
    if (!slot) return { ok: false, reason: 'unknown-player', detail: `No slot "${playerId}".` };
    if (slot.joined) return { ok: false, reason: 'already-joined', detail: `"${playerId}" has already joined.` };
    if (this.joinedPlayers().length >= this.#config.maxPlayers) {
      return { ok: false, reason: 'roster-full', detail: `All ${this.#config.maxPlayers} slots are taken.` };
    }
    const rejection = this.#checkDevice(playerId, device);
    if (rejection) return rejection;

    slot.joined = true;
    slot.ready = false;
    this.#attach(slot, device);
    return { ok: true, slot: this.#view(slot) };
  }

  leave(playerId: PlayerId): boolean {
    const slot = this.#slots.get(playerId);
    if (!slot || !slot.joined) return false;
    this.#detach(slot);
    slot.joined = false;
    slot.ready = false;
    return true;
  }

  setReady(playerId: PlayerId, ready: boolean): boolean {
    const slot = this.#slots.get(playerId);
    if (!slot || !slot.joined) return false;
    slot.ready = ready;
    return true;
  }

  assignDevice(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult {
    const slot = this.#slots.get(playerId);
    if (!slot) return { ok: false, reason: 'unknown-player', detail: `No slot "${playerId}".` };
    if (!slot.joined) return { ok: false, reason: 'not-joined', detail: `"${playerId}" has not joined.` };
    if (slot.device && sameDevice(slot.device, device)) return { ok: true, slot: this.#view(slot) };
    const rejection = this.#checkDevice(playerId, device);
    if (rejection) return rejection;

    this.#detach(slot);
    this.#attach(slot, device);
    return { ok: true, slot: this.#view(slot) };
  }

  releaseDevice(playerId: PlayerId): boolean {
    const slot = this.#slots.get(playerId);
    if (!slot || !slot.device) return false;
    this.#detach(slot);
    return true;
  }

  /**
   * Advance every player channel one frame. Called exactly once per game step by
   * the runtime, in the same place the global `ActionInput` advances.
   */
  update(): void {
    if (this.#disposed) return;
    for (const id of this.#order) this.#slots.get(id)!.host?.update();
  }

  /** Zero every player channel. Used on focus loss, exactly like the global host. */
  clear(): void {
    for (const slot of this.#slots.values()) slot.host?.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const slot of this.#slots.values()) {
      this.#detach(slot);
      slot.joined = false;
      slot.ready = false;
    }
  }

  // --- Internals ---------------------------------------------------------

  /** Exclusive ownership by default: two slots never share one physical device. */
  #checkDevice(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult | null {
    if (device.kind === 'keyboard-profile' && !this.#profilesById.has(device.profileId)) {
      return { ok: false, reason: 'unknown-device', detail: `No keyboard profile "${device.profileId}".` };
    }
    if (device.kind === 'gamepad-index') {
      const pads = this.#gamepadSource();
      const pad = pads.find((candidate) => candidate?.index === device.index) ?? pads[device.index] ?? null;
      if (!pad || !pad.connected) {
        return { ok: false, reason: 'device-disconnected', detail: `Gamepad ${device.index} is not connected.` };
      }
    }
    const key = deviceKey(device);
    for (const other of this.#slots.values()) {
      if (other.playerId === playerId) continue;
      if (other.device && deviceKey(other.device) === key) {
        return { ok: false, reason: 'device-taken', detail: `${key} already belongs to "${other.playerId}".` };
      }
    }
    return null;
  }

  #attach(slot: MutableSlot, device: DeviceAssignment): void {
    const profileBindings =
      device.kind === 'keyboard-profile' ? (this.#profilesById.get(device.profileId)?.bindings ?? {}) : {};
    const host = new ActionInputHost(profileBindings);

    if (device.kind === 'keyboard-profile') {
      host.addAdapter(new KeyboardAdapter(host, this.#keyboardTarget));
    } else {
      slot.gamepad = host.addAdapter(
        new GamepadAdapter(host, this.#gamepadSource, device.index, {
          deadzone: this.#config.deadzone ?? DEFAULT_GAMEPAD_DEADZONE,
        }),
      );
    }

    slot.host = host;
    slot.device = device;
  }

  #detach(slot: MutableSlot): void {
    // Disposing the host disposes its adapters, which removes their listeners and
    // zeroes their actions. Nothing survives to drive a channel that no longer exists.
    slot.host?.dispose();
    slot.host = null;
    slot.gamepad = null;
    slot.device = null;
  }

  #view(slot: MutableSlot): PlayerSlot {
    const state: PlayerJoinState = !slot.joined ? 'empty' : slot.ready ? 'ready' : 'joined';
    return {
      playerId: slot.playerId,
      index: slot.index,
      displayName: slot.displayName,
      joined: slot.joined,
      ready: slot.ready,
      connected: this.#isConnected(slot),
      device: slot.device,
      state,
    };
  }

  #isConnected(slot: MutableSlot): boolean {
    if (!slot.device) return false;
    if (slot.device.kind === 'keyboard-profile') return true;
    // A gamepad slot reports the adapter's last poll, falling back to a live
    // source read so a slot inspected before its first poll is still truthful.
    if (slot.gamepad?.connected) return true;
    const index = slot.device.index;
    const pads = this.#gamepadSource();
    const pad = pads.find((candidate) => candidate?.index === index) ?? pads[index] ?? null;
    return Boolean(pad?.connected);
  }
}

interface MutableSlot {
  readonly playerId: PlayerId;
  readonly index: number;
  displayName: string;
  joined: boolean;
  ready: boolean;
  device: DeviceAssignment | null;
  host: ActionInputHost | null;
  gamepad: GamepadAdapter | null;
}
