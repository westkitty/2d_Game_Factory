import type { TargetingCatalog, TargetingService } from '@sw2d/contracts';
import { TARGETING_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated grid shell to tower target-selection (Category-C Wave 30).
 *
 * Inert unless `sw2d.targeting` is installed with mode `tower`. Auto and
 * range modes bind from the battler / tactics starters instead. Overlay
 * tower kits stay local. Frozen proofs are not regenerated.
 */

export interface StarterTargetingSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly enemiesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
}

export interface StarterTargetingBinding {
  readonly active: boolean;
  tick(deltaMs: number): void;
  snapshot(): StarterTargetingSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterTargetingBinding = {
  active: false,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    enemiesAlive: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const TOWER_COLOR = 0x4f9ee0;
const FOE_COLOR = 0xe05fa0;
const DEAD_COLOR = 0x384054;
const CLEAR_COLOR = 0x65d0a8;

export function bindStarterTargeting(context: SceneContext): StarterTargetingBinding {
  const service = context.capabilities.get<TargetingService>(TARGETING_CAPABILITY_ID);
  if (!service?.active() || service.mode() !== 'tower') return INERT;
  const targeting = service;
  const catalog = context.content.data['targeting']?.value as TargetingCatalog | undefined;
  if (!catalog || catalog.actors[0]?.id === 'none') return INERT;
  const targetingCatalog = catalog;

  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const title = scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50);
  const status = scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50);
  const hint = scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50);

  const markers: { id: string; sprite: { setFillStyle(c: number, a?: number): unknown; destroy(): void } }[] = [];
  for (const actor of targetingCatalog.actors) {
    if (actor.id === 'none') continue;
    const color = actor.team === 'player' ? TOWER_COLOR : FOE_COLOR;
    markers.push({
      id: actor.id,
      sprite: scene.add.rectangle(actor.x, actor.y, actor.team === 'player' ? 44 : 32, actor.team === 'player' ? 56 : 32, color, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setDepth(20),
    });
    scene.add
      .text(actor.x, actor.y - 40, actor.id.toUpperCase(), mutedStyle(12))
      .setOrigin(0.5)
      .setDepth(21);
  }

  let nowMs = 0;
  let disposed = false;

  function snapshot(): StarterTargetingSnapshot {
    return {
      active: true,
      mode: targeting.mode(),
      enemiesAlive: targeting.alive('enemy'),
      lastResult: targeting.lastResult(),
      outcome: targeting.outcome(),
    };
  }

  function paint(): void {
    const snap = snapshot();
    for (const entry of markers) {
      const actor = targetingCatalog.actors.find((a) => a.id === entry.id);
      if (!actor) continue;
      if (actor.team === 'player') {
        entry.sprite.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : TOWER_COLOR, 0.95);
      } else {
        const alive = targeting.alive('enemy') > 0;
        // Per-actor HP is not exposed; paint remaining foes as a group.
        entry.sprite.setFillStyle(snap.outcome === 'complete' || !alive ? DEAD_COLOR : FOE_COLOR, snap.outcome === 'complete' ? 0.45 : 0.95);
      }
    }
    title.setText(snap.outcome === 'complete' ? 'CLEARED' : snap.outcome === 'failed' ? 'WIPED' : 'TOWER');
    status.setText(
      `foes ${snap.enemiesAlive}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
    );
    hint.setText(snap.outcome === 'playing' ? 'TOWERS AUTO-STRIKE IN RANGE' : snap.outcome === 'complete' ? 'CLEARED' : 'WIPED');
  }

  paint();

  return {
    active: true,
    tick(deltaMs: number): void {
      if (disposed || targeting.outcome() !== 'playing') return;
      nowMs += deltaMs;
      targeting.tick(deltaMs, nowMs);
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title.destroy();
        status.destroy();
        hint.destroy();
        for (const entry of markers) entry.sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
