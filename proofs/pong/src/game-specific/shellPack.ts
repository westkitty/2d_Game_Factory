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
 * Phase 15 proof - pong, INPUT FOUNDATION ONLY.
 *
 * Deliberately not a finished Pong. There is no ball, no bounce, no serve and no
 * score, because those belong to `arcade.ball-paddle` in Phase 16. What this
 * proves is the half Phase 15 owns: two seated players, two paddles, two
 * independent semantic channels, and simultaneous *opposite* intent with no
 * cross-talk - the property a two-player game cannot be built on top of unless
 * it actually holds.
 *
 * Phase 16 will consume this shell rather than replace it.
 */

export const PONG_SHELL_CAPABILITY_ID = 'game.pong-shell';

const PADDLE_SPEED = 320;
const PADDLE_HEIGHT = 96;
const COURT = { top: 40, bottom: 500 };
const PADDLE_X: Readonly<Record<string, number>> = { left: 80, right: 880 };

export interface PongPaddleState {
  readonly x: number;
  readonly y: number;
  /** -1 up, +1 down, 0 still. The paddle-intent channel this phase is about. */
  readonly moveY: number;
  readonly atTop: boolean;
  readonly atBottom: boolean;
}

export interface PongShellState {
  readonly phase: 'lobby' | 'playing';
  readonly canStart: boolean;
  readonly slots: readonly PlayerSlot[];
  readonly paddles: Readonly<Record<string, PongPaddleState>>;
  readonly playerAdapterCount: number;
  /** True when the two paddles are moving in opposite directions this frame. */
  readonly oppositeIntent: boolean;
}

export interface PongShellService {
  state(): PongShellState;
  join(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  start(): boolean;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: PONG_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [PONG_SHELL_CAPABILITY_ID],
  dependencies: [PLAYER_INPUT_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const players = context.capabilities.require<PlayerInputService>(PLAYER_INPUT_CAPABILITY_ID);

    let phase: 'lobby' | 'playing' = 'lobby';

    interface Paddle {
      x: number;
      y: number;
      moveY: number;
      sprite: Phaser.GameObjects.Rectangle;
    }

    const paddles = new Map<PlayerId, Paddle>();

    function ensurePaddle(slot: PlayerSlot): void {
      if (paddles.has(slot.playerId)) return;
      const x = PADDLE_X[slot.playerId] ?? 80 + slot.index * 800;
      const y = (COURT.top + COURT.bottom) / 2;
      const sprite = scene.add.rectangle(x, y, 16, PADDLE_HEIGHT, 0x65d0a8);
      paddles.set(slot.playerId, { x, y, moveY: 0, sprite });
    }

    function syncPaddles(): void {
      for (const slot of players.joinedPlayers()) ensurePaddle(slot);
    }

    function paddleStates(): Record<string, PongPaddleState> {
      const out: Record<string, PongPaddleState> = {};
      for (const [id, paddle] of paddles) {
        out[id] = {
          x: paddle.x,
          y: Math.round(paddle.y * 100) / 100,
          moveY: paddle.moveY,
          atTop: paddle.y <= COURT.top + PADDLE_HEIGHT / 2 + 0.001,
          atBottom: paddle.y >= COURT.bottom - PADDLE_HEIGHT / 2 - 0.001,
        };
      }
      return out;
    }

    function playerAdapterCount(): number {
      const probe = players as PlayerInputService & { adapterCount?: number };
      return typeof probe.adapterCount === 'number' ? probe.adapterCount : -1;
    }

    function state(): PongShellState {
      const left = paddles.get('left');
      const right = paddles.get('right');
      return {
        phase,
        canStart: players.canStart(),
        slots: players.players(),
        paddles: paddleStates(),
        playerAdapterCount: playerAdapterCount(),
        oppositeIntent:
          left !== undefined && right !== undefined && left.moveY !== 0 && right.moveY !== 0 && left.moveY !== right.moveY,
      };
    }

    const shellService: PongShellService = {
      state,
      join(playerId, device) {
        const result = players.join(playerId, device);
        if (result.ok) syncPaddles();
        return result;
      },
      start() {
        if (!players.canStart()) return false;
        phase = 'playing';
        syncPaddles();
        return true;
      },
    };

    const serviceHandle = context.capabilities.provide(PONG_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(PONG_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: PONG_SHELL_CAPABILITY_ID,

      update(deltaMs: number): void {
        if (disposed || phase !== 'playing') return;
        const step = (PADDLE_SPEED * deltaMs) / 1000;
        const half = PADDLE_HEIGHT / 2;

        for (const slot of players.joinedPlayers()) {
          const input = players.inputForPlayer(slot.playerId);
          const paddle = paddles.get(slot.playerId);
          if (!input || !paddle) continue;
          // The shared controller again - a paddle is just a body with one axis.
          const intent = topDownController.read(input);
          paddle.moveY = intent.moveY;
          paddle.y = Math.min(COURT.bottom - half, Math.max(COURT.top + half, paddle.y + intent.moveY * step));
          paddle.sprite.setPosition(paddle.x, paddle.y);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          for (const paddle of paddles.values()) paddle.sprite.destroy();
        } catch {
          /* tearing down */
        }
        paddles.clear();
      },
    };
  },
};
