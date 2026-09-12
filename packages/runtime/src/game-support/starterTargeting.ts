import type { TargetingCatalog, TargetingService } from '@sw2d/contracts';
import { TARGETING_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated grid shell to tower target-selection.
 *
 * Wave 5 L29/L30: spatial pointer hover/click placement, keyboard cursor kept,
 * content-authored upgrade tiers. Inert unless `sw2d.targeting` is installed
 * with mode `tower`.
 */

export interface StarterTargetingSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly enemiesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
  readonly gold: number;
  readonly placed: number;
  readonly preview: string | null;
  readonly placementRejections: number;
  readonly upgradeRejections: number;
  readonly towerDamage: number;
  readonly cursorSlot: number;
}

export interface StarterTargetingBinding {
  readonly active: boolean;
  tick(deltaMs: number): void;
  step(dir: 'up' | 'down' | 'left' | 'right'): void;
  confirm(): void;
  upgradeSelected(): void;
  snapshot(): StarterTargetingSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterTargetingBinding = {
  active: false,
  tick: () => undefined,
  step: () => undefined,
  confirm: () => undefined,
  upgradeSelected: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    enemiesAlive: 0,
    lastResult: null,
    outcome: 'playing',
    gold: 0,
    placed: 0,
    preview: null,
    placementRejections: 0,
    upgradeRejections: 0,
    towerDamage: 0,
    cursorSlot: 0,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const TOWER_COLOR = 0x4f9ee0;
const FOE_COLOR = 0xe05fa0;
const DEAD_COLOR = 0x384054;
const PAD_COLOR = 0x384054;
const PREVIEW_COLOR = 0xffe14d;

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

  const handles: { dispose(): void }[] = [];
  const padSprites: { id: string; sprite: { setFillStyle(c: number, a?: number): unknown; destroy(): void } }[] = [];
  for (const slot of targeting.slots()) {
    const sprite = scene.add.rectangle(slot.x, slot.y, 40, 40, PAD_COLOR, 0.55).setStrokeStyle(2, 0xffffff, 0.4).setDepth(18);
    padSprites.push({ id: slot.id, sprite });
    handles.push(
      context.interaction.register({
        id: `slot-${slot.id}`,
        shape: { kind: 'circle', x: slot.x, y: slot.y, radius: slot.radius },
        onClick: () => {
          const occupant = targeting.occupant(slot.id);
          if (occupant) targeting.upgrade(occupant);
          else targeting.placeAt(slot.x, slot.y);
          syncTowers();
          paint();
        },
      }),
    );
  }

  const foeSprites: { id: string; sprite: { setFillStyle(c: number, a?: number): unknown; destroy(): void } }[] = [];
  for (const actor of targetingCatalog.actors) {
    if (actor.team !== 'enemy' || actor.id === 'none') continue;
    foeSprites.push({
      id: actor.id,
      sprite: scene.add.rectangle(actor.x, actor.y, 32, 32, FOE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20),
    });
  }

  const towerSprites = new Map<string, { destroy(): void }>();
  let cursor = 0;
  let nowMs = 0;
  let disposed = false;

  function selectedTowerId(): string | null {
    const slots = targeting.slots();
    const slot = slots[cursor];
    return slot ? targeting.occupant(slot.id) : null;
  }

  function syncTowers(): void {
    for (const slot of targeting.slots()) {
      const id = targeting.occupant(slot.id);
      if (!id) continue;
      if (towerSprites.has(id)) continue;
      const sprite = scene.add.rectangle(slot.x, slot.y, 44, 56, TOWER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(22);
      towerSprites.set(id, sprite);
    }
  }

  function snapshot(): StarterTargetingSnapshot {
    const ptr = context.spatialPointer.state;
    const first = [...towerSprites.keys()][0];
    return {
      active: true,
      mode: targeting.mode(),
      enemiesAlive: targeting.alive('enemy'),
      lastResult: targeting.lastResult(),
      outcome: targeting.outcome(),
      gold: targeting.gold(),
      placed: targeting.placedCount(),
      preview: targeting.previewSlot(ptr.worldX, ptr.worldY),
      placementRejections: targeting.placementRejections(),
      upgradeRejections: targeting.upgradeRejections(),
      towerDamage: first ? targeting.towerDamage(first) : 0,
      cursorSlot: cursor,
    };
  }

  function paint(): void {
    const snap = snapshot();
    const slots = targeting.slots();
    for (const pad of padSprites) {
      const selected = slots[cursor]?.id === pad.id;
      const hovered = snap.preview === pad.id;
      pad.sprite.setFillStyle(hovered || selected ? PREVIEW_COLOR : PAD_COLOR, hovered ? 0.8 : 0.55);
    }
    for (const entry of foeSprites) {
      const alive = targeting.health(entry.id) > 0;
      entry.sprite.setFillStyle(alive ? FOE_COLOR : DEAD_COLOR, alive ? 0.95 : 0.45);
    }
    title.setText(snap.outcome === 'complete' ? 'CLEARED' : snap.outcome === 'failed' ? 'WIPED' : 'TOWER');
    status.setText(`gold ${snap.gold}  ·  towers ${snap.placed}  ·  foes ${snap.enemiesAlive}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
    hint.setText(
      snap.outcome === 'playing'
        ? 'CLICK OR ENTER PLACES  ·  K UPGRADES'
        : snap.outcome === 'complete'
          ? 'CLEARED'
          : 'WIPED',
    );
  }

  paint();

  return {
    active: true,
    tick(deltaMs: number): void {
      if (disposed) return;
      const ptr = context.spatialPointer.state;
      if (targeting.outcome() === 'playing' && ptr.justPressed && targeting.previewSlot(ptr.worldX, ptr.worldY) === null) {
        targeting.placeAt(ptr.worldX, ptr.worldY);
      }
      if (targeting.outcome() === 'playing') {
        nowMs += deltaMs;
        targeting.tick(deltaMs, nowMs);
        syncTowers();
      }
      paint();
    },
    step(dir: 'up' | 'down' | 'left' | 'right'): void {
      const slots = targeting.slots();
      if (slots.length === 0) return;
      const delta = dir === 'right' || dir === 'down' ? 1 : -1;
      cursor = (cursor + delta + slots.length) % slots.length;
      paint();
    },
    confirm(): void {
      const slots = targeting.slots();
      const slot = slots[cursor];
      if (!slot) return;
      if (targeting.occupant(slot.id)) targeting.upgrade(targeting.occupant(slot.id)!);
      else targeting.placeAt(slot.x, slot.y);
      syncTowers();
      paint();
    },
    upgradeSelected(): void {
      const id = selectedTowerId();
      if (id) targeting.upgrade(id);
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
        for (const handle of handles) handle.dispose();
        for (const pad of padSprites) pad.sprite.destroy();
        for (const foe of foeSprites) foe.sprite.destroy();
        for (const sprite of towerSprites.values()) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
