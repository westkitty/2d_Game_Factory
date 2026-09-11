import type { AdvancedPhysicsService, PhysicsBodyHandle, PinballCatalog, PinballService } from '@sw2d/contracts';
import { PINBALL_CAPABILITY_ID } from '@sw2d/contracts';
import { createAdvancedPhysics } from './advancedPhysics.ts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated pointer / ui-simulation shells to a Matter toy vs table
 * (Category-C Wave 24).
 *
 * Inert unless packConfig names a toy or table starter. Table with
 * `sw2d.pinball` active presents that pack (no Matter). Toy stays Matter
 * and never ticks pinball. Overlay physics kits stay local. Frozen
 * physics-toy proof is not regenerated.
 */

const ARCADE_CAPABILITY_ID = 'arcade.score';

export type PhysicsStarterMode = 'toy' | 'table';

export interface StarterPhysicsSnapshot {
  readonly active: boolean;
  readonly mode: PhysicsStarterMode | null;
  readonly ballX: number;
  readonly ballY: number;
  readonly score: number;
  readonly nudges: number;
  readonly flips: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterPhysicsBinding {
  readonly active: boolean;
  nudge(): void;
  flip(side: 'left' | 'right'): void;
  tick(_deltaMs: number): void;
  snapshot(): StarterPhysicsSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterPhysicsBinding = {
  active: false,
  nudge: () => undefined,
  flip: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    ballX: 0,
    ballY: 0,
    score: 0,
    nudges: 0,
    flips: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
}

const GOAL_X = 740;
const TABLE_SCORE = 2;
const BUMPERS = [
  { id: 'bumper-a', x: 400, y: 220 },
  { id: 'bumper-b', x: 560, y: 220 },
  { id: 'bumper-c', x: 480,  y: 320 },
] as const;
const CLEAR_COLOR = 0x65d0a8;
const GOAL_COLOR = 0xb98af0;
const BUMPER_COLOR = 0xe05fa0;
const FLIPPER_COLOR = 0x4f9ee0;


function bindPinballTable(
  context: SceneContext,
  pinball: PinballService,
  hud: boolean,
): StarterPhysicsBinding {
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const catalog = context.content.data['pinball']?.value as PinballCatalog | undefined;
  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const ballSprite = hud ? scene.add.circle(pinball.ballX(), pinball.ballY(), 14, 0xf0c274, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20) : null;
  const bumperSprites =
    hud && catalog
      ? catalog.bumpers.map((bumper) =>
          scene.add.circle(bumper.x, bumper.y, bumper.radius, BUMPER_COLOR, 0.9).setStrokeStyle(2, 0xffffff, 0.8).setDepth(18),
        )
      : [];
  const leftSprite =
    hud ? scene.add.rectangle(300, 470, 90, 16, FLIPPER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(19) : null;
  const rightSprite =
    hud ? scene.add.rectangle(660, 470, 90, 16, FLIPPER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(19) : null;
  let flips = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterPhysicsSnapshot {
    return {
      active: true,
      mode: 'table',
      ballX: Math.round(pinball.ballX()),
      ballY: Math.round(pinball.ballY()),
      score: pinball.score(),
      nudges: 0,
      flips,
      lastResult: lastResult ?? pinball.lastResult(),
      outcome: pinball.outcome() === 'complete' ? 'complete' : outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    ballSprite?.setPosition(pinball.ballX(), pinball.ballY());
    if (!title || !status || !hint) return;
    title.setText(snap.outcome === 'complete' ? 'TABLE' : 'PINBALL');
    status.setText(`score ${snap.score}/${TABLE_SCORE}  ·  flips ${snap.flips}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
    hint.setText(snap.outcome === 'playing' ? 'J LEFT K RIGHT   HIT BUMPERS' : 'TABLE');
  }

  paint();

  return {
    active: true,
    nudge: () => undefined,
    flip(side: 'left' | 'right'): void {
      if (disposed || pinball.outcome() !== 'playing') return;
      pinball.flip(side);
      flips += 1;
      lastResult = side === 'left' ? 'flip-left' : 'flip-right';
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed || pinball.outcome() !== 'playing') return;
      pinball.tick(deltaMs);
      if (pinball.outcome() === 'complete') {
        outcome = 'complete';
        lastResult = pinball.lastResult() ?? 'scored';
        context.audio.playCue('ui.confirm');
      }
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        ballSprite?.destroy();
        leftSprite?.destroy();
        rightSprite?.destroy();
        for (const sprite of bumperSprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}

export function bindStarterPhysics(
  context: SceneContext,
  options?: { readonly mode?: PhysicsStarterMode | null; readonly hud?: boolean },
): StarterPhysicsBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'toy' && mode !== 'table') return INERT;
  const pinball = context.capabilities.get<PinballService>(PINBALL_CAPABILITY_ID);
  if (mode === 'table' && pinball?.active()) {
    return bindPinballTable(context, pinball, options?.hud !== false);
  }
  if (context.definition.physicsProfile !== 'matter') return INERT;
  const physics: AdvancedPhysicsService = createAdvancedPhysics(context.scene);
  if (!physics.enabled) {
    physics.dispose();
    return INERT;
  }
  const arcade = context.capabilities.has(ARCADE_CAPABILITY_ID)
    ? context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID)
    : null;
  if (mode === 'table' && !arcade) {
    physics.dispose();
    return INERT;
  }
  if (arcade) {
    const existing = arcade.score();
    if (existing !== 0) arcade.addScore(-existing);
  }

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  physics.createBody({
    id: 'floor',
    x: width * 0.5,
    y: mode === 'toy' ? 520 : height - 18,
    shape: { kind: 'rect', width, height: 24 },
    static: true,
    friction: 0.04,
    category: 'terrain',
  });
  physics.createBody({
    id: 'left-wall',
    x: 10,
    y: height * 0.5,
    shape: { kind: 'rect', width: 20, height },
    static: true,
    category: 'terrain',
  });
  physics.createBody({
    id: 'right-wall',
    x: width - 10,
    y: height * 0.5,
    shape: { kind: 'rect', width: 20, height },
    static: true,
    category: 'terrain',
  });
  physics.createBody({
    id: 'ceiling',
    x: width * 0.5,
    y: 12,
    shape: { kind: 'rect', width, height: 24 },
    static: true,
    category: 'terrain',
  });

  const ballStart = mode === 'toy' ? { x: 220, y: 400 } : { x: 480, y: 90 };
  const ball: PhysicsBodyHandle = physics.createBody({
    id: 'ball',
    x: ballStart.x,
    y: ballStart.y,
    shape: { kind: 'circle', radius: 14 },
    restitution: mode === 'table' ? 0.85 : 0.12,
    friction: 0.02,
    frictionAir: 0.002,
    category: 'prop',
  });
  if (mode === 'table') physics.setVelocity(ball, 2.4, 6);

  const leftFlipper =
    mode === 'table'
      ? physics.createBody({
          id: 'flip-l',
          x: 300,
          y: 470,
          shape: { kind: 'rect', width: 90, height: 16 },
          restitution: 0.4,
          category: 'prop',
        })
      : null;
  const rightFlipper =
    mode === 'table'
      ? physics.createBody({
          id: 'flip-r',
          x: 660,
          y: 470,
          shape: { kind: 'rect', width: 90, height: 16 },
          restitution: 0.4,
          category: 'prop',
        })
      : null;
  if (leftFlipper) physics.createPin(leftFlipper, { x: 260, y: 470 });
  if (rightFlipper) physics.createPin(rightFlipper, { x: 700, y: 470 });

  for (const bumper of mode === 'table' ? BUMPERS : []) {
    physics.createBody({
      id: bumper.id,
      x: bumper.x,
      y: bumper.y,
      shape: { kind: 'circle', radius: 28 },
      static: true,
      restitution: 1.2,
      category: 'terrain',
    });
  }

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const ballSprite = hud ? scene.add.circle(ballStart.x, ballStart.y, 14, 0xf0c274, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20) : null;
  const goalSprite =
    hud && mode === 'toy'
      ? scene.add.rectangle(800, 478, 40, 70, GOAL_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18)
      : null;
  const bumperSprites =
    hud && mode === 'table'
      ? BUMPERS.map((bumper) => scene.add.circle(bumper.x, bumper.y, 28, BUMPER_COLOR, 0.9).setStrokeStyle(2, 0xffffff, 0.8).setDepth(18))
      : [];
  const leftSprite =
    hud && mode === 'table'
      ? scene.add.rectangle(300, 470, 90, 16, FLIPPER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(19)
      : null;
  const rightSprite =
    hud && mode === 'table'
      ? scene.add.rectangle(660, 470, 90, 16, FLIPPER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(19)
      : null;

  let nudges = 0;
  let flips = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let bumperCool: Record<string, number> = { 'bumper-a': 0, 'bumper-b': 0, 'bumper-c': 0 };
  let nowMs = 0;
  let disposed = false;

  function ballState() {
    return physics.bodyState(ball);
  }

  function snapshot(): StarterPhysicsSnapshot {
    const b = ballState();
    return {
      active: true,
      mode,
      ballX: Math.round(b.x),
      ballY: Math.round(b.y),
      score: arcade ? arcade.score() : 0,
      nudges,
      flips,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    const b = ballState();
    ballSprite?.setPosition(b.x, b.y);
    if (leftFlipper && leftSprite) {
      const st = physics.bodyState(leftFlipper);
      leftSprite.setPosition(st.x, st.y);
      leftSprite.setRotation(st.angle);
    }
    if (rightFlipper && rightSprite) {
      const st = physics.bodyState(rightFlipper);
      rightSprite.setPosition(st.x, st.y);
      rightSprite.setRotation(st.angle);
    }
    if (goalSprite) goalSprite.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : GOAL_COLOR, 0.95);
    if (!title || !status || !hint) return;
    if (mode === 'toy') {
      title.setText(snap.outcome === 'complete' ? 'LANDED' : 'TOY');
      status.setText(
        `ball ${snap.ballX}  ·  goal ${GOAL_X}  ·  nudges ${snap.nudges}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'playing' ? 'CLICK OR J LAUNCHES   LAND IN THE GOAL' : 'LANDED');
    } else {
      title.setText(snap.outcome === 'complete' ? 'TABLE' : 'PINBALL');
      status.setText(
        `score ${snap.score}/${TABLE_SCORE}  ·  flips ${snap.flips}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
      );
      hint.setText(snap.outcome === 'playing' ? 'J LEFT K RIGHT   HIT BUMPERS' : 'TABLE');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    const b = ballState();
    if (mode === 'toy' && b.x >= GOAL_X && b.y >= 430 && b.y <= 530) {
      outcome = 'complete';
      lastResult = 'goal';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'table' && arcade && arcade.score() >= TABLE_SCORE) {
      outcome = 'complete';
      lastResult = 'scored';
      context.audio.playCue('ui.confirm');
    }
  }

  paint();

  return {
    active: true,
    nudge(): void {
      if (disposed || outcome !== 'playing' || mode !== 'toy') return;
      physics.setVelocity(ball, 10, -4);
      nudges += 1;
      lastResult = 'nudge';
      context.audio.playCue('ui.confirm');
      paint();
    },
    flip(side: 'left' | 'right'): void {
      if (disposed || outcome !== 'playing' || mode !== 'table') return;
      const handle = side === 'left' ? leftFlipper : rightFlipper;
      if (handle) physics.applyImpulse(handle, 0, -180);
      const b = ballState();
      const flipX = side === 'left' ? 300 : 660;
      if (b.y > 400 && Math.abs(b.x - flipX) < 140) {
        physics.setVelocity(ball, side === 'left' ? 4 : -4, -8);
        lastResult = side === 'left' ? 'flip-left' : 'flip-right';
      } else {
        lastResult = 'flip-miss';
      }
      flips += 1;
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      nowMs += deltaMs;
      if (mode === 'table' && arcade) {
        const b = ballState();
        for (const bumper of BUMPERS) {
          if (nowMs < bumperCool[bumper.id]!) continue;
          if (Math.hypot(b.x - bumper.x, b.y - bumper.y) <= 44) {
            arcade.addScore(1);
            bumperCool[bumper.id] = nowMs + 400;
            lastResult = `bumper-${bumper.id.slice(-1)}`;
            physics.applyImpulse(ball, (b.x - bumper.x) * 8, (b.y - bumper.y) * 8);
          }
        }
      }
      finish();
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      physics.dispose();
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        ballSprite?.destroy();
        goalSprite?.destroy();
        leftSprite?.destroy();
        rightSprite?.destroy();
        for (const sprite of bumperSprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
