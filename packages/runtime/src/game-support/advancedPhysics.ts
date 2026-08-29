import Phaser from 'phaser';
import type {
  AdvancedPhysicsService,
  CollisionCategory,
  DistanceConstraintOptions,
  PhysicsBodyDefinition,
  PhysicsBodyHandle,
  PhysicsBodyState,
  PhysicsConstraintHandle,
  PhysicsPoint,
  SpringConstraintOptions,
} from '@sw2d/contracts';

/**
 * Matter-backed implementation of the renderer-neutral `AdvancedPhysicsService`
 * (capability program Phase 9).
 *
 * Owns every real Matter body, constraint and collision listener it creates,
 * and the logical-handle -> Matter-object map. `dispose()` removes all of it;
 * repeated scene restarts must not retain old Matter objects. Inert (every
 * method a safe no-op) when the game did not opt into `physicsProfile:
 * 'matter'` and `scene.matter` is therefore absent.
 */

type MatterBody = MatterJS.BodyType;
type MatterConstraint = MatterJS.ConstraintType;

/** Named collision layers -> Matter category bits, in exactly one place. */
const CATEGORY_BIT: Readonly<Record<CollisionCategory, number>> = {
  default: 0x0001,
  player: 0x0002,
  terrain: 0x0004,
  prop: 0x0008,
  sensor: 0x0010,
  anchor: 0x0020,
};

const DEAD_STATE: PhysicsBodyState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, angularVelocity: 0, alive: false };

export function createAdvancedPhysics(scene: Phaser.Scene): AdvancedPhysicsService {
  // `scene.matter` is only wired when the Phaser game config enabled the Matter
  // backend (physicsProfile: 'matter'); otherwise its `world` is absent.
  const matter = (scene.matter ?? undefined) as Phaser.Physics.Matter.MatterPhysics | undefined;
  const enabled = Boolean(matter && matter.world);
  const bodies = new Map<string, MatterBody>();
  const constraints = new Map<string, MatterConstraint>();
  let seq = 0;
  let disposed = false;

  const maskFor = (def: PhysicsBodyDefinition): number => {
    if (!def.collidesWith) return 0xffffffff;
    return def.collidesWith.reduce((m, c) => m | CATEGORY_BIT[c], 0);
  };

  const pointBodyCache = new Map<string, MatterBody>();
  const resolvePoint = (p: PhysicsPoint): MatterBody => {
    const key = `${p.x},${p.y}`;
    let b = pointBodyCache.get(key);
    if (!b) {
      b = matter!.add.circle(p.x, p.y, 1, { isStatic: true, isSensor: true, collisionFilter: { category: 0, mask: 0 } }) as MatterBody;
      pointBodyCache.set(key, b);
    }
    return b;
  };

  const require = (id: string): MatterBody | undefined => bodies.get(id);

  const service: AdvancedPhysicsService = {
    get enabled() {
      return enabled;
    },
    get bodyCount() {
      return bodies.size;
    },
    get constraintCount() {
      return constraints.size;
    },

    createBody(def: PhysicsBodyDefinition): PhysicsBodyHandle {
      const bodyId = def.id ?? `body-${++seq}`;
      if (!enabled) return { bodyId };
      const options: Phaser.Types.Physics.Matter.MatterBodyConfig = {
        isStatic: def.static ?? false,
        isSensor: def.sensor ?? false,
        ...(def.density !== undefined ? { density: def.density } : {}),
        ...(def.friction !== undefined ? { friction: def.friction } : {}),
        ...(def.frictionAir !== undefined ? { frictionAir: def.frictionAir } : {}),
        ...(def.restitution !== undefined ? { restitution: def.restitution } : {}),
        collisionFilter: { category: CATEGORY_BIT[def.category ?? 'default'], mask: maskFor(def) },
        ...(def.angle !== undefined ? { angle: def.angle } : {}),
      };
      const body =
        def.shape.kind === 'circle'
          ? (matter!.add.circle(def.x, def.y, def.shape.radius, options) as MatterBody)
          : (matter!.add.rectangle(def.x, def.y, def.shape.width, def.shape.height, options) as MatterBody);
      bodies.set(bodyId, body);
      return { bodyId };
    },

    removeBody(handle: PhysicsBodyHandle): void {
      const body = bodies.get(handle.bodyId);
      if (!body || !enabled || !matter!.world) {
        bodies.delete(handle.bodyId);
        return;
      }
      // Drop any constraint that referenced this body - a dangling constraint is a leak.
      for (const [cid, c] of [...constraints]) {
        if (c.bodyA === body || c.bodyB === body) {
          matter!.world.removeConstraint(c as MatterJS.ConstraintType, true);
          constraints.delete(cid);
        }
      }
      matter!.world.remove(body as unknown as Phaser.Types.Physics.Matter.MatterBody, true);
      bodies.delete(handle.bodyId);
    },

    bodyState(handle: PhysicsBodyHandle): PhysicsBodyState {
      const body = require(handle.bodyId);
      if (!body || !enabled) return DEAD_STATE;
      return {
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
        vx: body.velocity.x,
        vy: body.velocity.y,
        angularVelocity: body.angularVelocity,
        alive: true,
      };
    },

    setVelocity(handle, x, y): void {
      const body = require(handle.bodyId);
      if (body && enabled) matter!.body.setVelocity(body, { x, y });
    },

    setAngularVelocity(handle, angularVelocity): void {
      const body = require(handle.bodyId);
      if (body && enabled) matter!.body.setAngularVelocity(body, angularVelocity);
    },

    applyImpulse(handle, x, y): void {
      const body = require(handle.bodyId);
      if (body && enabled) matter!.applyForce(body, { x: x / 1000, y: y / 1000 });
    },

    setPosition(handle, x, y): void {
      const body = require(handle.bodyId);
      if (body && enabled) matter!.body.setPosition(body, { x, y });
    },

    createDistanceConstraint(a, b, options?: DistanceConstraintOptions): PhysicsConstraintHandle {
      return addConstraint(a, b, {
        ...(options?.length !== undefined ? { length: options.length } : {}),
        stiffness: options?.stiffness ?? 0.9,
        ...(options?.damping !== undefined ? { damping: options.damping } : {}),
      });
    },

    createSpring(a, b, options: SpringConstraintOptions): PhysicsConstraintHandle {
      return addConstraint(a, b, {
        length: options.length,
        stiffness: options.stiffness,
        ...(options.damping !== undefined ? { damping: options.damping } : {}),
      });
    },

    createPin(a, b): PhysicsConstraintHandle {
      return addConstraint(a, b, { length: 0, stiffness: 1 });
    },

    createWorldConstraint(a, point, options?: DistanceConstraintOptions): PhysicsConstraintHandle {
      return addConstraint(a, point, {
        ...(options?.length !== undefined ? { length: options.length } : {}),
        stiffness: options?.stiffness ?? 0.9,
        ...(options?.damping !== undefined ? { damping: options.damping } : {}),
      });
    },

    removeConstraint(handle: PhysicsConstraintHandle): void {
      const c = constraints.get(handle.constraintId);
      if (c && enabled && matter!.world) {
        try {
          matter!.world.removeConstraint(c as MatterJS.ConstraintType, true);
        } catch {
          /* world already torn down */
        }
      }
      constraints.delete(handle.constraintId);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (enabled) {
        for (const c of constraints.values()) {
          try {
            matter!.world.removeConstraint(c as MatterJS.ConstraintType, true);
          } catch {
            /* world already torn down */
          }
        }
        for (const b of bodies.values()) {
          try {
            matter!.world.remove(b as unknown as Phaser.Types.Physics.Matter.MatterBody, true);
          } catch {
            /* world already torn down */
          }
        }
        for (const b of pointBodyCache.values()) {
          try {
            matter!.world.remove(b as unknown as Phaser.Types.Physics.Matter.MatterBody, true);
          } catch {
            /* world already torn down */
          }
        }
      }
      bodies.clear();
      constraints.clear();
      pointBodyCache.clear();
    },
  };

  function addConstraint(
    a: PhysicsBodyHandle,
    b: PhysicsBodyHandle | PhysicsPoint,
    opts: { length?: number; stiffness: number; damping?: number },
  ): PhysicsConstraintHandle {
    const constraintId = `constraint-${++seq}`;
    if (!enabled) return { constraintId };
    const bodyA = require(a.bodyId);
    if (!bodyA) return { constraintId };
    const bodyB = 'bodyId' in b ? require(b.bodyId) : resolvePoint(b);
    if (!bodyB) return { constraintId };
    const c = matter!.add.constraint(
      bodyA as unknown as MatterJS.BodyType,
      bodyB as unknown as MatterJS.BodyType,
      opts.length,
      opts.stiffness,
      opts.damping !== undefined ? { damping: opts.damping } : undefined,
    ) as MatterConstraint;
    constraints.set(constraintId, c);
    return { constraintId };
  }

  return service;
}
