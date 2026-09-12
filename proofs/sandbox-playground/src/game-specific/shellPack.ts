import type { AdvancedPhysicsService, InstalledSystemPack, PhysicsBodyHandle, PuzzleRulesService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import {
  bindStarterDialogue,
  bindStarterGallery,
  bindStarterWeapon,
  bindStarterPointer,
  bindStarterToy,
  bindStarterPhysics,
  bindStarterLook,
  createAdvancedPhysics,
  mutedStyle,
  pointerActionController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';
import { GALLERY_STARTER, LOOK_STARTER, PHYSICS_STARTER, POINTER_STARTER, TOY_STARTER } from './packConfig.ts';

/**
 * Generated starter shell: pointer controller family.
 *
 * The reusable spatial interaction capability (ADR-0018) is what a pointer
 * game is built on: `context.spatialPointer` gives the world-space cursor,
 * and `context.interaction` owns hit-testing, hover tracking and pointer
 * capture. This shell registers world-space targets and lets the service
 * resolve hover and click against the actual cursor position - no
 * cursor/hover/hit-test code is reimplemented here.
 *
 * When `sw2d.dialogue` is installed in adventure mode (Category-C Wave 3)
 * the dummy target is replaced by authored hotspots that start conversations.
 *
 * When `sw2d.weapons` is installed (Category-C Wave 11) PRIMARY_ACTION or a
 * pointer click fires toward the cursor through the reusable projectile
 * runtime. Gallery-shooter is the pointer consumer; rail-shooter does not
 * install the pack (its leftover is a rail camera).
 *
 * When `sw2d.puzzle-rules` is installed (Wave 4 L25/L46) the dummy target is
 * replaced by a content-authored ruleset from `content/puzzles.json`: a Matter
 * ball-in-goal (`physics-goal`) or inspect hotspots (`escape`). This shell
 * presents the board; `PuzzleRulesService` owns state. Overlays stay local.
 *
 * When `POINTER_STARTER` is draw or wardrobe (Category-C Wave 16) the dummy
 * target is replaced by two ADR-0018 presentations: stroke polylines vs
 * drag/drop wardrobe slots. Overlay drawing / dress-up kits stay local.
 *
 * When `TOY_STARTER` is sandbox (Category-C Wave 20) the dummy target is
 * replaced by click-to-stamp block/ball authoring. Photography binds the
 * same starter from the top-down shell. Overlay sandbox kits stay local.
 *
 * When `PHYSICS_STARTER` is toy (Category-C Wave 24) the dummy click + demo
 * ball is replaced by a crate/ball launched into a goal. Pinball binds the
 * same starter from the ui-simulation shell.
 *
 * When `LOOK_STARTER` is rail (Category-C Wave 26) the dummy target is
 * replaced by approaching combat targets. Museum binds from the top-down
 * shell. Not a rail-path camera.
 *
 * Press-style semantic actions (`pointerActionController`) are still
 * available for menu-style confirms; this shell demonstrates the spatial
 * layer because that is the part a pointer game cannot fake. See
 * platformShellPack.ts's file comment for the template pattern.
 */

interface EscapeSpot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly label: string;
  readonly requiresFlags?: readonly string[];
  readonly setsFlags?: readonly string[];
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.pointer-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const targetKey = context.assets.resolve('pickup');
    const playerKey = context.assets.resolve('player');
    const platformKey = context.assets.resolve('platform');
    const exitKey = context.assets.resolve('exit');
    const { width, height } = context.definition.viewport;
    const centre = { x: width * 0.5, y: height * 0.5, radius: 48 };

    const dialogue = bindStarterDialogue(context);
    // Target shooter (Final Product Completion Wave 3): gallery rounds or the
    // camera rail, on sw2d.encounters + sw2d.weapons + sw2d.arcade (+ sw2d.camera).
    // The battle owns the weapon, so the plain starter weapon stays inert.
    const gallery = bindStarterGallery(context, { mode: GALLERY_STARTER });
    const weapon = gallery.active ? null : bindStarterWeapon(context);
    const pointerPlay = bindStarterPointer(context, { mode: POINTER_STARTER });
    const toy = bindStarterToy(context, { mode: TOY_STARTER });
    const physicsPlay = bindStarterPhysics(context, { mode: PHYSICS_STARTER });
    const look = bindStarterLook(context, { mode: LOOK_STARTER });
    const weaponsActive = Boolean(weapon?.snapshot()) && !dialogue.active && !pointerPlay.active && !toy.active && !physicsPlay.active && !look.active && !gallery.active;
    const puzzle = context.capabilities.get<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
    const puzzleKind = puzzle?.snapshot().kind;
    const physicsPuzzle = puzzleKind === 'physics-goal';
    const escapePuzzle = puzzleKind === 'escape';
    const dummyPointer = !dialogue.active && !weaponsActive && !physicsPuzzle && !escapePuzzle && !pointerPlay.active && !toy.active && !physicsPlay.active && !look.active && !gallery.active;

    let activations = 0;
    let highlighted = false;
    let hovered = false;
    let nowMs = 0;
    let lastResult: string | null = null;
    let nudges = 0;

    const target = dummyPointer ? scene.add.image(centre.x, centre.y, targetKey) : null;
    target?.setDisplaySize(centre.radius * 2, centre.radius * 2);

    const gun = weaponsActive ? scene.add.image(width * 0.5, height - 56, playerKey) : null;
    const reticle = weaponsActive ? scene.add.image(centre.x, centre.y, targetKey) : null;
    reticle?.setDisplaySize(12, 12);

    const hotspotSprites: { id: string; image: ReturnType<typeof scene.add.image>; handle: { dispose(): void } }[] = [];
    if (dialogue.active) {
      for (const hotspot of dialogue.snapshot().hotspots) {
        const image = scene.add.image(hotspot.x, hotspot.y, targetKey);
        image.setDisplaySize(56, 56);
        if (hotspot.locked) image.setAlpha(0.35);
        const handle = context.interaction.register({
          id: hotspot.id,
          shape: { kind: 'circle', x: hotspot.x, y: hotspot.y, radius: 28 },
          onHoverEnter: () => {
            image.setTint(0xbfe1ff);
          },
          onHoverLeave: () => {
            image.clearTint();
          },
          onClick: () => {
            dialogue.start(hotspot.conversationId);
            for (const entry of hotspotSprites) {
              const live = dialogue.snapshot().hotspots.find((h) => h.id === entry.id);
              entry.image.setAlpha(live?.locked ? 0.35 : 1);
            }
          },
        });
        hotspotSprites.push({ id: hotspot.id, image, handle });
      }
    }

    const escapeSpots = (): readonly EscapeSpot[] => {
      const raw = puzzle?.snapshot().interactables;
      return Array.isArray(raw) ? (raw as readonly EscapeSpot[]) : [];
    };
    const escapeFlags = (): readonly string[] => {
      const raw = puzzle?.snapshot().flags;
      return Array.isArray(raw) ? (raw as readonly string[]) : [];
    };
    const spotReady = (spot: EscapeSpot, flags: readonly string[]): boolean =>
      (spot.requiresFlags ?? []).every((flag) => flags.includes(flag));

    if (escapePuzzle && puzzle) {
      for (const spot of escapeSpots()) {
        const image = scene.add.image(spot.x, spot.y, spot.id === 'door' ? exitKey : targetKey);
        image.setDisplaySize(spot.id === 'door' ? 40 : 56, spot.id === 'door' ? 70 : 56);
        const handle = context.interaction.register({
          id: spot.id,
          shape: { kind: 'circle', x: spot.x, y: spot.y, radius: spot.radius },
          onHoverEnter: () => {
            image.setTint(0xbfe1ff);
          },
          onHoverLeave: () => {
            image.clearTint();
          },
          onClick: () => {
            const after = puzzle.apply({ kind: 'inspect', id: spot.id });
            const flags = Array.isArray(after.flags) ? (after.flags as readonly string[]) : escapeFlags();
            if (spot.id === 'door') {
              lastResult = puzzle.isSolved() ? 'escaped' : 'locked';
            } else if (spotReady(spot, flags) && (spot.setsFlags ?? []).every((flag) => flags.includes(flag))) {
              lastResult = spot.id;
            } else {
              lastResult = 'locked';
            }
            if (lastResult !== 'locked') context.audio.playCue('ui.confirm');
            for (const entry of hotspotSprites) {
              const live = escapeSpots().find((item) => item.id === entry.id);
              entry.image.setAlpha(live && spotReady(live, flags) ? 1 : 0.35);
            }
          },
        });
        image.setAlpha(spotReady(spot, escapeFlags()) ? 1 : 0.35);
        hotspotSprites.push({ id: spot.id, image, handle });
      }
    }

    // Optional advanced physics (capability program Phase 9). Inert unless
    // content/game.json sets physicsProfile: 'matter'. Physics-puzzle owns the
    // ball/goal layout; other matter pointer games keep the demo rigid body.
    const physics: AdvancedPhysicsService | null =
      context.definition.physicsProfile === 'matter' && !physicsPlay.active ? createAdvancedPhysics(scene) : null;
    let puzzleBall: PhysicsBodyHandle | null = null;
    const ballSprite = physicsPuzzle ? scene.add.image(200, 400, targetKey) : null;
    ballSprite?.setDisplaySize(32, 32);
    const goalSprite = physicsPuzzle ? scene.add.image(800, 478, exitKey) : null;
    goalSprite?.setDisplaySize(40, 70);
    const floorSprite = physicsPuzzle ? scene.add.image(width * 0.5, 520, platformKey) : null;
    floorSprite?.setDisplaySize(width, 24);
    if (physics?.enabled && physicsPuzzle) {
      physics.createBody({
        id: 'floor',
        x: width * 0.5,
        y: 520,
        shape: { kind: 'rect', width, height: 24 },
        static: true,
        friction: 0.05,
        category: 'terrain',
      });
      physics.createBody({
        id: 'left-wall',
        x: 8,
        y: height * 0.5,
        shape: { kind: 'rect', width: 16, height },
        static: true,
        category: 'terrain',
      });
      puzzleBall = physics.createBody({
        id: 'ball',
        x: 200,
        y: 400,
        shape: { kind: 'circle', radius: 16 },
        restitution: 0.12,
        friction: 0.02,
        frictionAir: 0.002,
        category: 'prop',
      });
    }
    const demoBody = physics?.enabled && dummyPointer
      ? (() => {
          physics.createBody({ id: 'floor', x: width * 0.5, y: height - 24, shape: { kind: 'rect', width, height: 32 }, static: true, category: 'terrain' });
          return physics.createBody({ id: 'ball', x: width * 0.5, y: 80, shape: { kind: 'circle', radius: 20 }, restitution: 0.6, category: 'prop' });
        })()
      : null;

    const handle = target
      ? context.interaction.register({
          id: 'target',
          shape: { kind: 'circle', x: centre.x, y: centre.y, radius: centre.radius },
          onHoverEnter: () => {
            hovered = true;
            target.setTint(0xbfe1ff);
          },
          onHoverLeave: () => {
            hovered = false;
            if (!highlighted) target.clearTint();
          },
          onClick: () => {
            activations += 1;
            highlighted = !highlighted;
            target.setTint(highlighted ? 0xffe14d : hovered ? 0xbfe1ff : 0xffffff);
            context.audio.playCue('ui.confirm');
            if (physics && demoBody) physics.applyImpulse(demoBody, 0, -180);
          },
        })
      : null;

    const hud = puzzle
      ? scene.add
          .text(width * 0.5, 28, '', {
            fontFamily: 'ui-monospace, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#111827aa',
            padding: { x: 10, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(20)
      : null;
    const hint = puzzle
      ? scene.add
          .text(width * 0.5, height - 22, physicsPuzzle ? 'CLICK TO NUDGE  -  LAND IN THE GOAL' : 'CLICK THE NOTE  -  THEN THE KEY', mutedStyle(14))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(20)
      : null;

    function renderHud(): void {
      if (!hud || !puzzle) return;
      const snap = puzzle.snapshot();
      if (physicsPuzzle) {
        const ball = puzzleBall && physics ? physics.bodyState(puzzleBall) : null;
        hud.setText(
          snap.failed === true
            ? 'FAILED'
            : puzzle.isSolved()
              ? 'SOLVED'
              : `BALL ${ball ? Math.round(ball.x) : 0}  GOAL 740  NUDGES ${nudges}`,
        );
      } else {
        hud.setText(
          `NOTE ${snap.note ? 'Y' : 'N'}  KEY ${snap.key ? 'Y' : 'N'}${puzzle.isSolved() ? '  ESCAPED' : ''}`,
        );
      }
    }
    renderHud();

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({
      activations,
      highlighted,
      hovered,
      hoveredId: context.interaction.hoveredId,
      pointerWorldX: Math.round(context.spatialPointer.state.worldX),
      pointerWorldY: Math.round(context.spatialPointer.state.worldY),
      lastResult,
      nudges,
      ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}),
      ...(pointerPlay.active ? { pointerPlay: pointerPlay.snapshot() } : {}),
      ...(toy.active ? { toy: toy.snapshot() } : {}),
      ...(physicsPlay.active ? { physicsPlay: physicsPlay.snapshot() } : {}),
      ...(look.active ? { look: look.snapshot() } : {}),
      ...(gallery.active ? { gallery: gallery.snapshot() } : {}),
      weapon: weapon?.snapshot() ?? null,
      ...(puzzle
        ? {
            puzzle: {
              kind: puzzle.snapshot().kind,
              solved: puzzle.isSolved(),
              inGoal: puzzle.snapshot().inGoal === true,
              note: puzzle.snapshot().note === true,
              key: puzzle.snapshot().key === true,
              lastResult,
              ball: puzzleBall && physics ? physics.bodyState(puzzleBall) : null,
            },
          }
        : {}),
      ...(physics
        ? {
            physics: {
              enabled: physics.enabled,
              bodyCount: physics.bodyCount,
              ball: (puzzleBall ?? demoBody) ? physics.bodyState((puzzleBall ?? demoBody)!) : null,
            },
          }
        : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        weapon?.update(deltaMs, nowMs);

        if (dialogue.active) {
          const intent = pointerActionController.read(context.input);
          if (intent.confirmPressed) {
            if (dialogue.snapshot().kind === 'choice') dialogue.choose();
            else dialogue.advance();
          }
          dialogue.render();
          return;
        }

        if (gallery.active) {
          const intent = pointerActionController.read(context.input);
          const ptr = context.spatialPointer.state;
          if (intent.primaryPressed || ptr.justPressed || context.input.isDown('PRIMARY_ACTION')) gallery.fireAt(nowMs, ptr.worldX, ptr.worldY);
          gallery.tick(deltaMs, nowMs);
          return;
        }

        if (pointerPlay.active) {
          pointerPlay.render();
          return;
        }

        if (toy.active) {
          if (context.input.justPressed('MOVE_LEFT')) toy.select(-1);
          if (context.input.justPressed('MOVE_RIGHT')) toy.select(1);
          if (context.input.justPressed('SECONDARY_ACTION')) toy.remove();
          toy.render();
          return;
        }

        if (physicsPlay.active) {
          const intent = pointerActionController.read(context.input);
          const ptr = context.spatialPointer.state;
          if (intent.primaryPressed || ptr.justPressed) physicsPlay.nudge();
          physicsPlay.tick(deltaMs);
          physicsPlay.render();
          return;
        }

        if (look.active) {
          const intent = pointerActionController.read(context.input);
          if (intent.primaryPressed) look.act();
          look.tick(deltaMs);
          look.render();
          return;
        }

        if (weaponsActive) {
          const ptr = context.spatialPointer.state;
          reticle?.setPosition(ptr.worldX, ptr.worldY);
          const intent = pointerActionController.read(context.input);
          if (intent.primaryPressed || ptr.justPressed) {
            const ox = gun?.x ?? width * 0.5;
            const oy = gun?.y ?? height - 56;
            const dx = ptr.worldX - ox;
            const dy = ptr.worldY - oy;
            const len = Math.hypot(dx, dy);
            weapon?.fire(nowMs, len > 1 ? dx / len : 0, len > 1 ? dy / len : -1, { x: ox, y: oy });
          }
          return;
        }

        if (physicsPuzzle && puzzle && physics && puzzleBall) {
          const intent = pointerActionController.read(context.input);
          const ptr = context.spatialPointer.state;
          const snap = puzzle.snapshot();
          if ((intent.primaryPressed || ptr.justPressed) && snap.failed !== true && !puzzle.isSolved()) {
            puzzle.apply({ kind: 'launch' });
            physics.setVelocity(puzzleBall, 10, -4);
            nudges += 1;
            lastResult = 'nudge';
            context.audio.playCue('ui.confirm');
          }
          const ball = physics.bodyState(puzzleBall);
          ballSprite?.setPosition(ball.x, ball.y);
          ballSprite?.setRotation(ball.angle);
          const reported = puzzle.apply({ kind: 'report-entity', entityId: 'ball', x: ball.x, y: ball.y });
          if (reported.solved && lastResult !== 'goal') lastResult = 'goal';
          renderHud();
          return;
        }

        if (escapePuzzle) renderHud();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        handle?.dispose();
        for (const entry of hotspotSprites) {
          entry.handle.dispose();
          try {
            entry.image.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
        dialogue.dispose();
        gallery.dispose();
        weapon?.dispose();
        pointerPlay.dispose();
        toy.dispose();
        physicsPlay.dispose();
        look.dispose();
        physics?.dispose();
        try {
          target?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          gun?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          reticle?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          ballSprite?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          goalSprite?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          floorSprite?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          hud?.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          hint?.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
