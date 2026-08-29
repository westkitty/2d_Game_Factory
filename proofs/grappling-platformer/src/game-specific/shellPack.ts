import type { GrappleAnchor, InstalledSystemPack, PhysicsBodyHandle } from '@sw2d/contracts';
import { createAdvancedPhysics, createGrappleService, platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - grappling-platformer (see ../PROOF_CONTRACT.md).
 *
 * A real physical grapple: the player is a Matter body, the grapple is a
 * distance constraint to an anchor world point created through the reusable
 * AdvancedPhysicsService, and the swing is Matter solving that constraint -
 * NOT a scripted lerp. INTERACT reels in, CANCEL reels out. On teardown the
 * service disposes every body and constraint it created.
 */

const ANCHORS: readonly GrappleAnchor[] = [
  { id: 'a-left', x: 240, y: 230, eligible: true },
  { id: 'a-mid', x: 500, y: 230, eligible: true },
  { id: 'a-locked', x: 760, y: 230, eligible: false },
];

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const physics = createAdvancedPhysics(scene);
    const grapple = createGrappleService(physics, { range: 460, ropeLength: 170, reelRate: 120, minRopeLength: 70, maxRopeLength: 250 });

    physics.createBody({ id: 'floor', x: width * 0.5, y: height - 16, shape: { kind: 'rect', width, height: 32 }, static: true, category: 'terrain' });
    physics.createBody({ id: 'ceiling', x: width * 0.5, y: 8, shape: { kind: 'rect', width, height: 16 }, static: true, category: 'terrain' });
    const player: PhysicsBodyHandle = physics.createBody({
      id: 'player',
      x: 100,
      y: height - 120,
      shape: { kind: 'circle', radius: 16 },
      frictionAir: 0.02,
      restitution: 0.1,
      category: 'player',
    });
    const initialBodyCount = physics.bodyCount;

    const playerKey = context.assets.resolve('player');
    const anchorKey = context.assets.resolve('checkpoint');
    const playerSprite = scene.add.sprite(100, height - 120, playerKey);
    for (const a of ANCHORS) scene.add.sprite(a.x, a.y, anchorKey).setAlpha(a.eligible ? 1 : 0.4);

    let attachEvents = 0;

    const dist = (): number => {
      const st = physics.bodyState(player);
      const s = grapple.state();
      const anchor = ANCHORS.find((a) => a.id === s.anchorId);
      return anchor ? Math.hypot(st.x - anchor.x, st.y - anchor.y) : -1;
    };

    const debugHandle = context.debug.contribute('game.platform-shell', () => {
      const st = physics.bodyState(player);
      const g = grapple.state();
      return {
        physicsEnabled: physics.enabled,
        bodyCount: physics.bodyCount,
        constraintCount: physics.constraintCount,
        anchorEligible: ANCHORS.filter((a) => a.eligible).length,
        playerX: Math.round(st.x),
        playerY: Math.round(st.y),
        grappleAttached: g.attached,
        grappleAnchor: g.anchorId,
        ropeLength: Math.round(g.ropeLength),
        anchorDistance: Math.round(dist()),
        attachEvents,
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        if (intent.moveAxis !== 0) physics.applyImpulse(player, intent.moveAxis * 6, 0);
        if (intent.jumpPressed) physics.applyImpulse(player, 0, -90);

        if (context.input.consumePress('SECONDARY_ACTION')) {
          if (grapple.state().attached) grapple.detach();
          else {
            const st = physics.bodyState(player);
            const r = grapple.attach(player, { x: st.x, y: st.y }, ANCHORS);
            if (r.ok) attachEvents += 1;
          }
        }
        if (context.input.value('INTERACT') > 0) grapple.reel(1, deltaMs / 1000);
        if (context.input.value('CANCEL') > 0) grapple.reel(-1, deltaMs / 1000);

        const st = physics.bodyState(player);
        playerSprite.setPosition(st.x, st.y);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        grapple.dispose();
        physics.dispose();
        void initialBodyCount;
        try {
          playerSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
