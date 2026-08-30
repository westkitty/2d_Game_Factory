import type {
  ArenaEdge,
  ArenaEdgeBehavior,
  ArenaEdgeRule,
  BallPaddleDocument,
  BallPaddleEvent,
  BallPaddleService,
  BallPaddleState,
  BallPaddleStatus,
  BallState,
  BrickState,
  EventBus,
  GameContext,
  InstalledSystemPack,
  PaddleDefinition,
  PaddleState,
  SystemPackDefinition,
} from '@sw2d/contracts';
import {
  createRng,
  paddleBounceDirection,
  paddleHitOffset,
  serveDirection,
  validateBallPaddleDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import ballPaddleConfigSchema from '../../schemas/ball-paddle-config.schema.json' with { type: 'json' };

export const BALL_PADDLE_CONFIG_SCHEMA_ID = ballPaddleConfigSchema.$id;
registerSchema(ballPaddleConfigSchema);

/**
 * Upper bound on how far the ball may travel in one integration substep, as a
 * fraction of its own radius.
 *
 * This is the high-speed safety story, and it is a *bounded substep* rather than
 * a claim of continuous collision detection. At 0.5 the ball can never move more
 * than half its radius between collision checks, so it cannot pass through a
 * paddle or a brick at any speed the definition permits - it simply costs more
 * substeps as speed rises. The cost is bounded in turn by MAX_SUBSTEPS, and a
 * definition that would need more than that is rejected at install time.
 */
const MAX_TRAVEL_PER_SUBSTEP_RADII = 0.5;
const MAX_SUBSTEPS = 64;

export interface BallPaddleConfig {
  /** Serve automatically when a round begins. Defaults to false: the game decides. */
  readonly autoServe?: boolean;
}

export class MissingBallPaddleDocumentError extends Error {
  constructor() {
    super(
      'sw2d.ball-paddle requires a "ball-paddle" content document. Author content/ball-paddle.json ' +
        '(urn:sw2d:schema:content-ball-paddle:v1).',
    );
    this.name = 'MissingBallPaddleDocumentError';
  }
}

export class UnknownPaddleError extends Error {
  constructor(paddleId: string) {
    super(`Unknown paddle: "${paddleId}".`);
    this.name = 'UnknownPaddleError';
  }
}

export class UnsupportedBallSpeedError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'UnsupportedBallSpeedError';
  }
}

interface MutablePaddle {
  readonly def: PaddleDefinition;
  /** Centre position along the travel axis. */
  travel: number;
  intent: number;
}

interface MutableBrick {
  readonly placementId: string;
  readonly brickId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  hp: number;
  destroyed: boolean;
}

function edgeBehavior(edges: readonly ArenaEdgeRule[], edge: ArenaEdge): ArenaEdgeBehavior {
  return edges.find((rule) => rule.edge === edge)?.behavior ?? 'bounce';
}

function edgeRule(edges: readonly ArenaEdgeRule[], edge: ArenaEdge): ArenaEdgeRule | undefined {
  return edges.find((rule) => rule.edge === edge);
}

/**
 * The reusable ball/paddle simulation.
 *
 * Pure and deterministic: given the same definition, the same intents and the
 * same `deltaMs` sequence it produces the same events on every machine. Nothing
 * here reads a clock, a renderer or `Math.random`.
 */
export class BallPaddleServiceImpl implements BallPaddleService {
  readonly #doc: BallPaddleDocument;
  readonly #events: EventBus | undefined;
  readonly #paddles = new Map<string, MutablePaddle>();
  readonly #bricks: MutableBrick[] = [];
  readonly #scores = new Map<string, number>();
  readonly #maxSubstepDistance: number;

  /** Events observed since the last `drainEvents()`. The single observation path. */
  readonly #pending: BallPaddleEvent[] = [];
  #status: BallPaddleStatus = 'idle';
  #ballX = 0;
  #ballY = 0;
  #vx = 0;
  #vy = 0;
  #speed = 0;
  #live = false;
  #serves = 0;
  #lives: number;
  #winnerId: string | null = null;

  constructor(doc: BallPaddleDocument, events?: EventBus) {
    validateBallPaddleDocument(doc);
    this.#doc = doc;
    this.#events = events;
    this.#lives = doc.match?.lives ?? Number.POSITIVE_INFINITY;
    this.#maxSubstepDistance = doc.ball.radius * MAX_TRAVEL_PER_SUBSTEP_RADII;

    // A definition whose top speed cannot be integrated safely inside the
    // substep budget is a configuration error, not a runtime surprise. 1/30s is
    // the slowest frame this budget is designed to absorb.
    const worstCaseTravel = (doc.ball.maximumSpeed * 1) / 30;
    if (worstCaseTravel / this.#maxSubstepDistance > MAX_SUBSTEPS) {
      throw new UnsupportedBallSpeedError(
        `ball.maximumSpeed ${doc.ball.maximumSpeed} with radius ${doc.ball.radius} would need more than ` +
          `${MAX_SUBSTEPS} substeps at 30fps. Raise the radius or lower the speed.`,
      );
    }

    for (const def of doc.paddles) {
      this.#paddles.set(def.id, {
        def,
        travel: this.#centreTravel(def),
        intent: 0,
      });
      if (def.playerId !== undefined) this.#scores.set(def.playerId, 0);
    }
    for (const rule of doc.arena.edges) {
      if (rule.scoresFor !== undefined) this.#scores.set(rule.scoresFor, 0);
    }
    this.#resetBricks();
    this.#parkBall();
  }

  // --- Reads -------------------------------------------------------------

  definition(): BallPaddleDocument {
    return this.#doc;
  }

  status(): BallPaddleStatus {
    return this.#status;
  }

  ballState(): BallState {
    return {
      x: round2(this.#ballX),
      y: round2(this.#ballY),
      vx: round2(this.#vx),
      vy: round2(this.#vy),
      speed: round2(this.#speed),
      live: this.#live,
    };
  }

  paddle(paddleId: string): PaddleState | undefined {
    const paddle = this.#paddles.get(paddleId);
    return paddle ? this.#paddleState(paddle) : undefined;
  }

  bricks(): readonly BrickState[] {
    return this.#bricks.map((brick) => ({
      placementId: brick.placementId,
      brickId: brick.brickId,
      x: brick.x,
      y: brick.y,
      width: brick.width,
      height: brick.height,
      hp: brick.hp,
      destroyed: brick.destroyed,
    }));
  }

  score(ownerId: string): number {
    return this.#scores.get(ownerId) ?? 0;
  }

  livesRemaining(): number {
    return this.#lives;
  }

  state(): BallPaddleState {
    return {
      status: this.#status,
      ball: this.ballState(),
      paddles: [...this.#paddles.values()].map((paddle) => this.#paddleState(paddle)),
      bricks: this.bricks(),
      scores: Object.fromEntries(this.#scores),
      livesRemaining: this.#lives,
      serves: this.#serves,
      bricksRemaining: this.#bricks.filter((brick) => !brick.destroyed).length,
      winnerId: this.#winnerId,
    };
  }

  // --- Control -----------------------------------------------------------

  setPaddleIntent(paddleId: string, intent: number): void {
    const paddle = this.#paddles.get(paddleId);
    if (!paddle) throw new UnknownPaddleError(paddleId);
    paddle.intent = intent < -1 ? -1 : intent > 1 ? 1 : intent;
  }

  serve(): void {
    if (this.#status === 'complete') return;
    const ball = this.#doc.ball;
    const direction = serveDirection(ball.servePolicy, this.#serves, createRng);
    this.#serves += 1;
    this.#ballX = this.#doc.arena.serveX;
    this.#ballY = this.#doc.arena.serveY;
    this.#speed = ball.initialSpeed;
    this.#vx = direction.dx * this.#speed;
    this.#vy = direction.dy * this.#speed;
    this.#live = true;
    this.#status = 'playing';
    this.#emit([{ kind: 'served', vx: round2(this.#vx), vy: round2(this.#vy) }]);
  }

  /** Take everything observed since the last drain. */
  drainEvents(): readonly BallPaddleEvent[] {
    return this.#pending.splice(0, this.#pending.length);
  }

  /**
   * Advance the simulation.
   *
   * Paddles move first, then the ball is integrated in bounded substeps, so a
   * paddle can always intercept a ball that would otherwise pass it in one frame.
   */
  update(deltaMs: number): void {
    if (this.#status === 'complete' || deltaMs <= 0) return;
    const seconds = deltaMs / 1000;
    const events: BallPaddleEvent[] = [];

    for (const paddle of this.#paddles.values()) this.#movePaddle(paddle, seconds);
    if (!this.#live) {
      this.#emit(events);
      return;
    }

    const distance = Math.hypot(this.#vx, this.#vy) * seconds;
    const substeps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(distance / this.#maxSubstepDistance)));
    const stepSeconds = seconds / substeps;

    for (let i = 0; i < substeps && this.#live; i++) {
      this.#ballX += this.#vx * stepSeconds;
      this.#ballY += this.#vy * stepSeconds;
      this.#resolveBricks(events);
      this.#resolvePaddles(events);
      this.#resolveEdges(events);
    }

    this.#checkCompletion(events);
    this.#emit(events);
  }

  resetRound(): void {
    for (const paddle of this.#paddles.values()) {
      paddle.travel = this.#centreTravel(paddle.def);
      paddle.intent = 0;
    }
    this.#parkBall();
    if (this.#status !== 'complete') this.#status = 'idle';
  }

  reset(): void {
    this.#pending.length = 0;
    for (const key of this.#scores.keys()) this.#scores.set(key, 0);
    this.#lives = this.#doc.match?.lives ?? Number.POSITIVE_INFINITY;
    this.#serves = 0;
    this.#winnerId = null;
    this.#status = 'idle';
    this.#resetBricks();
    this.resetRound();
    this.#status = 'idle';
  }

  // --- Internals ---------------------------------------------------------

  #centreTravel(def: PaddleDefinition): number {
    return (def.minTravel + def.maxTravel) / 2;
  }

  #parkBall(): void {
    this.#ballX = this.#doc.arena.serveX;
    this.#ballY = this.#doc.arena.serveY;
    this.#vx = 0;
    this.#vy = 0;
    this.#speed = 0;
    this.#live = false;
  }

  #resetBricks(): void {
    this.#bricks.length = 0;
    const byId = new Map((this.#doc.bricks ?? []).map((brick) => [brick.id, brick]));
    for (const placement of this.#doc.layout ?? []) {
      const def = byId.get(placement.brickId)!;
      this.#bricks.push({
        placementId: placement.id,
        brickId: placement.brickId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        hp: def.hp,
        destroyed: false,
      });
    }
  }

  #paddleState(paddle: MutablePaddle): PaddleState {
    const { x, y } = this.#paddlePosition(paddle);
    return {
      id: paddle.def.id,
      x: round2(x),
      y: round2(y),
      intent: paddle.intent,
      atMin: paddle.travel <= paddle.def.minTravel + 1e-6,
      atMax: paddle.travel >= paddle.def.maxTravel - 1e-6,
    };
  }

  #paddlePosition(paddle: MutablePaddle): { x: number; y: number } {
    return paddle.def.axis === 'vertical'
      ? { x: paddle.def.fixedX, y: paddle.travel }
      : { x: paddle.travel, y: paddle.def.fixedY };
  }

  #movePaddle(paddle: MutablePaddle, seconds: number): void {
    if (paddle.intent === 0) return;
    const next = paddle.travel + paddle.intent * paddle.def.speed * seconds;
    paddle.travel = Math.min(paddle.def.maxTravel, Math.max(paddle.def.minTravel, next));
  }

  #resolveBricks(events: BallPaddleEvent[]): void {
    const radius = this.#doc.ball.radius;
    for (const brick of this.#bricks) {
      if (brick.destroyed) continue;
      if (!overlapsCircle(brick, this.#ballX, this.#ballY, radius)) continue;

      // Reflect off whichever face was actually approached, decided by the
      // shallower penetration - the standard AABB response, and the reason a
      // ball entering a brick column from the side does not fly upward.
      const overlapX = radius + brick.width / 2 - Math.abs(this.#ballX - (brick.x + brick.width / 2));
      const overlapY = radius + brick.height / 2 - Math.abs(this.#ballY - (brick.y + brick.height / 2));
      if (overlapX < overlapY) {
        this.#vx = -this.#vx;
        this.#ballX += this.#vx > 0 ? overlapX : -overlapX;
      } else {
        this.#vy = -this.#vy;
        this.#ballY += this.#vy > 0 ? overlapY : -overlapY;
      }

      brick.hp -= 1;
      const def = (this.#doc.bricks ?? []).find((candidate) => candidate.id === brick.brickId)!;
      if (brick.hp > 0) {
        events.push({ kind: 'brick-hit', placementId: brick.placementId, brickId: brick.brickId, hpRemaining: brick.hp });
      } else {
        brick.destroyed = true;
        events.push({
          kind: 'brick-destroyed',
          placementId: brick.placementId,
          brickId: brick.brickId,
          score: def.score,
          ...(def.itemDropId !== undefined ? { itemDropId: def.itemDropId } : {}),
        });
        this.#addScore(this.#defaultScoreOwner(), def.score);
      }
      // One brick per substep: resolving two simultaneously would double-reflect.
      return;
    }
  }

  #resolvePaddles(events: BallPaddleEvent[]): void {
    const radius = this.#doc.ball.radius;
    const ball = this.#doc.ball;
    for (const paddle of this.#paddles.values()) {
      const { x, y } = this.#paddlePosition(paddle);
      const box = {
        x: x - paddle.def.width / 2,
        y: y - paddle.def.height / 2,
        width: paddle.def.width,
        height: paddle.def.height,
      };
      if (!overlapsCircle(box, this.#ballX, this.#ballY, radius)) continue;

      const { nx, ny } = normalOf(paddle.def.facing);
      // Only bounce a ball that is actually travelling into the paddle face.
      // Without this an overlapping ball would flip direction every substep.
      if (this.#vx * nx + this.#vy * ny >= 0) continue;

      const relative = paddleHitOffset(paddle.def, x, y, this.#ballX, this.#ballY);
      const direction = paddleBounceDirection(
        paddle.def.facing,
        relative,
        ball.maximumBounceAngleDegrees,
        paddle.def.bounceInfluence,
      );
      this.#speed = clamp(this.#speed + ball.speedIncreasePerHit, ball.minimumSpeed, ball.maximumSpeed);
      this.#vx = direction.dx * this.#speed;
      this.#vy = direction.dy * this.#speed;

      // Push clear of the face so the next substep starts outside the paddle.
      const clearance =
        paddle.def.axis === 'vertical' ? paddle.def.width / 2 + radius : paddle.def.height / 2 + radius;
      this.#ballX = x + nx * clearance;
      this.#ballY = y + ny * clearance;

      events.push({
        kind: 'paddle-bounce',
        paddleId: paddle.def.id,
        relative: round4(relative),
        speed: round2(this.#speed),
        vx: round2(this.#vx),
        vy: round2(this.#vy),
      });
      return;
    }
  }

  #resolveEdges(events: BallPaddleEvent[]): void {
    const arena = this.#doc.arena;
    const radius = this.#doc.ball.radius;
    const checks: readonly { edge: ArenaEdge; past: boolean; clamp: number; flipX: boolean }[] = [
      { edge: 'left', past: this.#ballX - radius <= arena.left, clamp: arena.left + radius, flipX: true },
      { edge: 'right', past: this.#ballX + radius >= arena.right, clamp: arena.right - radius, flipX: true },
      { edge: 'top', past: this.#ballY - radius <= arena.top, clamp: arena.top + radius, flipX: false },
      { edge: 'bottom', past: this.#ballY + radius >= arena.bottom, clamp: arena.bottom - radius, flipX: false },
    ];

    for (const check of checks) {
      if (!check.past) continue;
      const behavior = edgeBehavior(arena.edges, check.edge);

      if (behavior === 'bounce') {
        if (check.flipX) {
          this.#ballX = check.clamp;
          this.#vx = -this.#vx;
        } else {
          this.#ballY = check.clamp;
          this.#vy = -this.#vy;
        }
        events.push({ kind: 'wall-bounce', edge: check.edge });
        continue;
      }

      const rule = edgeRule(arena.edges, check.edge);
      this.#live = false;
      if (behavior === 'goal') {
        const owner = rule?.scoresFor;
        const next = owner ? this.#addScore(owner, 1) : 0;
        events.push({
          kind: 'goal',
          edge: check.edge,
          ...(rule?.id !== undefined ? { edgeId: rule.id } : {}),
          ...(owner !== undefined ? { scoresFor: owner } : {}),
          score: next,
        });
      } else {
        if (Number.isFinite(this.#lives)) this.#lives -= 1;
        events.push({ kind: 'ball-lost', edge: check.edge, livesRemaining: this.#lives });
      }
      this.#status = 'round-over';
      this.#parkBall();
      return;
    }
  }

  /** Breakout has no per-owner goal, so brick score accrues to the first paddle's player. */
  #defaultScoreOwner(): string {
    const first = this.#doc.paddles[0];
    return first?.playerId ?? first?.id ?? 'player';
  }

  #addScore(ownerId: string, delta: number): number {
    const next = (this.#scores.get(ownerId) ?? 0) + delta;
    this.#scores.set(ownerId, next);
    return next;
  }

  #checkCompletion(events: BallPaddleEvent[]): void {
    if (this.#status === 'complete') return;
    const match = this.#doc.match;

    if (this.#bricks.length > 0 && this.#bricks.every((brick) => brick.destroyed)) {
      this.#complete(this.#defaultScoreOwner(), events, true);
      return;
    }

    if (match?.targetScore !== undefined) {
      for (const [owner, score] of this.#scores) {
        if (score >= match.targetScore) {
          this.#complete(owner, events, false);
          return;
        }
      }
    }

    if (Number.isFinite(this.#lives) && this.#lives <= 0) {
      this.#complete(null, events, false);
    }
  }

  /**
   * End the match. The ball is parked as part of the transition: a status of
   * `complete` alongside a live ball is contradictory state, and a consumer
   * drawing `ball.live` would show a ball hanging in mid-air forever.
   */
  #complete(winnerId: string | null, events: BallPaddleEvent[], roundComplete: boolean): void {
    this.#status = 'complete';
    this.#winnerId = winnerId;
    this.#parkBall();
    if (roundComplete) events.push({ kind: 'round-complete' });
    events.push({ kind: 'match-complete', winnerId });
  }

  #emit(events: BallPaddleEvent[]): void {
    this.#pending.push(...events);
    if (!this.#events) return;
    for (const event of events) {
      switch (event.kind) {
        case 'paddle-bounce':
          this.#events.emit('ballPaddle:paddleBounce', { paddleId: event.paddleId, relative: event.relative, speed: event.speed });
          break;
        case 'brick-destroyed':
          this.#events.emit('ballPaddle:brickDestroyed', { placementId: event.placementId, brickId: event.brickId, score: event.score });
          break;
        case 'goal':
          this.#events.emit('ballPaddle:goal', { edge: event.edge, scoresFor: event.scoresFor ?? null, score: event.score });
          break;
        case 'ball-lost':
          this.#events.emit('ballPaddle:ballLost', { edge: event.edge, livesRemaining: Number.isFinite(event.livesRemaining) ? event.livesRemaining : -1 });
          break;
        case 'match-complete':
          this.#events.emit('ballPaddle:matchComplete', { winnerId: event.winnerId });
          break;
        default:
          break;
      }
    }
  }
}

function normalOf(facing: PaddleDefinition['facing']): { nx: number; ny: number } {
  switch (facing) {
    case 'left':
      return { nx: -1, ny: 0 };
    case 'right':
      return { nx: 1, ny: 0 };
    case 'up':
      return { nx: 0, ny: -1 };
    case 'down':
      return { nx: 0, ny: 1 };
  }
}

function overlapsCircle(
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const nearestX = Math.min(box.x + box.width, Math.max(box.x, cx));
  const nearestY = Math.min(box.y + box.height, Math.max(box.y, cy));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export const ballPaddlePack: SystemPackDefinition<BallPaddleConfig, GameContext> = {
  id: PACK_IDS.ballPaddle,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.ballPaddle],
  dependencies: [],
  configSchemaId: BALL_PADDLE_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: BallPaddleConfig): InstalledSystemPack {
    const doc = context.content.data['ball-paddle']?.value as BallPaddleDocument | undefined;
    if (!doc) throw new MissingBallPaddleDocumentError();

    const service = new BallPaddleServiceImpl(doc, context.events);
    if (config?.autoServe) service.serve();
    const handle = context.capabilities.provide(CAPABILITY_IDS.ballPaddle, service);

    return {
      id: PACK_IDS.ballPaddle,
      // The single owner of frame advancement. A consumer observes through
      // `drainEvents()`; it has no way to advance the simulation itself, so it
      // cannot double-step the ball or discard the events of a step it drove.
      update(deltaMs: number): void {
        service.update(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { BallPaddleService } from '@sw2d/contracts';
