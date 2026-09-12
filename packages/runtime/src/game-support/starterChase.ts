import type Phaser from 'phaser';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated platform shell to closing-wall pursuit
 * (Category-C Wave 31).
 *
 * Inert unless packConfig names the chase starter. Player-controlled run to
 * FLAG ahead of a closing wall — not auto-run (Wave 22), not parkour (Wave 27),
 * not a reusable chase/pursuit-pressure pack. Overlay chase-platformer stays
 * the frozen-proof kit and is not remanufactured.
 */

export type ChaseStarterMode = 'pursuit';

export interface StarterChaseSnapshot {
  readonly active: boolean;
  readonly mode: ChaseStarterMode | null;
  readonly x: number;
  readonly y: number;
  readonly wallX: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterChaseBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number, onGround: boolean): void;
  jumped(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterChaseSnapshot;
  render(): void;
  attach(player: object): void;
  dispose(): void;
}

const INERT: StarterChaseBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  jumped: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    x: 0,
    y: 0,
    wallX: 0,
    onGround: false,
    jumps: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  attach: () => undefined,
  dispose: () => undefined,
};

const START_X = 100;
const START_Y = 458;
const FLAG_X = 820;
const FAIL_Y = 520;
const WALL_START = -40;
const WALL_SPEED = 72;
const WALL_CATCH = 16;
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;
const WALL_COLOR = 0xe0574f;

export function bindStarterChase(
  context: SceneContext,
  options?: { readonly mode?: ChaseStarterMode | null; readonly hud?: boolean },
): StarterChaseBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'pursuit') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const platformKey = context.assets.resolve('platform');

  const floors = scene.physics.add.staticGroup();
  const floor = floors.create(width * 0.5, 500, platformKey) as {
    setDisplaySize(w: number, h: number): unknown;
    refreshBody(): unknown;
  };
  floor.setDisplaySize(width, 40);
  floor.refreshBody();

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const flag = hud
    ? scene.add.rectangle(FLAG_X, 458, 22, 44, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
    : null;
  const wallSprite = hud
    ? scene.add.rectangle(WALL_START, height * 0.5, 28, height, WALL_COLOR, 0.7).setStrokeStyle(2, 0xffffff, 0.6).setDepth(22)
    : null;

  let x = START_X;
  let y = START_Y;
  let wallX = WALL_START;
  let onGround = true;
  let jumps = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let disposed = false;

  function snapshot(): StarterChaseSnapshot {
    return {
      active: true,
      mode,
      x: Math.round(x),
      y: Math.round(y),
      wallX: Math.round(wallX),
      onGround,
      jumps,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    wallSprite?.setPosition(snap.wallX, height * 0.5);
    if (flag) flag.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    if (!title || !status || !hint) return;
    title.setText(snap.outcome === 'complete' ? 'ESCAPED' : snap.outcome === 'failed' ? 'CAUGHT' : 'CHASE');
    status.setText(
      `x ${snap.x}  ·  wall ${snap.wallX}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
    );
    hint.setText(
      snap.outcome === 'playing' ? 'OUTRUN THE WALL   REACH THE FLAG' : snap.outcome === 'complete' ? 'ESCAPED' : 'CAUGHT',
    );
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (y > FAIL_Y) {
      outcome = 'failed';
      lastResult = 'fell';
      return;
    }
    if (wallX + WALL_CATCH >= x) {
      outcome = 'failed';
      lastResult = 'caught';
      return;
    }
    if (x >= FLAG_X && onGround) {
      outcome = 'complete';
      lastResult = 'escaped';
      context.audio.playCue('ui.confirm');
    }
  }

  paint();

  return {
    active: true,
    startX: () => START_X,
    startY: () => START_Y,
    setPlayer(nextX: number, nextY: number, grounded: boolean): void {
      if (disposed) return;
      x = nextX;
      y = nextY;
      onGround = grounded;
    },
    jumped(): void {
      if (disposed || outcome !== 'playing') return;
      jumps += 1;
      lastResult = 'jump';
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      wallX += WALL_SPEED * (deltaMs / 1000);
      finish();
      paint();
    },
    snapshot,
    render: paint,
    attach(player: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
      if (disposed) return;
      scene.physics.add.collider(player, floors);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        flag?.destroy();
        wallSprite?.destroy();
        floors.clear(true, true);
        floors.destroy(true);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
