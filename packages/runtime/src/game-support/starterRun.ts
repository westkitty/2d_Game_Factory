import type Phaser from 'phaser';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated platform shell to auto-run presentation
 * (Category-C Wave 22).
 *
 * Inert unless the generated packConfig names a course or endless starter.
 * This file is presentation — not a climbing, chase, or scrolling-stage pack.
 * Segment-chain generation still emits a NormalizedLevel; the starter strip
 * is the playable collision. Overlay runner kits stay local.
 */

const ARCADE_CAPABILITY_ID = 'arcade.score';

export type RunStarterMode = 'course' | 'endless';

export interface StarterRunSnapshot {
  readonly active: boolean;
  readonly mode: RunStarterMode | null;
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly score: number;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterRunBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number, onGround: boolean): void;
  jumped(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterRunSnapshot;
  render(): void;
  /** Collide the shell player with the authored starter strip. */
  attach(player: object): void;
  dispose(): void;
}

const INERT: StarterRunBinding = {
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
    score: 0,
    jumps: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  attach: () => undefined,
  dispose: () => undefined,
};

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
}

const START_X = 100;
const START_Y = 458;
const FLAG_X = 820;
const FAIL_Y = 510;
const SCORE_UNIT = 8;
const ENDLESS_SCORE = 80;
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;

export function bindStarterRun(
  context: SceneContext,
  options?: { readonly mode?: RunStarterMode | null; readonly hud?: boolean },
): StarterRunBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'course' && mode !== 'endless') return INERT;
  const arcade = context.capabilities.has(ARCADE_CAPABILITY_ID)
    ? context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID)
    : null;
  if (mode === 'endless' && !arcade) return INERT;

  if (arcade) {
    const existing = arcade.score();
    if (existing !== 0) arcade.addScore(-existing);
  }

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const platformKey = context.assets.resolve('platform');

  const floors = scene.physics.add.staticGroup();
  const left = floors.create(140, 500, platformKey) as { setDisplaySize(w: number, h: number): unknown; refreshBody(): unknown };
  left.setDisplaySize(280, 40);
  left.refreshBody();
  const right = floors.create(660, 500, platformKey) as { setDisplaySize(w: number, h: number): unknown; refreshBody(): unknown };
  right.setDisplaySize(600, 40);
  right.refreshBody();

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const flag =
    hud && mode === 'course'
      ? scene.add.rectangle(FLAG_X, 458, 22, 44, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;

  let x = START_X;
  let y = START_Y;
  let onGround = true;
  let scoredX = START_X;
  let jumps = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let disposed = false;

  function snapshot(): StarterRunSnapshot {
    return {
      active: true,
      mode,
      x: Math.round(x),
      y: Math.round(y),
      onGround,
      score: arcade ? arcade.score() : 0,
      jumps,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (flag) flag.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    if (!title || !status || !hint) return;
    if (mode === 'course') {
      title.setText(snap.outcome === 'complete' ? 'FINISHED' : snap.outcome === 'failed' ? 'FELL' : 'COURSE');
      status.setText(
        `x ${snap.x}  ·  jumps ${snap.jumps}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'playing' ? 'AUTO RUN   SPACE JUMPS THE GAP' : snap.outcome === 'complete' ? 'FINISHED' : 'FELL');
    } else {
      title.setText(snap.outcome === 'complete' ? 'SURVIVED' : snap.outcome === 'failed' ? 'FELL' : 'ENDLESS');
      status.setText(
        `score ${snap.score}/${ENDLESS_SCORE}  ·  jumps ${snap.jumps}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'playing' ? 'AUTO RUN   SPACE JUMPS   SURVIVE' : snap.outcome === 'complete' ? 'SURVIVED' : 'FELL');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (y > FAIL_Y) {
      outcome = 'failed';
      lastResult = 'fell';
      return;
    }
    if (mode === 'course' && x >= FLAG_X && onGround) {
      outcome = 'complete';
      lastResult = 'finished';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'endless' && arcade && arcade.score() >= ENDLESS_SCORE) {
      outcome = 'complete';
      lastResult = 'survived';
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
    tick(_deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'endless' && arcade) {
        const gained = Math.floor((x - scoredX) / SCORE_UNIT);
        if (gained > 0) {
          arcade.addScore(gained);
          scoredX += gained * SCORE_UNIT;
        }
      }
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
