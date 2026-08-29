import type {
  AdvancedPhysicsService,
  GrappleAnchor,
  GrappleAttachResult,
  GrappleDefinition,
  GrappleService,
  GrappleState,
  PhysicsBodyHandle,
  PhysicsConstraintHandle,
  PhysicsPoint,
} from '@sw2d/contracts';

/**
 * Reusable grapple service (capability program Phase 9).
 *
 * A real physical grapple: it creates a distance constraint between the player
 * body and an anchor world point through the `AdvancedPhysicsService`. One
 * active grapple per service. Attach validates: an anchor must exist, be
 * flagged eligible, and be within range. `notifyAnchorRemoved` detaches safely
 * if the active anchor disappears. `dispose()` removes the constraint.
 *
 * It does NOT lerp the player in a circle - the swing is Matter solving the
 * constraint.
 */
export function createGrappleService(physics: AdvancedPhysicsService, def: GrappleDefinition): GrappleService {
  let attached = false;
  let anchorId: string | null = null;
  let anchorPoint: PhysicsPoint | null = null;
  let ropeLength = def.ropeLength ?? 0;
  let constraint: PhysicsConstraintHandle | null = null;
  let playerHandle: PhysicsBodyHandle | null = null;
  const minLen = def.minRopeLength ?? 8;
  const maxLen = def.maxRopeLength ?? 4000;

  function rebuild(): void {
    if (!playerHandle || !anchorPoint) return;
    if (constraint) physics.removeConstraint(constraint);
    // A grapple rope is close to rigid: the player swings at a near-fixed
    // distance from the anchor (a pendulum), not on a loose spring.
    constraint = physics.createWorldConstraint(playerHandle, anchorPoint, { length: ropeLength, stiffness: 0.9, damping: 0.08 });
  }

  function detachInternal(): void {
    if (constraint) physics.removeConstraint(constraint);
    constraint = null;
    attached = false;
    anchorId = null;
    anchorPoint = null;
    playerHandle = null;
  }

  return {
    attach(player: PhysicsBodyHandle, playerPos: PhysicsPoint, anchors: readonly GrappleAnchor[]): GrappleAttachResult {
      // Nearest anchor within range.
      let best: GrappleAnchor | null = null;
      let bestDist = Infinity;
      for (const anchor of anchors) {
        const d = Math.hypot(anchor.x - playerPos.x, anchor.y - playerPos.y);
        if (d < bestDist) {
          bestDist = d;
          best = anchor;
        }
      }
      if (!best) return { ok: false, anchorId: null, reason: 'no-anchor' };
      if (!best.eligible) return { ok: false, anchorId: null, reason: 'ineligible' };
      if (bestDist > def.range) return { ok: false, anchorId: null, reason: 'out-of-range' };

      if (attached) detachInternal();
      playerHandle = player;
      anchorId = best.id;
      anchorPoint = { x: best.x, y: best.y };
      ropeLength = def.ropeLength ?? Math.max(minLen, bestDist);
      attached = true;
      rebuild();
      return { ok: true, anchorId: best.id };
    },

    detach(): void {
      if (attached) detachInternal();
    },

    reel(direction: 1 | -1, deltaSeconds: number): void {
      if (!attached || !def.reelRate) return;
      ropeLength = Math.max(minLen, Math.min(maxLen, ropeLength - direction * def.reelRate * deltaSeconds));
      rebuild();
    },

    state(): GrappleState {
      return { attached, anchorId, ropeLength };
    },

    notifyAnchorRemoved(id: string): void {
      if (attached && anchorId === id) detachInternal();
    },

    dispose(): void {
      detachInternal();
    },
  };
}
