import {
  PLAYER_INPUT_CAPABILITY_ID,
  type DeviceAssignment,
  type InstalledSystemPack,
  type PlayerId,
  type PlayerInputService,
  type PlayerJoinResult,
  type PlayerSlot,
} from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 15 proof - local-party-game.
 *
 * Every multiplayer concept here comes from the reusable `input.players`
 * capability: slots, join/leave/ready, exclusive device ownership, per-player
 * semantic channels, gamepad connection state. This shell contributes only what
 * a reusable capability cannot know - what a seated player's body looks like and
 * where it moves - plus a small set of test controls the browser proof drives.
 *
 * Note what is *not* here: no `P1_MOVE_LEFT`, no keyboard event handling, no
 * per-player binding table. Each body is moved by handing that player's own
 * `ActionInput` to the ordinary shared `topDownController`, exactly as a
 * single-player top-down game does.
 */

export const PARTY_SHELL_CAPABILITY_ID = 'game.party-shell';

const SPEED = 220;
const ARENA = { left: 40, right: 920, top: 40, bottom: 500 };
const SPAWNS: Readonly<Record<string, { x: number; y: number }>> = {
  red: { x: 200, y: 150 },
  blue: { x: 700, y: 150 },
  green: { x: 200, y: 400 },
  gold: { x: 700, y: 400 },
};

export interface PartyBodyState {
  readonly x: number;
  readonly y: number;
  readonly moveX: number;
  readonly moveY: number;
  readonly jumpPresses: number;
}

export interface PartyShellState {
  readonly phase: 'lobby' | 'playing';
  readonly canStart: boolean;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly requireReady: boolean;
  readonly slots: readonly PlayerSlot[];
  readonly availableDevices: readonly DeviceAssignment[];
  readonly bodies: Readonly<Record<string, PartyBodyState>>;
  /** Total device adapters across every player channel - the restart-leak probe. */
  readonly playerAdapterCount: number;
  readonly rounds: number;
}

export interface PartyShellService {
  state(): PartyShellState;
  join(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  leave(playerId: PlayerId): boolean;
  ready(playerId: PlayerId, ready: boolean): boolean;
  assign(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  releaseDevice(playerId: PlayerId): boolean;
  start(): boolean;
  /** Back to the lobby without tearing down the roster - a new round, not a new game. */
  endRound(): void;
  /** Live per-player action reads, for asserting isolation without touching internals. */
  held(playerId: PlayerId): Readonly<Record<string, boolean>> | null;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: PARTY_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [PARTY_SHELL_CAPABILITY_ID],
  dependencies: [PLAYER_INPUT_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const players = context.capabilities.require<PlayerInputService>(PLAYER_INPUT_CAPABILITY_ID);
    const config = players.config();

    let phase: 'lobby' | 'playing' = 'lobby';
    let rounds = 0;

    interface Body {
      x: number;
      y: number;
      moveX: number;
      moveY: number;
      jumpPresses: number;
      sprite: Phaser.GameObjects.Sprite;
    }

    const bodies = new Map<PlayerId, Body>();

    function spawnFor(playerId: PlayerId, index: number): { x: number; y: number } {
      return SPAWNS[playerId] ?? { x: 200 + index * 160, y: 270 };
    }

    function ensureBody(slot: PlayerSlot): Body {
      const existing = bodies.get(slot.playerId);
      if (existing) return existing;
      const spawn = spawnFor(slot.playerId, slot.index);
      const sprite = scene.add.sprite(spawn.x, spawn.y, context.assets.resolve('player'));
      const body: Body = { x: spawn.x, y: spawn.y, moveX: 0, moveY: 0, jumpPresses: 0, sprite };
      bodies.set(slot.playerId, body);
      return body;
    }

    function removeBody(playerId: PlayerId): void {
      const body = bodies.get(playerId);
      if (!body) return;
      body.sprite.destroy();
      bodies.delete(playerId);
    }

    function syncBodies(): void {
      const joined = new Set(players.joinedPlayers().map((slot) => slot.playerId));
      for (const slot of players.players()) {
        if (slot.joined) ensureBody(slot);
        else removeBody(slot.playerId);
      }
      for (const id of [...bodies.keys()]) {
        if (!joined.has(id)) removeBody(id);
      }
    }

    function bodyStates(): Record<string, PartyBodyState> {
      const out: Record<string, PartyBodyState> = {};
      for (const [id, body] of bodies) {
        out[id] = {
          x: Math.round(body.x * 100) / 100,
          y: Math.round(body.y * 100) / 100,
          moveX: body.moveX,
          moveY: body.moveY,
          jumpPresses: body.jumpPresses,
        };
      }
      return out;
    }

    function state(): PartyShellState {
      return {
        phase,
        canStart: players.canStart(),
        minPlayers: config.minPlayers,
        maxPlayers: config.maxPlayers,
        requireReady: config.requireReady,
        slots: players.players(),
        availableDevices: players.availableDevices(),
        bodies: bodyStates(),
        playerAdapterCount: playerAdapterCount(),
        rounds,
      };
    }

    /**
     * `PlayerInputHub` exposes this as a getter for restart-leak diagnostics; it
     * is not on the renderer-neutral `PlayerInputService` interface, so read it
     * defensively rather than widening the contract for a debug probe.
     */
    function playerAdapterCount(): number {
      const probe = players as PlayerInputService & { adapterCount?: number };
      return typeof probe.adapterCount === 'number' ? probe.adapterCount : -1;
    }

    const shellService: PartyShellService = {
      state,

      join(playerId, device) {
        const result = players.join(playerId, device);
        if (result.ok) syncBodies();
        return result;
      },

      leave(playerId) {
        const left = players.leave(playerId);
        if (left) syncBodies();
        return left;
      },

      ready: (playerId, ready) => players.setReady(playerId, ready),

      assign(playerId, device) {
        return players.assignDevice(playerId, device);
      },

      releaseDevice: (playerId) => players.releaseDevice(playerId),

      start() {
        if (!players.canStart()) return false;
        phase = 'playing';
        rounds += 1;
        syncBodies();
        return true;
      },

      endRound() {
        phase = 'lobby';
      },

      held(playerId) {
        const input = players.inputForPlayer(playerId);
        if (!input) return null;
        return {
          MOVE_LEFT: input.isDown('MOVE_LEFT'),
          MOVE_RIGHT: input.isDown('MOVE_RIGHT'),
          MOVE_UP: input.isDown('MOVE_UP'),
          MOVE_DOWN: input.isDown('MOVE_DOWN'),
          JUMP: input.isDown('JUMP'),
          PRIMARY_ACTION: input.isDown('PRIMARY_ACTION'),
        };
      },
    };

    const serviceHandle = context.capabilities.provide(PARTY_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(PARTY_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: PARTY_SHELL_CAPABILITY_ID,

      update(deltaMs: number): void {
        if (disposed || phase !== 'playing') return;
        const step = (SPEED * deltaMs) / 1000;

        for (const slot of players.joinedPlayers()) {
          const input = players.inputForPlayer(slot.playerId);
          const body = bodies.get(slot.playerId);
          if (!input || !body) continue;

          // The ordinary shared controller, reading this player's own channel.
          const intent = topDownController.read(input);
          body.moveX = intent.moveX;
          body.moveY = intent.moveY;
          if (input.justPressed('JUMP')) body.jumpPresses += 1;

          body.x = Math.min(ARENA.right, Math.max(ARENA.left, body.x + intent.moveX * step));
          body.y = Math.min(ARENA.bottom, Math.max(ARENA.top, body.y + intent.moveY * step));
          body.sprite.setPosition(body.x, body.y);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          for (const body of bodies.values()) body.sprite.destroy();
        } catch {
          /* tearing down */
        }
        bodies.clear();
      },
    };
  },
};
