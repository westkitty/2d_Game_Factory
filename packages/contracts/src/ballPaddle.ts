/**
 * Ball & paddle arcade systems (post-ten program Phase 16).
 *
 * One reusable simulation behind both Breakout and Pong: serve, wall bounce,
 * paddle bounce with hit-location steering, bounded speed growth, brick damage
 * and destruction, goals, ball loss, round and match completion.
 *
 * **Renderer-neutral and pure**, following the Phase-10 vehicle/racing precedent
 * rather than delegating to a physics engine. Two reasons, and neither is
 * "physics engines are bad":
 *
 * 1. A ball/paddle game's bounce is *authored*, not simulated. The outgoing
 *    angle is a designed function of where the ball struck the paddle, which is
 *    the opposite of what a restitution solver computes. Expressing that through
 *    an engine means fighting the engine every frame.
 * 2. Determinism. A pure integrator with fixed substeps gives the same result on
 *    every machine, which is what makes the browser proof's exact assertions
 *    meaningful. Arcade Physics is the right tool for a platformer's world; it
 *    is not the authority for this.
 *
 * Matter is explicitly not used: nothing here needs constraints, joints or
 * arbitrary polygon collision (ADR-0026 keeps Matter opt-in for the games that do).
 */

import type { SeededRng } from './generation.ts';

export const BALL_PADDLE_CAPABILITY_ID = 'arcade.ball-paddle';

// --- Geometry ------------------------------------------------------------

export type ArenaEdge = 'left' | 'right' | 'top' | 'bottom';

export const ARENA_EDGES: readonly ArenaEdge[] = ['left', 'right', 'top', 'bottom'];

/** What happens when the ball reaches an arena edge. */
export type ArenaEdgeBehavior = 'bounce' | 'goal' | 'loss';

export interface ArenaEdgeRule {
  readonly edge: ArenaEdge;
  readonly behavior: ArenaEdgeBehavior;
  /** Stable id for a goal/loss edge, reported on the resulting event. */
  readonly id?: string;
  /** For `goal`: whose score increases when the ball leaves through this edge. */
  readonly scoresFor?: string;
}

export interface ArenaDefinition {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  /** Edges not listed here default to `bounce`. */
  readonly edges: readonly ArenaEdgeRule[];
  /** Where a serve places the ball. */
  readonly serveX: number;
  readonly serveY: number;
}

// --- Ball ----------------------------------------------------------------

/**
 * How a serve chooses its direction.
 *
 * `alternate` flips the primary-axis sign each serve, so a Pong serve goes to
 * whoever just conceded. `seeded-direction` uses the project's canonical
 * `createRng` - never `Math.random` - so a seeded game replays identically.
 */
export type ServePolicy =
  | { readonly kind: 'fixed'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'alternate'; readonly dx: number; readonly dy: number }
  | {
      readonly kind: 'seeded-direction';
      readonly seed: number;
      readonly dx: number;
      readonly dy: number;
      /** Half-width of the random cone around the base direction, in degrees. */
      readonly spreadDegrees: number;
    };

export interface BallDefinition {
  readonly id?: string;
  readonly radius: number;
  readonly initialSpeed: number;
  readonly minimumSpeed: number;
  readonly maximumSpeed: number;
  /** Added to speed on each paddle hit, then clamped to [minimum, maximum]. */
  readonly speedIncreasePerHit: number;
  /** Steering authority of a paddle hit, in degrees away from the paddle normal. */
  readonly maximumBounceAngleDegrees: number;
  readonly servePolicy: ServePolicy;
}

// --- Paddle --------------------------------------------------------------

/** The axis a paddle travels along. */
export type PaddleAxis = 'horizontal' | 'vertical';

/** The direction the paddle's face points *into* the court - its bounce normal. */
export type PaddleFacing = 'left' | 'right' | 'up' | 'down';

export function axisForFacing(facing: PaddleFacing): PaddleAxis {
  return facing === 'left' || facing === 'right' ? 'vertical' : 'horizontal';
}

export function normalForFacing(facing: PaddleFacing): { readonly nx: number; readonly ny: number } {
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

export interface PaddleDefinition {
  readonly id: string;
  /** Which player drives it. Consumers route `input.players` channels by this (Phase 15). */
  readonly playerId?: string;
  readonly axis: PaddleAxis;
  readonly facing: PaddleFacing;
  readonly width: number;
  readonly height: number;
  /** World units per second along `axis`. */
  readonly speed: number;
  /** Fixed position on the axis the paddle does NOT travel along. */
  readonly fixedX: number;
  readonly fixedY: number;
  /** Travel limits for the paddle centre along `axis`. */
  readonly minTravel: number;
  readonly maxTravel: number;
  /** 0..1 scale on hit-location steering. 0 makes the paddle a flat mirror. */
  readonly bounceInfluence: number;
}

// --- Bricks --------------------------------------------------------------

export interface BrickDefinition {
  readonly id: string;
  readonly hp: number;
  readonly score: number;
  readonly tags?: readonly string[];
  /** Canonical `sw2d.items` item id (Phase 2). This system never invents its own items. */
  readonly itemDropId?: string;
}

export interface BrickPlacement {
  readonly id: string;
  readonly brickId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// --- Document ------------------------------------------------------------

export interface BallPaddleMatchRules {
  /** First owner to reach this score wins. Omit for a Breakout-style board clear. */
  readonly targetScore?: number;
  /** Ball losses allowed before the match ends. Omit for unlimited. */
  readonly lives?: number;
}

export interface BallPaddleDocument {
  readonly schemaVersion: 1;
  readonly ball: BallDefinition;
  readonly arena: ArenaDefinition;
  readonly paddles: readonly PaddleDefinition[];
  readonly bricks?: readonly BrickDefinition[];
  readonly layout?: readonly BrickPlacement[];
  readonly match?: BallPaddleMatchRules;
}

// --- State ---------------------------------------------------------------

export type BallPaddleStatus = 'idle' | 'serving' | 'playing' | 'round-over' | 'complete';

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly speed: number;
  readonly live: boolean;
}

export interface PaddleState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Latest intent, -1..1 along the paddle's axis. */
  readonly intent: number;
  readonly atMin: boolean;
  readonly atMax: boolean;
}

export interface BrickState {
  readonly placementId: string;
  readonly brickId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly hp: number;
  readonly destroyed: boolean;
}

export interface BallPaddleState {
  readonly status: BallPaddleStatus;
  readonly ball: BallState;
  readonly paddles: readonly PaddleState[];
  readonly bricks: readonly BrickState[];
  readonly scores: Readonly<Record<string, number>>;
  readonly livesRemaining: number;
  readonly serves: number;
  readonly bricksRemaining: number;
  readonly winnerId: string | null;
}

// --- Events --------------------------------------------------------------

/**
 * Returned in order from `update()`. A consumer reacts to these rather than
 * diffing state, so "a brick was destroyed this frame" is a fact rather than an
 * inference - and so a substep that resolves two collisions reports both.
 */
export type BallPaddleEvent =
  | { readonly kind: 'served'; readonly vx: number; readonly vy: number }
  | { readonly kind: 'wall-bounce'; readonly edge: ArenaEdge }
  | {
      readonly kind: 'paddle-bounce';
      readonly paddleId: string;
      /** Where the ball struck, -1..1 from the paddle centre. */
      readonly relative: number;
      readonly speed: number;
      readonly vx: number;
      readonly vy: number;
    }
  | {
      readonly kind: 'brick-hit';
      readonly placementId: string;
      readonly brickId: string;
      readonly hpRemaining: number;
    }
  | {
      readonly kind: 'brick-destroyed';
      readonly placementId: string;
      readonly brickId: string;
      readonly score: number;
      readonly itemDropId?: string;
    }
  | { readonly kind: 'goal'; readonly edge: ArenaEdge; readonly edgeId?: string; readonly scoresFor?: string; readonly score: number }
  | { readonly kind: 'ball-lost'; readonly edge: ArenaEdge; readonly livesRemaining: number }
  | { readonly kind: 'round-complete' }
  | { readonly kind: 'match-complete'; readonly winnerId: string | null };

// --- Service -------------------------------------------------------------

export interface BallPaddleService {
  definition(): BallPaddleDocument;
  state(): BallPaddleState;
  status(): BallPaddleStatus;

  /** Place the ball at the serve point and launch it per the serve policy. */
  serve(): void;

  /**
   * Everything that has happened since the last drain, in order.
   *
   * Frame advancement is deliberately absent from this interface, for the same
   * reason it is absent from `ActionInput`: the pack advances the simulation
   * exactly once per frame, and a consumer that could also advance it would
   * double-step the ball and silently discard half the events. A consumer
   * *observes* through this drain; it never drives.
   */
  drainEvents(): readonly BallPaddleEvent[];

  /** -1..1 along the paddle's own axis. Consumers feed a controller intent straight in. */
  setPaddleIntent(paddleId: string, intent: number): void;
  paddle(paddleId: string): PaddleState | undefined;

  bricks(): readonly BrickState[];
  score(ownerId: string): number;
  livesRemaining(): number;

  /** Re-centre paddles and park the ball, keeping scores and bricks. */
  resetRound(): void;
  /** Full reset: scores, lives, bricks, serve counter and paddles. */
  reset(): void;
}

// --- Validation ----------------------------------------------------------

export class InvalidBallPaddleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBallPaddleError';
  }
}

/**
 * Semantic checks the JSON schema cannot express: speed ordering, the
 * axis/facing agreement, travel bounds, unique ids and layout references.
 *
 * `maximumBounceAngleDegrees` is capped below 90 on purpose. That cap *is* the
 * degenerate-trajectory prevention: an outgoing vector built by rotating the
 * paddle normal by at most 80 degrees always retains a real component along the
 * normal, so a ball can never leave a paddle travelling parallel to its face and
 * grind along it.
 */
export function validateBallPaddleDocument(doc: BallPaddleDocument): void {
  const ball = doc.ball;
  for (const [name, value] of [
    ['radius', ball.radius],
    ['initialSpeed', ball.initialSpeed],
    ['minimumSpeed', ball.minimumSpeed],
    ['maximumSpeed', ball.maximumSpeed],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidBallPaddleError(`ball.${name} must be > 0 (got ${String(value)}).`);
    }
  }
  if (ball.minimumSpeed > ball.maximumSpeed) {
    throw new InvalidBallPaddleError(
      `ball.minimumSpeed (${ball.minimumSpeed}) must not exceed ball.maximumSpeed (${ball.maximumSpeed}).`,
    );
  }
  if (ball.initialSpeed < ball.minimumSpeed || ball.initialSpeed > ball.maximumSpeed) {
    throw new InvalidBallPaddleError(
      `ball.initialSpeed (${ball.initialSpeed}) must be within [${ball.minimumSpeed}, ${ball.maximumSpeed}].`,
    );
  }
  if (!Number.isFinite(ball.speedIncreasePerHit) || ball.speedIncreasePerHit < 0) {
    throw new InvalidBallPaddleError(`ball.speedIncreasePerHit must be >= 0 (got ${String(ball.speedIncreasePerHit)}).`);
  }
  if (!(ball.maximumBounceAngleDegrees > 0) || ball.maximumBounceAngleDegrees > 80) {
    throw new InvalidBallPaddleError(
      `ball.maximumBounceAngleDegrees must be in (0, 80] - beyond that a paddle can send the ball ` +
        `parallel to its own face (got ${String(ball.maximumBounceAngleDegrees)}).`,
    );
  }
  const serve = ball.servePolicy;
  if (serve.dx === 0 && serve.dy === 0) {
    throw new InvalidBallPaddleError('ball.servePolicy direction must be non-zero.');
  }
  if (serve.kind === 'seeded-direction' && (!(serve.spreadDegrees >= 0) || serve.spreadDegrees > 80)) {
    throw new InvalidBallPaddleError(`ball.servePolicy.spreadDegrees must be in [0, 80] (got ${String(serve.spreadDegrees)}).`);
  }

  const arena = doc.arena;
  if (!(arena.right > arena.left) || !(arena.bottom > arena.top)) {
    throw new InvalidBallPaddleError('arena bounds must have positive width and height.');
  }
  const seenEdges = new Set<ArenaEdge>();
  for (const rule of arena.edges) {
    if (seenEdges.has(rule.edge)) {
      throw new InvalidBallPaddleError(`Duplicate arena edge rule for "${rule.edge}".`);
    }
    seenEdges.add(rule.edge);
  }
  if (arena.serveX < arena.left || arena.serveX > arena.right || arena.serveY < arena.top || arena.serveY > arena.bottom) {
    throw new InvalidBallPaddleError('arena serve point must be inside the arena bounds.');
  }

  if (doc.paddles.length === 0) {
    throw new InvalidBallPaddleError('At least one paddle is required.');
  }
  const paddleIds = new Set<string>();
  for (const paddle of doc.paddles) {
    if (paddleIds.has(paddle.id)) throw new InvalidBallPaddleError(`Duplicate paddle id: "${paddle.id}".`);
    paddleIds.add(paddle.id);
    if (axisForFacing(paddle.facing) !== paddle.axis) {
      throw new InvalidBallPaddleError(
        `Paddle "${paddle.id}" faces "${paddle.facing}", which implies axis ` +
          `"${axisForFacing(paddle.facing)}", but declares "${paddle.axis}".`,
      );
    }
    if (!(paddle.width > 0) || !(paddle.height > 0)) {
      throw new InvalidBallPaddleError(`Paddle "${paddle.id}" must have positive width and height.`);
    }
    if (!(paddle.speed > 0)) {
      throw new InvalidBallPaddleError(`Paddle "${paddle.id}" speed must be > 0 (got ${String(paddle.speed)}).`);
    }
    if (paddle.minTravel > paddle.maxTravel) {
      throw new InvalidBallPaddleError(
        `Paddle "${paddle.id}" minTravel (${paddle.minTravel}) must not exceed maxTravel (${paddle.maxTravel}).`,
      );
    }
    if (!(paddle.bounceInfluence >= 0) || paddle.bounceInfluence > 1) {
      throw new InvalidBallPaddleError(
        `Paddle "${paddle.id}" bounceInfluence must be in [0, 1] (got ${String(paddle.bounceInfluence)}).`,
      );
    }
  }

  const brickIds = new Set<string>();
  for (const brick of doc.bricks ?? []) {
    if (brickIds.has(brick.id)) throw new InvalidBallPaddleError(`Duplicate brick id: "${brick.id}".`);
    brickIds.add(brick.id);
    if (!Number.isInteger(brick.hp) || brick.hp < 1) {
      throw new InvalidBallPaddleError(`Brick "${brick.id}" hp must be an integer >= 1 (got ${String(brick.hp)}).`);
    }
    if (!Number.isFinite(brick.score) || brick.score < 0) {
      throw new InvalidBallPaddleError(`Brick "${brick.id}" score must be >= 0 (got ${String(brick.score)}).`);
    }
  }

  const placementIds = new Set<string>();
  for (const placement of doc.layout ?? []) {
    if (placementIds.has(placement.id)) {
      throw new InvalidBallPaddleError(`Duplicate brick placement id: "${placement.id}".`);
    }
    placementIds.add(placement.id);
    if (!brickIds.has(placement.brickId)) {
      throw new InvalidBallPaddleError(
        `Brick placement "${placement.id}" references unknown brick "${placement.brickId}".`,
      );
    }
    if (!(placement.width > 0) || !(placement.height > 0)) {
      throw new InvalidBallPaddleError(`Brick placement "${placement.id}" must have positive width and height.`);
    }
  }

  const match = doc.match;
  if (match?.targetScore !== undefined && (!Number.isFinite(match.targetScore) || match.targetScore <= 0)) {
    throw new InvalidBallPaddleError(`match.targetScore must be > 0 (got ${String(match.targetScore)}).`);
  }
  if (match?.lives !== undefined && (!Number.isInteger(match.lives) || match.lives < 1)) {
    throw new InvalidBallPaddleError(`match.lives must be an integer >= 1 (got ${String(match.lives)}).`);
  }
}

// --- Pure bounce maths ---------------------------------------------------

/**
 * Where along its own face the ball struck a paddle, as -1..1 from the centre.
 * Pure and exported because a consumer drawing a bounce indicator must use the
 * same rule the simulation does, not a re-derived one.
 */
export function paddleHitOffset(
  paddle: Pick<PaddleDefinition, 'axis' | 'width' | 'height'>,
  paddleX: number,
  paddleY: number,
  ballX: number,
  ballY: number,
): number {
  const halfLength = (paddle.axis === 'vertical' ? paddle.height : paddle.width) / 2;
  if (halfLength <= 0) return 0;
  const delta = paddle.axis === 'vertical' ? ballY - paddleY : ballX - paddleX;
  const relative = delta / halfLength;
  return relative < -1 ? -1 : relative > 1 ? 1 : relative;
}

/**
 * The outgoing unit direction of a paddle bounce.
 *
 * The paddle normal rotated by `relative * maxBounceAngle * bounceInfluence`.
 * Because that angle is capped below 90 degrees, the result always keeps a real
 * component along the normal - the ball leaves the paddle, it never slides along it.
 */
export function paddleBounceDirection(
  facing: PaddleFacing,
  relative: number,
  maximumBounceAngleDegrees: number,
  bounceInfluence = 1,
): { readonly dx: number; readonly dy: number } {
  const clampedRelative = relative < -1 ? -1 : relative > 1 ? 1 : relative;
  const influence = bounceInfluence < 0 ? 0 : bounceInfluence > 1 ? 1 : bounceInfluence;
  const cap = Math.min(Math.abs(maximumBounceAngleDegrees), 80);
  const angle = (clampedRelative * cap * influence * Math.PI) / 180;
  const { nx, ny } = normalForFacing(facing);

  // One rule for all four facings: the outgoing vector is the paddle normal
  // tilted toward the side that was struck.
  //
  //   out = normal * cos(angle) + tangent * sin(angle)
  //
  // where `tangent` points along +travel-axis - the same direction `relative`
  // is measured in. Writing it per-facing instead invites exactly the sign
  // error this replaced: 'left' and 'down' steered the wrong way, because
  // rotating a normal by a fixed handedness flips sense when the normal does.
  const tangentX = axisForFacing(facing) === 'vertical' ? 0 : 1;
  const tangentY = axisForFacing(facing) === 'vertical' ? 1 : 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { dx: nx * cos + tangentX * sin, dy: ny * cos + tangentY * sin };
}

/** The serve direction for a given serve index, per the policy. Pure. */
export function serveDirection(
  policy: ServePolicy,
  serveIndex: number,
  rngFactory: (seed: unknown) => SeededRng,
): { readonly dx: number; readonly dy: number } {
  const length = Math.hypot(policy.dx, policy.dy) || 1;
  const baseX = policy.dx / length;
  const baseY = policy.dy / length;

  if (policy.kind === 'fixed') return { dx: baseX, dy: baseY };

  if (policy.kind === 'alternate') {
    // Flip the dominant axis each serve, so the ball goes back toward whoever
    // just conceded rather than always starting the same way.
    const flip = serveIndex % 2 === 1 ? -1 : 1;
    return Math.abs(baseX) >= Math.abs(baseY)
      ? { dx: baseX * flip, dy: baseY }
      : { dx: baseX, dy: baseY * flip };
  }

  // seeded-direction: the serve index is folded into the seed so successive
  // serves differ while the whole sequence replays identically.
  const rng = rngFactory((policy.seed + serveIndex * 0x9e3779b9) >>> 0);
  const spread = (policy.spreadDegrees * Math.PI) / 180;
  const angle = (rng.nextFloat() * 2 - 1) * spread;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { dx: baseX * cos - baseY * sin, dy: baseX * sin + baseY * cos };
}
