import type { ItemsService, VehicleService } from '@sw2d/contracts';
import { ITEMS_CAPABILITY_ID, VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated vehicle shell to the reusable sw2d.items held slot
 * (Final Product Completion Wave 4, matrix L18 / L19).
 *
 * Inert unless packConfig names the kart item starter *and* items.state is
 * installed with a live catalog. Pickup grants + holds one catalog item;
 * PRIMARY consumes it through `useHeld` (boost effect and/or a heading
 * shell). The box respawns. Racing still owns checkpoints/laps.
 */

export interface StarterKartItemSnapshot {
  readonly active: boolean;
  readonly held: boolean;
  readonly heldId: string | null;
  readonly fired: number;
  readonly boxX: number;
  readonly boxY: number;
  readonly boxReady: boolean;
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
    heldId: null,
    fired: 0,
    boxX: 0,
    boxY: 0,
    boxReady: false,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const BOXES = [
  { x: 420, y: 440, radius: 56 },
  { x: 760, y: 280, radius: 56 },
] as const;
const BOX_COLOR = 0xf0c274;
const SHELL_COLOR = 0xe05fa0;
const BOX_RESPAWN_MS = 1800;

export function bindStarterKartItem(
  context: SceneContext,
  options?: {
    readonly mode?: 'item' | null;
    readonly hud?: boolean;
    readonly itemId?: string;
    readonly boxes?: readonly { readonly x: number; readonly y: number; readonly radius: number }[];
  },
): StarterKartItemBinding {
  if (options?.mode !== 'item') return INERT;
  if (!context.capabilities.has(ITEMS_CAPABILITY_ID)) return INERT;
  const items = context.capabilities.require<ItemsService>(ITEMS_CAPABILITY_ID);
  const itemId = options.itemId ?? (items.lookup('kart-shell') ? 'kart-shell' : items.definitionIds()[0] ?? '');
  if (!itemId || !items.lookup(itemId)) return INERT;
  const vehicles = context.capabilities.has(VEHICLE_MOTION_CAPABILITY_ID)
    ? context.capabilities.require<VehicleService>(VEHICLE_MOTION_CAPABILITY_ID)
    : null;

  items.clearHeld();
  if (items.count(itemId) > 0) items.remove(itemId, items.count(itemId));

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const boxes = options.boxes && options.boxes.length > 0 ? options.boxes : BOXES;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const boxSprites = hud
    ? boxes.map((box) => scene.add.rectangle(box.x, box.y, 36, 36, BOX_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18))
    : [];
  const shellSprite = hud
    ? scene.add.circle(boxes[0]!.x, boxes[0]!.y, 10, SHELL_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.8).setDepth(21).setVisible(false)
    : null;

  let fired = 0;
  let lastResult: string | null = null;
  let kartX = 160;
  let kartY = 440;
  let kartHeading = 0;
  let shellX = 0;
  let shellY = 0;
  let shellVx = 0;
  let shellVy = 0;
  let shellLive = false;
  const boxReady = boxes.map(() => true);
  const boxCooldownMs = boxes.map(() => 0);
  let disposed = false;

  function snapshot(): StarterKartItemSnapshot {
    const readyIndex = boxReady.findIndex((ready) => ready);
    const shown = boxes[readyIndex] ?? boxes[0]!;
    return {
      active: true,
      held: items.held() === itemId,
      heldId: items.held(),
      fired,
      boxX: shown.x,
      boxY: shown.y,
      boxReady: boxReady.some(Boolean),
      lastResult,
      outcome: 'playing',
    };
  }

  function paint(): void {
    const snap = snapshot();
    for (let i = 0; i < boxSprites.length; i++) boxSprites[i]?.setVisible(boxReady[i]!);
    if (shellSprite) {
      shellSprite.setVisible(shellLive);
      if (shellLive) shellSprite.setPosition(shellX, shellY);
    }
    if (!title || !status || !hint) return;
    const def = items.lookup(itemId);
    title.setText('KART');
    status.setText(
      `${snap.held ? (def?.displayName ?? 'ITEM').toUpperCase() + ' READY' : 'EMPTY'}  ·  used ${snap.fired}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
    );
    hint.setText(snap.held ? 'J USES THE HELD ITEM' : snap.boxReady ? 'DRIVE THROUGH A BOX' : 'BOX RESPAWNING');
  }

  paint();

  return {
    active: true,
    setVehicle(x: number, y: number, heading: number): void {
      if (disposed) return;
      kartX = x;
      kartY = y;
      kartHeading = heading;
      for (let i = 0; i < boxes.length; i++) {
        if (boxCooldownMs[i]! > 0) {
          boxCooldownMs[i] = Math.max(0, boxCooldownMs[i]! - 16);
          if (boxCooldownMs[i] === 0) boxReady[i] = true;
        }
        const box = boxes[i]!;
        if (boxReady[i] && items.held() === null && Math.hypot(x - box.x, y - box.y) <= box.radius) {
          items.grant(itemId, 1);
          if (items.hold(itemId)) {
            boxReady[i] = false;
            boxCooldownMs[i] = BOX_RESPAWN_MS;
            lastResult = 'pickup';
            context.audio.playCue('ui.confirm');
          }
        }
      }
      if (shellLive) {
        shellX += shellVx;
        shellY += shellVy;
        if (shellX < -40 || shellX > width + 40 || shellY < -40 || shellY > height + 40) shellLive = false;
      }
      paint();
    },
    fire() {
      if (disposed) return 'already';
      if (items.held() !== itemId) {
        lastResult = 'empty';
        paint();
        return 'empty';
      }
      const used = items.lookup(itemId);
      const result = items.useHeld(1);
      if (!result.consumed) {
        lastResult = 'empty';
        paint();
        return 'empty';
      }
      fired += 1;
      lastResult = 'fired';
      const fireKind = typeof used?.metadata?.fire === 'string' ? used.metadata.fire : 'shell';
      if (fireKind === 'boost') {
        vehicles?.triggerBoost();
      } else {
        shellLive = true;
        shellX = kartX;
        shellY = kartY;
        shellVx = Math.cos(kartHeading) * 14;
        shellVy = Math.sin(kartHeading) * 14;
      }
      context.audio.playCue('ui.confirm');
      paint();
      return 'fired';
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      items.clearHeld();
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const sprite of boxSprites) sprite.destroy();
        shellSprite?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
