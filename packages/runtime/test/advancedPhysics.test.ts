import { describe, expect, it } from 'vitest';
import type { AdvancedPhysicsService, GrappleAnchor, PhysicsBodyHandle } from '@sw2d/contracts';
import { createGrappleService } from '../src/game-support/grappleService.ts';

/**
 * `createAdvancedPhysics` imports Phaser (Matter world), which the Node test
 * environment cannot load - its Matter behaviour is proven by the browser
 * proofs (physics-toy, grappling-platformer). `createGrappleService` is
 * Phaser-free and fully unit-tested here against a fake physics service.
 */

// --- GrappleService against a fake physics service -------------

function fakePhysics(): AdvancedPhysicsService & { constraints: Set<string> } {
  const constraints = new Set<string>();
  let seq = 0;
  return {
    constraints,
    enabled: true,
    createBody: () => ({ bodyId: `b${++seq}` }),
    removeBody: () => {},
    bodyState: () => ({ x: 0, y: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0, alive: true }),
    setVelocity: () => {},
    setAngularVelocity: () => {},
    applyImpulse: () => {},
    setPosition: () => {},
    createDistanceConstraint: () => ({ constraintId: `c${++seq}` }),
    createSpring: () => ({ constraintId: `c${++seq}` }),
    createPin: () => ({ constraintId: `c${++seq}` }),
    createWorldConstraint: () => {
      const id = `c${++seq}`;
      constraints.add(id);
      return { constraintId: id };
    },
    removeConstraint: (h) => void constraints.delete(h.constraintId),
    get bodyCount() {
      return 0;
    },
    get constraintCount() {
      return constraints.size;
    },
    dispose: () => {},
  };
}

const PLAYER: PhysicsBodyHandle = { bodyId: 'player' };
const anchors: GrappleAnchor[] = [
  { id: 'near', x: 100, y: 100, eligible: true },
  { id: 'far', x: 900, y: 100, eligible: true },
  { id: 'locked', x: 106, y: 106, eligible: false },
];

describe('createGrappleService', () => {
  it('rejects when there is no anchor, one out of range, or an ineligible one', () => {
    const p = fakePhysics();
    const g = createGrappleService(p, { range: 60 });
    expect(g.attach(PLAYER, { x: 0, y: 0 }, [])).toMatchObject({ ok: false, reason: 'no-anchor' });
    // nearest is 'locked' (dist ~7) but ineligible
    expect(g.attach(PLAYER, { x: 105, y: 105 }, anchors)).toMatchObject({ ok: false, reason: 'ineligible' });
    // eligible 'near' exists but player is 300 away -> out of range
    expect(g.attach(PLAYER, { x: 400, y: 100 }, [anchors[0]!])).toMatchObject({ ok: false, reason: 'out-of-range' });
    expect(p.constraints.size).toBe(0);
  });

  it('attaches to the nearest eligible anchor within range and creates exactly one constraint', () => {
    const p = fakePhysics();
    const g = createGrappleService(p, { range: 200 });
    const r = g.attach(PLAYER, { x: 90, y: 100 }, [anchors[0]!, anchors[1]!]);
    expect(r).toMatchObject({ ok: true, anchorId: 'near' });
    expect(g.state().attached).toBe(true);
    expect(p.constraints.size).toBe(1);
  });

  it('a second attach replaces the first cleanly', () => {
    const p = fakePhysics();
    const g = createGrappleService(p, { range: 2000 });
    g.attach(PLAYER, { x: 90, y: 100 }, [anchors[0]!]);
    g.attach(PLAYER, { x: 890, y: 100 }, [anchors[1]!]);
    expect(g.state().anchorId).toBe('far');
    expect(p.constraints.size).toBe(1);
  });

  it('detach and anchor-removal both leave no constraint and a valid state', () => {
    const p = fakePhysics();
    const g = createGrappleService(p, { range: 2000 });
    g.attach(PLAYER, { x: 90, y: 100 }, [anchors[0]!]);
    g.detach();
    expect(g.state().attached).toBe(false);
    expect(p.constraints.size).toBe(0);

    g.attach(PLAYER, { x: 90, y: 100 }, [anchors[0]!]);
    g.notifyAnchorRemoved('near');
    expect(g.state().attached).toBe(false);
    expect(p.constraints.size).toBe(0);
  });

  it('reeling changes rope length within bounds and only when reeling is configured', () => {
    const p = fakePhysics();
    const noReel = createGrappleService(p, { range: 2000 });
    noReel.attach(PLAYER, { x: 90, y: 100 }, [anchors[0]!]);
    const len0 = noReel.state().ropeLength;
    noReel.reel(1, 1);
    expect(noReel.state().ropeLength).toBe(len0); // reelRate 0 -> no change

    const g = createGrappleService(p, { range: 2000, reelRate: 50, minRopeLength: 10, maxRopeLength: 100 });
    g.attach(PLAYER, { x: 40, y: 100 }, [anchors[0]!]); // dist ~60 -> ropeLength 60
    g.reel(1, 1); // shorten by 50 -> 10 (clamped to min)
    expect(g.state().ropeLength).toBe(10);
    g.reel(-1, 10); // lengthen a lot -> clamped to max 100
    expect(g.state().ropeLength).toBe(100);
  });
});
