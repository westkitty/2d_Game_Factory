import { CAMERA_CAPABILITY_ID, type CameraService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';
import { bindStarterEncounters, type StarterEncounterBinding, type StarterEncounterSnapshot } from './starterEncounters.ts';

/**
 * Bind the generated pointer shell to a pointer-aimed target shooter
 * (Final Product Completion, Wave 3 - matrix L15 / L17).
 *
 * Two bounded modes on the same reusable pieces (`sw2d.encounters` target
 * rounds with `drift` / `approach` archetypes, `sw2d.weapons` projectiles,
 * `sw2d.combat` health, `sw2d.arcade` score, and for the rail `sw2d.camera`):
 *   - `gallery` - a fixed gun at the bottom; rounds of drifting targets worth
 *     points; a time limit; hit / miss accuracy; complete when every round
 *     clears, failed when the clock runs out.
 *   - `rail`    - the gun rides the authored camera rail; drones ahead of it
 *     approach; one that reaches the gun has escaped (a miss); complete when
 *     every leg clears.
 *
 * Nothing here is a fixture: the rounds, archetypes, weapon and rail are the
 * generated content documents.
 */

export type GalleryStarterMode = 'gallery' | 'rail';

export interface StarterGallerySnapshot {
  readonly active: boolean;
  readonly mode: GalleryStarterMode | null;
  readonly gunX: number;
  readonly gunY: number;
  readonly railProgress: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly battle: StarterEncounterSnapshot | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterGalleryBinding {
  readonly active: boolean;
  /** Fire the catalog weapon from the gun toward a world point. */
  fireAt(nowMs: number, worldX: number, worldY: number): void;
  tick(deltaMs: number, nowMs: number): void;
  snapshot(): StarterGallerySnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterGalleryBinding = {
  active: false,
  fireAt: () => undefined,
  tick: () => undefined,
  snapshot: () => ({ active: false, mode: null, gunX: 0, gunY: 0, railProgress: 0, scrollX: 0, scrollY: 0, battle: null, outcome: 'playing' }),
  render: () => undefined,
  dispose: () => undefined,
};

const GALLERY_TIME_LIMIT_MS = 45_000;

export function bindStarterGallery(
  context: SceneContext,
  options?: { readonly mode?: GalleryStarterMode | null; readonly hud?: boolean },
): StarterGalleryBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'gallery' && mode !== 'rail') return INERT;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const hud = options?.hud !== false;
  const cam = mode === 'rail' ? context.capabilities.get<CameraService>(CAMERA_CAPABILITY_ID) ?? null : null;
  const rail = cam?.active() && cam.mode() === 'rail' ? cam : null;
  rail?.reset();

  // PlayScene pins the camera to the viewport; a rail needs to travel. (The
  // Wave 26 rail starter called setScroll inside those bounds and never
  // actually moved - found by the Final Product Completion rail journey.)
  if (rail) scene.cameras.main.removeBounds();

  const gun = scene.physics.add.sprite(width * 0.5, height - 56, context.assets.resolve('player'));
  gun.body.setAllowGravity(false);
  gun.setImmovable(true);
  gun.setDepth(8);

  const scroll = (): readonly [number, number] => (rail ? [rail.originX() - width * 0.5, rail.originY() - height * 0.5] : [0, 0]);

  const battle: StarterEncounterBinding = bindStarterEncounters(context, gun, {
    hud: false,
    contactDamage: 0,
    escapeEdge: true,
    spawnOffset: scroll,
    world: () => {
      const [sx, sy] = scroll();
      return { x: sx, y: sy, width, height };
    },
    ...(mode === 'gallery' ? { timeLimitMs: GALLERY_TIME_LIMIT_MS } : {}),
  });
  if (!battle.active) {
    gun.destroy();
    return INERT;
  }

  const reticle = hud ? scene.add.circle(width * 0.5, height * 0.5, 10).setStrokeStyle(2, 0xffe14d, 0.95).setFillStyle(0, 0).setDepth(30) : null;
  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const track = hud && rail ? scene.add.graphics().setDepth(1) : null;

  function outcome(): 'playing' | 'complete' | 'failed' {
    return battle.snapshot()?.outcome ?? 'playing';
  }

  function snapshot(): StarterGallerySnapshot {
    const [sx, sy] = scroll();
    return {
      active: true,
      mode,
      gunX: Math.round(gun.x),
      gunY: Math.round(gun.y),
      railProgress: rail ? Math.round(rail.progress() * 100) / 100 : 0,
      scrollX: Math.round(sx),
      scrollY: Math.round(sy),
      battle: battle.snapshot(),
      outcome: outcome(),
    };
  }

  function paint(): void {
    const ptr = context.spatialPointer.state;
    reticle?.setPosition(ptr.worldX, ptr.worldY);
    if (track && rail) {
      track.clear();
      track.lineStyle(3, 0x4f9ee0, 0.35);
      track.lineBetween(gun.x, gun.y, gun.x, gun.y - height);
    }
    if (!title || !status || !hint) return;
    const b = battle.snapshot();
    if (!b) return;
    const round = b.sequenceLength > 0 ? `round ${Math.min(b.sequenceIndex + 1, b.sequenceLength)}/${b.sequenceLength}` : '';
    title.setText(b.outcome === 'complete' ? (mode === 'rail' ? 'RAIL CLEARED' : 'GALLERY CLEARED') : b.outcome === 'failed' ? 'TIME UP' : mode === 'rail' ? `RAIL ${Math.round((rail?.progress() ?? 0) * 100)}%` : 'GALLERY');
    status.setText(
      `score ${b.score}  ·  ${round}  ·  targets ${b.enemiesAlive}  ·  hits ${b.hits}/${b.shots}${b.escaped > 0 ? `  ·  missed ${b.escaped}` : ''}${
        b.timeLeftMs !== null ? `  ·  ${(b.timeLeftMs / 1000).toFixed(1)}s` : ''
      }`,
    );
    hint.setText(b.outcome === 'playing' ? 'AIM WITH THE MOUSE   CLICK OR J FIRES   CLEAR EVERY ROUND' : 'P THEN K RESTARTS');
  }

  paint();
  let disposed = false;
  return {
    active: true,
    fireAt(nowMs, worldX, worldY): void {
      if (disposed) return;
      const dx = worldX - gun.x;
      const dy = worldY - gun.y;
      const len = Math.hypot(dx, dy);
      battle.fire(nowMs, len > 1 ? dx / len : 0, len > 1 ? dy / len : -1, { x: gun.x, y: gun.y });
    },
    tick(deltaMs, nowMs): void {
      if (disposed) return;
      if (rail && outcome() === 'playing') {
        rail.tick(deltaMs);
        const [sx, sy] = scroll();
        scene.cameras.main.setScroll(sx, sy);
        gun.setPosition(sx + width * 0.5, sy + height - 56);
      }
      battle.update(deltaMs, nowMs);
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      battle.dispose();
      try {
        reticle?.destroy();
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        track?.destroy();
        gun.destroy();
        scene.cameras.main.setScroll(0, 0);
        if (rail) scene.cameras.main.setBounds(0, 0, width, height);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
