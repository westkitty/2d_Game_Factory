import type Phaser from 'phaser';
import { PURSUIT_CAPABILITY_ID, type PursuitService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated platform shell to auto-run presentation
 * (Category-C Wave 22; runner pressure added by the Final Product Completion
 * program, Wave 1 - matrix L02).
 *
 * Inert unless the generated packConfig names a course or endless starter.
 * The defining runner pressure is the reusable `sw2d.pursuit` chaser: it
 * trails the runner by the catalog gap and closes while the runner stumbles
 * on an authored hazard (a low block that must be jumped). Two stumbles in a
 * row and the chaser catches up; a clean run keeps the gap. Segment-chain
 * generation still emits a NormalizedLevel; the starter strip is the
 * playable collision. Overlay runner kits stay local.
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
  readonly stumbles: number;
  readonly stumbling: boolean;
  readonly chaserX: number;
  readonly gap: number;
  readonly hazardsLeft: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterRunBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number, onGround: boolean): void;
  jumped(): void;
  /** True while the runner is tripped by a hazard; the shell holds the player still. */
  stumbling(): boolean;
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
  stumbling: () => false,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    x: 0,
    y: 0,
    onGround: false,
    score: 0,
    jumps: 0,
    stumbles: 0,
    stumbling: false,
    chaserX: 0,
    gap: 0,
    hazardsLeft: 0,
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

interface Hazard {
  readonly id: string;
  readonly x: number;
  readonly halfWidth: number;
  /** Top of the block; the runner clears it only while above this line. */
  readonly top: number;
  hit: boolean;
  sprite: { destroy(): void; setAlpha(a: number): unknown } | null;
}

const START_X = 100;
const START_Y = 458;
const FLAG_X = 820;
const FAIL_Y = 510;
const SCORE_UNIT = 8;
const ENDLESS_SCORE = 100;
const PLAYER_HALF_HEIGHT = 22;
const FLAG_COLOR = 0xb98af0;
const CLEAR_COLOR = 0x65d0a8;
const CHASER_COLOR = 0xe0574f;
const HAZARD_COLOR = 0xf0a35a;

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
  const pursuit = context.capabilities.has(PURSUIT_CAPABILITY_ID)
    ? context.capabilities.require<PursuitService>(PURSUIT_CAPABILITY_ID)
    : null;
  const chaser = pursuit && pursuit.active() ? pursuit : null;
  chaser?.reset();

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

  // Authored stumble hazards: low blocks on the far strip. Running into one
  // trips the runner (the chaser closes); jumping over it is clean.
  const hazards: Hazard[] = chaser
    ? [
        { id: 'block-a', x: 520, halfWidth: 12, top: 462, hit: false, sprite: null },
        { id: 'block-b', x: 760, halfWidth: 12, top: 462, hit: false, sprite: null },
      ]
    : [];
  if (hud) {
    for (const hazard of hazards) {
      hazard.sprite = scene.add
        .rectangle(hazard.x, (hazard.top + 480) / 2, hazard.halfWidth * 2, 480 - hazard.top, HAZARD_COLOR, 0.9)
        .setStrokeStyle(2, 0xffffff, 0.7)
        .setDepth(18);
    }
  }

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const flag =
    hud && mode === 'course'
      ? scene.add.rectangle(FLAG_X, 458, 22, 44, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const chaserSprite =
    hud && chaser
      ? scene.add.rectangle(chaser.pursuerX(), 452, 30, 56, CHASER_COLOR, 0.85).setStrokeStyle(2, 0xffffff, 0.7).setDepth(22)
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
      stumbles: chaser?.stumbles() ?? 0,
      stumbling: chaser?.stumbling() ?? false,
      chaserX: Math.round(chaser?.pursuerX() ?? 0),
      gap: Math.round(chaser?.gap() ?? 0),
      hazardsLeft: hazards.filter((h) => !h.hit).length,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (flag) flag.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    chaserSprite?.setPosition(snap.chaserX, 452);
    if (!title || !status || !hint) return;
    const chase = chaser ? `  ·  gap ${snap.gap}${snap.stumbling ? '  ·  STUMBLE' : ''}` : '';
    if (mode === 'course') {
      title.setText(snap.outcome === 'complete' ? 'FINISHED' : snap.outcome === 'failed' ? (snap.lastResult === 'caught' ? 'CAUGHT' : 'FELL') : 'COURSE');
      status.setText(`x ${snap.x}  ·  jumps ${snap.jumps}${chase}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(
        snap.outcome === 'playing'
          ? chaser
            ? 'AUTO RUN   SPACE JUMPS GAPS AND BLOCKS   STAY AHEAD OF THE CHASER'
            : 'AUTO RUN   SPACE JUMPS THE GAP'
          : snap.outcome === 'complete'
            ? 'FINISHED'
            : snap.lastResult === 'caught'
              ? 'CAUGHT'
              : 'FELL',
      );
    } else {
      title.setText(snap.outcome === 'complete' ? 'SURVIVED' : snap.outcome === 'failed' ? (snap.lastResult === 'caught' ? 'CAUGHT' : 'FELL') : 'ENDLESS');
      status.setText(`score ${snap.score}/${ENDLESS_SCORE}  ·  jumps ${snap.jumps}${chase}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(
        snap.outcome === 'playing'
          ? chaser
            ? 'AUTO RUN   SPACE JUMPS   DO NOT TRIP TWICE'
            : 'AUTO RUN   SPACE JUMPS   SURVIVE'
          : snap.outcome === 'complete'
            ? 'SURVIVED'
            : snap.lastResult === 'caught'
              ? 'CAUGHT'
              : 'FELL',
      );
    }
  }

  function checkHazards(): void {
    if (!chaser) return;
    const bottom = y + PLAYER_HALF_HEIGHT;
    for (const hazard of hazards) {
      if (hazard.hit) continue;
      if (Math.abs(x - hazard.x) > hazard.halfWidth + 14) continue;
      if (bottom <= hazard.top + 2) continue;
      hazard.hit = true;
      hazard.sprite?.setAlpha(0.35);
      chaser.stumble();
      lastResult = 'stumbled';
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (chaser && chaser.outcome() !== 'playing') {
      outcome = chaser.outcome();
      lastResult = chaser.lastResult();
      if (outcome === 'complete') context.audio.playCue('ui.confirm');
      return;
    }
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
      chaser?.setPlayer(nextX, nextY, grounded);
    },
    jumped(): void {
      if (disposed || outcome !== 'playing') return;
      jumps += 1;
      lastResult = 'jump';
    },
    stumbling: () => chaser?.stumbling() ?? false,
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      checkHazards();
      chaser?.tick(deltaMs);
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
        chaserSprite?.destroy();
        for (const hazard of hazards) hazard.sprite?.destroy();
        floors.clear(true, true);
        floors.destroy(true);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
