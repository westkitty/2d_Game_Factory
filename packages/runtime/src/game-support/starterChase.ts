import type Phaser from 'phaser';
import { PURSUIT_CAPABILITY_ID, type PursuitService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated platform shell to the reusable pursuit capability in
 * `wall` mode - a closing wall the player must outrun to the escape line
 * (Category-C Wave 31; rebuilt on `sw2d.pursuit` by the Final Product
 * Completion program, Wave 1 - matrix L01).
 *
 * Inert unless packConfig names the chase starter *and* `sw2d.pursuit` is
 * installed with a live catalog. The wall's speed, catch distance and escape
 * line come from `content/pursuit.json`; this file owns only the floor strip,
 * the flag and the HUD.
 */

export type ChaseStarterMode = 'pursuit';

export interface StarterChaseSnapshot {
  readonly active: boolean;
  readonly mode: ChaseStarterMode | null;
  readonly x: number;
  readonly y: number;
  readonly wallX: number;
  readonly gap: number;
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
    gap: 0,
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
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;
const WALL_COLOR = 0xe0574f;

export function bindStarterChase(
  context: SceneContext,
  options?: { readonly mode?: ChaseStarterMode | null; readonly hud?: boolean },
): StarterChaseBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'pursuit') return INERT;
  if (!context.capabilities.has(PURSUIT_CAPABILITY_ID)) return INERT;
  const pursuit = context.capabilities.require<PursuitService>(PURSUIT_CAPABILITY_ID);
  if (!pursuit.active()) return INERT;
  pursuit.reset();

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const platformKey = context.assets.resolve('platform');
  const flagX = pursuit.escapeX() ?? width - 140;

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
    ? scene.add.rectangle(flagX, 458, 22, 44, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
    : null;
  const wallSprite = hud
    ? scene.add.rectangle(pursuit.pursuerX(), height * 0.5, 28, height, WALL_COLOR, 0.7).setStrokeStyle(2, 0xffffff, 0.6).setDepth(22)
    : null;

  let x = START_X;
  let y = START_Y;
  let onGround = true;
  let jumps = 0;
  let jumpResult: string | null = null;
  let disposed = false;

  function snapshot(): StarterChaseSnapshot {
    const outcome = pursuit.outcome();
    return {
      active: true,
      mode,
      x: Math.round(x),
      y: Math.round(y),
      wallX: Math.round(pursuit.pursuerX()),
      gap: Math.round(pursuit.gap()),
      onGround,
      jumps,
      lastResult: pursuit.lastResult() ?? jumpResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    wallSprite?.setPosition(snap.wallX, height * 0.5);
    if (flag) flag.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    if (!title || !status || !hint) return;
    title.setText(snap.outcome === 'complete' ? 'ESCAPED' : snap.outcome === 'failed' ? 'CAUGHT' : 'CHASE');
    status.setText(`x ${snap.x}  ·  wall ${snap.wallX}  ·  gap ${snap.gap}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
    hint.setText(
      snap.outcome === 'playing' ? 'OUTRUN THE WALL   REACH THE FLAG' : snap.outcome === 'complete' ? 'ESCAPED' : 'CAUGHT',
    );
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
      pursuit.setPlayer(nextX, nextY, grounded);
    },
    jumped(): void {
      if (disposed || pursuit.outcome() !== 'playing') return;
      jumps += 1;
      jumpResult = 'jump';
    },
    tick(deltaMs: number): void {
      if (disposed || pursuit.outcome() !== 'playing') return;
      pursuit.tick(deltaMs);
      if (pursuit.outcome() === 'complete') context.audio.playCue('ui.confirm');
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
