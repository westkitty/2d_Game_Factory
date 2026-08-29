import type { InstalledSystemPack, PhysicsBodyHandle } from '@sw2d/contracts';
import { createAdvancedPhysics, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - physics-toy (see ../PROOF_CONTRACT.md).
 *
 * Proves Phase 9 is not just a grapple special case: several real Matter
 * rigid bodies falling and colliding on a static floor, one spring
 * constraint linking two of them, and Phase-1 spatial-pointer interaction (a
 * click shakes the field). On teardown the reusable AdvancedPhysicsService
 * disposes every body, constraint and listener it created.
 */

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.pointer-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const physics = createAdvancedPhysics(scene);

    physics.createBody({ id: 'floor', x: width * 0.5, y: height - 14, shape: { kind: 'rect', width, height: 28 }, static: true, category: 'terrain' });
    physics.createBody({ id: 'ceiling', x: width * 0.5, y: 8, shape: { kind: 'rect', width, height: 16 }, static: true, category: 'terrain' });
    physics.createBody({ id: 'wall-l', x: 8, y: height * 0.5, shape: { kind: 'rect', width: 16, height }, static: true, category: 'terrain' });
    physics.createBody({ id: 'wall-r', x: width - 8, y: height * 0.5, shape: { kind: 'rect', width: 16, height }, static: true, category: 'terrain' });

    const balls: PhysicsBodyHandle[] = [];
    for (let i = 0; i < 3; i++) {
      balls.push(
        physics.createBody({ id: `ball-${i}`, x: 180 + i * 120, y: 80 + i * 30, shape: { kind: 'circle', radius: 18 }, restitution: 0.55, category: 'prop' }),
      );
    }
    physics.createBody({ id: 'box-0', x: 360, y: 60, shape: { kind: 'rect', width: 34, height: 34 }, restitution: 0.1, category: 'prop' });

    // One spring linking the first two balls.
    physics.createSpring(balls[0]!, balls[1]!, { length: 140, stiffness: 0.02, damping: 0.05 });

    const initialBodyCount = physics.bodyCount;
    const initialConstraintCount = physics.constraintCount;

    const key = context.assets.resolve('pickup');
    const sprites = [...balls, { bodyId: 'box-0' }].map((h) => ({ h, s: scene.add.sprite(0, 0, key) }));

    // Phase 1 spatial pointer: a centre target; a click shakes every dynamic body.
    let shakes = 0;
    const handle = context.interaction.register({
      id: 'shaker',
      shape: { kind: 'circle', x: width * 0.5, y: height * 0.5, radius: Math.min(width, height) * 0.45 },
      onClick: () => {
        shakes += 1;
        for (const b of balls) physics.applyImpulse(b, 0, -34);
      },
    });

    const linkDistance = (): number => {
      const a = physics.bodyState(balls[0]!);
      const b = physics.bodyState(balls[1]!);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({
      physicsEnabled: physics.enabled,
      bodyCount: physics.bodyCount,
      constraintCount: physics.constraintCount,
      shakes,
      ballY: balls.map((b) => Math.round(physics.bodyState(b).y)),
      minBallY: Math.min(...balls.map((b) => physics.bodyState(b).y)),
      springLinkDistance: Math.round(linkDistance()),
      pointerHoveredId: context.interaction.hoveredId,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        for (const { h, s } of sprites) {
          const st = physics.bodyState(h as PhysicsBodyHandle);
          s.setPosition(st.x, st.y);
          s.setRotation(st.angle);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        handle.dispose();
        physics.dispose();
        void initialBodyCount;
        void initialConstraintCount;
        try {
          for (const { s } of sprites) s.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
