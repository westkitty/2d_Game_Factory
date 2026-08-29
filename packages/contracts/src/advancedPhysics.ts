/**
 * Optional advanced 2D physics & constraints (capability program Phase 9).
 *
 * Renderer-neutral. Arcade physics stays the factory default; a game opts into
 * the Matter backend by setting `GameDefinition.physicsProfile = 'matter'`.
 * This module is the stable *logical* surface - opaque handles, plain data
 * definitions. No `Matter.Body`, `Matter.Constraint` or `Phaser.*` type
 * crosses it: the runtime bridge in `@sw2d/runtime` owns the real Matter
 * objects and the handle -> object mapping.
 *
 * The scope is exactly what the proof consumers need (grappling-platformer,
 * physics-toy, physics-puzzle, pinball-lite): rigid bodies, a few constraint
 * kinds, and a grapple service. It is not an abstraction over every Matter
 * feature.
 */

export const PHYSICS_ADVANCED_CAPABILITY_ID = 'physics.advanced';

/** Named collision layers, mapped to Matter category bits in one place (the runtime). */
export type CollisionCategory = 'default' | 'player' | 'terrain' | 'prop' | 'sensor' | 'anchor';

export type PhysicsShape =
  | { readonly kind: 'rect'; readonly width: number; readonly height: number }
  | { readonly kind: 'circle'; readonly radius: number };

export interface PhysicsBodyDefinition {
  /** Logical id for lookups / debug. Auto-assigned when omitted. */
  readonly id?: string;
  readonly x: number;
  readonly y: number;
  readonly shape: PhysicsShape;
  readonly static?: boolean;
  readonly sensor?: boolean;
  readonly density?: number;
  readonly friction?: number;
  readonly frictionAir?: number;
  readonly restitution?: number;
  readonly category?: CollisionCategory;
  /** Categories this body collides with. Default: everything. */
  readonly collidesWith?: readonly CollisionCategory[];
  /** Initial angle in radians. */
  readonly angle?: number;
}

/** An opaque reference to a runtime body. Compare by identity. */
export interface PhysicsBodyHandle {
  readonly bodyId: string;
}

/** An opaque reference to a runtime constraint. */
export interface PhysicsConstraintHandle {
  readonly constraintId: string;
}

export interface PhysicsBodyState {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly vx: number;
  readonly vy: number;
  readonly angularVelocity: number;
  /** False once the body has been removed. */
  readonly alive: boolean;
}

export interface DistanceConstraintOptions {
  readonly length?: number;
  /** 0..1; 1 is rigid. */
  readonly stiffness?: number;
  readonly damping?: number;
}

export interface SpringConstraintOptions {
  readonly length: number;
  /** 0..1; lower is springier. */
  readonly stiffness: number;
  readonly damping?: number;
}

export interface PhysicsBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AdvancedPhysicsService {
  /** True when the Matter backend is actually available (physicsProfile === 'matter'). */
  readonly enabled: boolean;

  createBody(def: PhysicsBodyDefinition): PhysicsBodyHandle;
  removeBody(handle: PhysicsBodyHandle): void;
  bodyState(handle: PhysicsBodyHandle): PhysicsBodyState;
  setVelocity(handle: PhysicsBodyHandle, x: number, y: number): void;
  setAngularVelocity(handle: PhysicsBodyHandle, angularVelocity: number): void;
  applyImpulse(handle: PhysicsBodyHandle, x: number, y: number): void;
  setPosition(handle: PhysicsBodyHandle, x: number, y: number): void;

  /** A stiff link holding two bodies (or a body and a world point) a fixed distance apart. */
  createDistanceConstraint(a: PhysicsBodyHandle, b: PhysicsBodyHandle | PhysicsPoint, options?: DistanceConstraintOptions): PhysicsConstraintHandle;
  createSpring(a: PhysicsBodyHandle, b: PhysicsBodyHandle | PhysicsPoint, options: SpringConstraintOptions): PhysicsConstraintHandle;
  /** A pin (revolute) joint: bodies share a point but may rotate about it. */
  createPin(a: PhysicsBodyHandle, b: PhysicsBodyHandle | PhysicsPoint): PhysicsConstraintHandle;
  /** Anchor a body to a fixed world point. */
  createWorldConstraint(a: PhysicsBodyHandle, point: PhysicsPoint, options?: DistanceConstraintOptions): PhysicsConstraintHandle;
  removeConstraint(handle: PhysicsConstraintHandle): void;

  /** Diagnostics for lifecycle tests. */
  readonly bodyCount: number;
  readonly constraintCount: number;

  /** Removes every body, constraint and collision listener this service created. */
  dispose(): void;
}

export interface PhysicsPoint {
  readonly x: number;
  readonly y: number;
}

// --- Grapple ------------------------------------------------------

export interface GrappleAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Only anchors flagged eligible may be grappled. */
  readonly eligible: boolean;
}

export interface GrappleDefinition {
  /** Max distance from the player at which an anchor can be grabbed. */
  readonly range: number;
  /** Rope length when attaching; defaults to the actual distance. */
  readonly ropeLength?: number;
  /** Units/second the rope shortens/lengthens when reeling. 0 disables reeling. */
  readonly reelRate?: number;
  readonly minRopeLength?: number;
  readonly maxRopeLength?: number;
}

export interface GrappleState {
  readonly attached: boolean;
  readonly anchorId: string | null;
  readonly ropeLength: number;
}

export interface GrappleAttachResult {
  readonly ok: boolean;
  readonly anchorId: string | null;
  readonly reason?: 'no-anchor' | 'out-of-range' | 'ineligible';
}

export interface GrappleService {
  /** Candidate anchors are supplied by the caller each attempt (from the level / world). */
  attach(playerBody: PhysicsBodyHandle, playerPos: PhysicsPoint, anchors: readonly GrappleAnchor[]): GrappleAttachResult;
  detach(): void;
  reel(direction: 1 | -1, deltaSeconds: number): void;
  state(): GrappleState;
  /** Call when an anchor is removed from the world - detaches safely if it was the active one. */
  notifyAnchorRemoved(anchorId: string): void;
  dispose(): void;
}
