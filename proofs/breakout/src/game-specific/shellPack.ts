import {
  BALL_PADDLE_CAPABILITY_ID,
  type BallPaddleEvent,
  type BallPaddleService,
  type BallPaddleState,
  type InstalledSystemPack,
} from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 16 proof - breakout.
 *
 * Every rule of the game comes from `arcade.ball-paddle`: the serve, the wall
 * bounce, the hit-location steering, the speed ramp, brick hit points, brick
 * destruction and scoring, the loss edge, lives, and board-clear completion.
 *
 * This shell contributes only presentation and the one thing a renderer-neutral
 * simulation cannot own - turning a controller intent into a paddle intent, and
 * drawing what the simulation reports. It holds no ball position of its own, no
 * brick hit points and no score: it reads them.
 */

export const BREAKOUT_SHELL_CAPABILITY_ID = 'game.breakout-shell';

export interface BreakoutShellState extends BallPaddleState {
  /** Every event the simulation reported this frame, so the proof can assert facts. */
  readonly lastEvents: readonly string[];
  /** Running counts, so a proof can assert a fact that happened frames ago. */
  readonly counts: Readonly<Record<string, number>>;
  readonly lastBounceRelative: number | null;
  readonly lastDropItemId: string | null;
}

export interface BreakoutShellService {
  state(): BreakoutShellState;
  serve(): void;
  /**
   * Move the paddle to an exact travel position while the ball is parked.
   *
   * A setup control, not a game rule, and deliberately refused once the ball is
   * live: it advances the simulation to move the paddle, so using it mid-rally
   * would advance the ball too and make the frame budget a lie. During play the
   * paddle is driven the only way a player can drive it - the controller.
   */
  parkPaddle(x: number): boolean;
  resetRound(): void;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: BREAKOUT_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [BREAKOUT_SHELL_CAPABILITY_ID],
  dependencies: [BALL_PADDLE_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const sim = context.capabilities.require<BallPaddleService>(BALL_PADDLE_CAPABILITY_ID);
    const doc = sim.definition();

    const ballSprite = scene.add.circle(doc.arena.serveX, doc.arena.serveY, doc.ball.radius, 0xf5f0e6);
    const paddleDef = doc.paddles[0]!;
    const paddleSprite = scene.add.rectangle(
      paddleDef.fixedX,
      paddleDef.fixedY,
      paddleDef.width,
      paddleDef.height,
      0x65d0a8,
    );
    const brickSprites = new Map<string, Phaser.GameObjects.Rectangle>();
    for (const brick of sim.bricks()) {
      brickSprites.set(
        brick.placementId,
        scene.add.rectangle(
          brick.x + brick.width / 2,
          brick.y + brick.height / 2,
          brick.width - 4,
          brick.height - 4,
          brick.brickId === 'tough' ? 0xe05fa0 : 0x5a678f,
        ),
      );
    }

    let lastEvents: string[] = [];
    /** Set by `parkPaddle`; steers the paddle by intent until it arrives. */
    let parkTarget: number | null = null;
    let lastBounceRelative: number | null = null;
    let lastDropItemId: string | null = null;
    const counts: Record<string, number> = {
      served: 0,
      'wall-bounce': 0,
      'paddle-bounce': 0,
      'brick-hit': 0,
      'brick-destroyed': 0,
      'ball-lost': 0,
      'match-complete': 0,
    };

    function absorb(events: readonly BallPaddleEvent[]): void {
      if (events.length > 0) lastEvents = events.map((event) => event.kind);
      for (const event of events) {
        counts[event.kind] = (counts[event.kind] ?? 0) + 1;
        if (event.kind === 'paddle-bounce') lastBounceRelative = event.relative;
        if (event.kind === 'brick-destroyed') {
          brickSprites.get(event.placementId)?.destroy();
          brickSprites.delete(event.placementId);
          if (event.itemDropId !== undefined) lastDropItemId = event.itemDropId;
        }
      }
    }

    function state(): BreakoutShellState {
      return {
        ...sim.state(),
        lastEvents: [...lastEvents],
        counts: { ...counts },
        lastBounceRelative,
        lastDropItemId,
      };
    }

    const shellService: BreakoutShellService = {
      state,
      serve() {
        sim.serve();
        absorb(sim.drainEvents());
      },
      parkPaddle(x: number): boolean {
        if (sim.state().ball.live) return false;
        // Feed the same public intent a controller would, rather than writing a
        // position behind the simulation's back. Safe here precisely because the
        // ball is parked, so advancing the simulation moves nothing but the paddle.
        // Nudge the intent and let the pack's own frame advance move the paddle;
        // the proof holds the position for a few frames. Nothing here advances
        // the simulation, because the pack is its only driver.
        const target = Math.min(paddleDef.maxTravel, Math.max(paddleDef.minTravel, x));
        parkTarget = target;
        return true;
      },
      resetRound() {
        sim.resetRound();
        lastEvents = [];
        parkTarget = null;
      },
      reset() {
        sim.reset();
        lastEvents = [];
        parkTarget = null;
        lastBounceRelative = null;
        lastDropItemId = null;
        for (const key of Object.keys(counts)) counts[key] = 0;
        for (const sprite of brickSprites.values()) sprite.destroy();
        brickSprites.clear();
        for (const brick of sim.bricks()) {
          brickSprites.set(
            brick.placementId,
            scene.add.rectangle(
              brick.x + brick.width / 2,
              brick.y + brick.height / 2,
              brick.width - 4,
              brick.height - 4,
              brick.brickId === 'tough' ? 0xe05fa0 : 0x5a678f,
            ),
          );
        }
      },
    };

    const serviceHandle = context.capabilities.provide(BREAKOUT_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(BREAKOUT_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: BREAKOUT_SHELL_CAPABILITY_ID,

      update(): void {
        if (disposed) return;
        // Controller intent in, paddle intent out. The shell moves nothing itself
        // and never advances the simulation - the pack owns that, and this reads
        // what happened through the drain.
        if (parkTarget !== null) {
          const current = sim.paddle('paddle')!.x;
          const delta = parkTarget - current;
          if (Math.abs(delta) < 2) {
            sim.setPaddleIntent('paddle', 0);
            parkTarget = null;
          } else {
            sim.setPaddleIntent('paddle', delta > 0 ? 1 : -1);
          }
        } else {
          const intent = topDownController.read(context.input);
          sim.setPaddleIntent('paddle', intent.moveX);
        }
        absorb(sim.drainEvents());

        const snapshot = sim.state();
        ballSprite.setPosition(snapshot.ball.x, snapshot.ball.y);
        const paddle = snapshot.paddles[0];
        if (paddle) paddleSprite.setPosition(paddle.x, paddle.y);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        try {
          ballSprite.destroy();
          paddleSprite.destroy();
          for (const sprite of brickSprites.values()) sprite.destroy();
        } catch {
          /* tearing down */
        }
        brickSprites.clear();
      },
    };
  },
};
