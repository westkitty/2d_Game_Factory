import type Phaser from 'phaser';
import type { WallCatalog } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated platform shell to a player-controlled gap course vs a
 * vertical climb (Category-C Wave 27).
 *
 * Inert unless packConfig names a precision or climb starter. Not auto-run
 * (Wave 22). Wall-slide/jump contact is sw2d.wall; parkour still owns FLAG.
 */

export type ParkourStarterMode = 'precision' | 'climb';

export interface StarterParkourSnapshot {
  readonly active: boolean;
  readonly mode: ParkourStarterMode | null;
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterParkourBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number, onGround: boolean): void;
  jumped(): void;
  tick(_deltaMs: number): void;
  snapshot(): StarterParkourSnapshot;
  render(): void;
  attach(player: object): void;
  dispose(): void;
}

const INERT: StarterParkourBinding = {
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
    onGround: false,
    jumps: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  attach: () => undefined,
  dispose: () => undefined,
};

const PRECISION_START = { x: 80, y: 458 };
const CLIMB_START = { x: 100, y: 458 };
const FLAG_X = 820;
const CLIMB_FLAG = { x: 420, y: 338 };
// Platform tops are at y 480 (floors at y 500, 40 tall); a standing player is
// at y 458. Anything lower is in a pit. The first value (520) sat below the
// Arcade world-bounds floor (~518 for this sprite), so a player who fell into
// the precision gap landed on the world edge and was stuck 'playing' forever
// - Category-C convergence bug found by the proof journey.
const FAIL_Y = 490;
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;

export function bindStarterParkour(
  context: SceneContext,
  options?: { readonly mode?: ParkourStarterMode | null; readonly hud?: boolean },
): StarterParkourBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'precision' && mode !== 'climb') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const platformKey = context.assets.resolve('platform');
  const start = mode === 'precision' ? PRECISION_START : CLIMB_START;

  const floors = scene.physics.add.staticGroup();
  const addFloor = (x: number, y: number, w: number, h = 24): void => {
    const body = floors.create(x, y, platformKey) as { setDisplaySize(w: number, h: number): unknown; refreshBody(): unknown };
    body.setDisplaySize(w, h);
    body.refreshBody();
  };
  if (mode === 'precision') {
    addFloor(140, 500, 280, 40);
    addFloor(660, 500, 600, 40);
  } else {
    addFloor(120, 500, 220, 40);
    addFloor(280, 440, 200, 24);
    addFloor(440, 380, 220, 24);
  }
  const wallCatalog = context.content.data['wall']?.value as WallCatalog | undefined;
  if (hud && wallCatalog && wallCatalog.walls[0]?.id !== 'none') {
    for (const wall of wallCatalog.walls) {
      scene.add
        .rectangle(wall.x, wall.y, wall.halfWidth * 2, wall.halfHeight * 2, 0x4f9ee0, 0.55)
        .setStrokeStyle(2, 0xffffff, 0.7)
        .setDepth(12);
    }
  }

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const flag =
    hud
      ? scene.add
          .rectangle(mode === 'precision' ? FLAG_X : CLIMB_FLAG.x, mode === 'precision' ? 458 : CLIMB_FLAG.y, 22, 44, FLAG_COLOR, 0.95)
          .setStrokeStyle(2, 0xffffff, 0.9)
          .setDepth(20)
      : null;

  let x = start.x;
  let y = start.y;
  let onGround = true;
  let jumps = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let disposed = false;

  function snapshot(): StarterParkourSnapshot {
    return {
      active: true,
      mode,
      x: Math.round(x),
      y: Math.round(y),
      onGround,
      jumps,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (flag) flag.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    if (!title || !status || !hint) return;
    if (mode === 'precision') {
      title.setText(snap.outcome === 'complete' ? 'FINISHED' : snap.outcome === 'failed' ? 'FELL' : 'PRECISION');
      status.setText(`x ${snap.x}  ·  jumps ${snap.jumps}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'JUMP THE GAPS   REACH THE FLAG' : snap.outcome === 'complete' ? 'FINISHED' : 'FELL');
    } else {
      title.setText(snap.outcome === 'complete' ? 'SUMMIT' : snap.outcome === 'failed' ? 'FELL' : 'CLIMB');
      status.setText(`y ${snap.y}  ·  jumps ${snap.jumps}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'JUMP UP   REACH THE FLAG' : snap.outcome === 'complete' ? 'SUMMIT' : 'FELL');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (y > FAIL_Y) {
      outcome = 'failed';
      lastResult = 'fell';
      return;
    }
    if (mode === 'precision' && x >= FLAG_X && onGround) {
      outcome = 'complete';
      lastResult = 'finished';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'climb' && onGround && x >= 400 && y <= 410) {
      outcome = 'complete';
      lastResult = 'summit';
      context.audio.playCue('ui.confirm');
    }
  }

  paint();

  return {
    active: true,
    startX: () => start.x,
    startY: () => start.y,
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
    tick(_deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
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
        floors.clear(true, true);
        floors.destroy(true);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
