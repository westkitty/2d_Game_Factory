import {
  BALL_PADDLE_CAPABILITY_ID,
  PLAYER_INPUT_CAPABILITY_ID,
  type BallPaddleEvent,
  type BallPaddleService,
  type BallPaddleState,
  type DeviceAssignment,
  type InstalledSystemPack,
  type PlayerId,
  type PlayerInputService,
  type PlayerJoinResult,
  type PlayerSlot,
} from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Pong proof - the composition of two post-ten phases.
 *
 * - **Phase 15 (`input.players`)** seats two players on disjoint devices and
 *   gives each an isolated semantic `ActionInput`.
 * - **Phase 16 (`arcade.ball-paddle`)** owns the ball, both paddles, the serve,
 *   the bounce, the goals and the match rules.
 *
 * The shell is the wire between them: it reads each player's own channel through
 * the ordinary shared `topDownController` and hands the resulting intent to that
 * player's paddle. It owns no ball, no score and no bounce maths - and no
 * per-player input handling either.
 *
 * The Phase-15 journey (two isolated paddle channels, simultaneous opposite
 * intent) is still asserted; Phase 16 adds the ball on top of it rather than
 * replacing it.
 */

export const PONG_SHELL_CAPABILITY_ID = 'game.pong-shell';

export interface PongShellState extends BallPaddleState {
  readonly phase: 'lobby' | 'playing';
  readonly canStart: boolean;
  readonly slots: readonly PlayerSlot[];
  readonly playerAdapterCount: number;
  /** True when the two paddles are moving in opposite directions this frame. */
  readonly oppositeIntent: boolean;
  readonly lastEvents: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  readonly lastBounceRelative: number | null;
}

export interface PongShellService {
  state(): PongShellState;
  join(playerId: PlayerId, device: DeviceAssignment): PlayerJoinResult;
  start(): boolean;
  serve(): void;
  resetRound(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: PONG_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [PONG_SHELL_CAPABILITY_ID],
  dependencies: [PLAYER_INPUT_CAPABILITY_ID, BALL_PADDLE_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const players = context.capabilities.require<PlayerInputService>(PLAYER_INPUT_CAPABILITY_ID);
    const sim = context.capabilities.require<BallPaddleService>(BALL_PADDLE_CAPABILITY_ID);
    const doc = sim.definition();

    let phase: 'lobby' | 'playing' = 'lobby';
    let lastEvents: string[] = [];
    let lastBounceRelative: number | null = null;
    const counts: Record<string, number> = {
      served: 0,
      'wall-bounce': 0,
      'paddle-bounce': 0,
      goal: 0,
      'match-complete': 0,
    };

    const ballSprite = scene.add.circle(doc.arena.serveX, doc.arena.serveY, doc.ball.radius, 0xf5f0e6);
    const paddleSprites = new Map<string, Phaser.GameObjects.Rectangle>();
    for (const def of doc.paddles) {
      paddleSprites.set(
        def.id,
        scene.add.rectangle(def.fixedX, def.fixedY, def.width, def.height, 0x65d0a8),
      );
    }

    function absorb(events: readonly BallPaddleEvent[]): void {
      if (events.length > 0) lastEvents = events.map((event) => event.kind);
      for (const event of events) {
        counts[event.kind] = (counts[event.kind] ?? 0) + 1;
        if (event.kind === 'paddle-bounce') lastBounceRelative = event.relative;
      }
    }

    function playerAdapterCount(): number {
      const probe = players as PlayerInputService & { adapterCount?: number };
      return typeof probe.adapterCount === 'number' ? probe.adapterCount : -1;
    }

    function state(): PongShellState {
      const snapshot = sim.state();
      const left = snapshot.paddles.find((paddle) => paddle.id === 'left');
      const right = snapshot.paddles.find((paddle) => paddle.id === 'right');
      return {
        ...snapshot,
        phase,
        canStart: players.canStart(),
        slots: players.players(),
        playerAdapterCount: playerAdapterCount(),
        oppositeIntent:
          left !== undefined &&
          right !== undefined &&
          left.intent !== 0 &&
          right.intent !== 0 &&
          left.intent !== right.intent,
        lastEvents: [...lastEvents],
        counts: { ...counts },
        lastBounceRelative,
      };
    }

    const shellService: PongShellService = {
      state,
      join: (playerId, device) => players.join(playerId, device),
      start() {
        if (!players.canStart()) return false;
        phase = 'playing';
        return true;
      },
      serve() {
        sim.serve();
        absorb(sim.drainEvents());
      },
      resetRound() {
        sim.resetRound();
        lastEvents = [];
      },
    };

    const serviceHandle = context.capabilities.provide(PONG_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(PONG_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: PONG_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed || phase !== 'playing') return;

        // The Phase 15 -> Phase 16 wire: each paddle answers the channel of the
        // player who owns it, read through the ordinary shared controller.
        for (const def of doc.paddles) {
          if (def.playerId === undefined) continue;
          const input = players.inputForPlayer(def.playerId);
          if (!input) continue;
          const intent = topDownController.read(input);
          sim.setPaddleIntent(def.id, def.axis === 'vertical' ? intent.moveY : intent.moveX);
        }

        absorb(sim.drainEvents());

        const snapshot = sim.state();
        ballSprite.setPosition(snapshot.ball.x, snapshot.ball.y);
        for (const paddle of snapshot.paddles) {
          paddleSprites.get(paddle.id)?.setPosition(paddle.x, paddle.y);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          ballSprite.destroy();
          for (const sprite of paddleSprites.values()) sprite.destroy();
        } catch {
          /* tearing down */
        }
        paddleSprites.clear();
      },
    };
  },
};
