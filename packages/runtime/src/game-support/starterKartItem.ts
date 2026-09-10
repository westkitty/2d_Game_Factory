import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated vehicle shell to on-demand kart item-fire
 * (Category-C Wave 29).
 *
 * Inert unless packConfig names the kart item starter. Pickup and fire are
 * game-specific presentation — not a reusable item-fire pack. Overlay kart
 * kits stay local. Racing still owns checkpoints/laps.
 */

export interface StarterKartItemSnapshot {
  readonly active: boolean;
  readonly held: boolean;
  readonly fired: number;
  readonly boxX: number;
  readonly boxY: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterKartItemBinding {
  readonly active: boolean;
  setVehicle(x: number, y: number, heading: number): void;
  fire(): 'fired' | 'empty' | 'already';
  snapshot(): StarterKartItemSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterKartItemBinding = {
  active: false,
  setVehicle: () => undefined,
  fire: () => 'empty',
  snapshot: () => ({
    active: false,
    held: false,
    fired: 0,
    boxX: 0,
    boxY: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const BOX = { x: 420, y: 440, radius: 56 };
const BOX_COLOR = 0xf0c274;
const SHELL_COLOR = 0xe05fa0;

export function bindStarterKartItem(
  context: SceneContext,
  options?: { readonly mode?: 'item' | null; readonly hud?: boolean },
): StarterKartItemBinding {
  if (options?.mode !== 'item') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const boxSprite = hud
    ? scene.add.rectangle(BOX.x, BOX.y, 36, 36, BOX_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18)
    : null;
  const shellSprite = hud
    ? scene.add.circle(BOX.x, BOX.y, 10, SHELL_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(21).setVisible(false)
    : null;

  let held = false;
  let fired = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let kartX = 160;
  let kartY = 440;
  let kartHeading = 0;
  let shellX = 0;
  let shellY = 0;
  let shellVx = 0;
  let shellVy = 0;
  let shellLive = false;
  let disposed = false;

  function snapshot(): StarterKartItemSnapshot {
    return {
      active: true,
      held,
      fired,
      boxX: BOX.x,
      boxY: BOX.y,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (boxSprite) {
      boxSprite.setVisible(!held && snap.outcome === 'playing');
      boxSprite.setFillStyle(BOX_COLOR, 0.95);
    }
    if (shellSprite) {
      shellSprite.setVisible(shellLive);
      if (shellLive) shellSprite.setPosition(shellX, shellY);
    }
    if (!title || !status || !hint) return;
    title.setText(snap.outcome === 'complete' ? 'FIRED' : 'KART');
    status.setText(
      `${snap.held ? 'SHELL READY' : 'EMPTY'}  ·  fired ${snap.fired}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
    );
    hint.setText(snap.outcome === 'playing' ? (snap.held ? 'J FIRES THE SHELL' : 'DRIVE THROUGH THE BOX') : 'FIRED');
  }

  paint();

  return {
    active: true,
    setVehicle(x: number, y: number, heading: number): void {
      if (disposed) return;
      kartX = x;
      kartY = y;
      kartHeading = heading;
      if (!held && outcome === 'playing' && Math.hypot(x - BOX.x, y - BOX.y) <= BOX.radius) {
        held = true;
        lastResult = 'pickup';
        context.audio.playCue('ui.confirm');
      }
      if (shellLive) {
        shellX += shellVx;
        shellY += shellVy;
        if (shellX < -40 || shellX > width + 40 || shellY < -40 || shellY > height + 40) shellLive = false;
      }
      paint();
    },
    fire() {
      if (disposed || outcome !== 'playing') return 'already';
      if (!held) {
        lastResult = 'empty';
        paint();
        return 'empty';
      }
      held = false;
      fired += 1;
      lastResult = 'fired';
      outcome = 'complete';
      shellLive = true;
      shellX = kartX;
      shellY = kartY;
      shellVx = Math.cos(kartHeading) * 14;
      shellVy = Math.sin(kartHeading) * 14;
      context.audio.playCue('ui.confirm');
      paint();
      return 'fired';
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
        boxSprite?.destroy();
        shellSprite?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
