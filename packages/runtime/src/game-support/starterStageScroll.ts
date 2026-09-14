import { STAGE_SCROLL_CAPABILITY_ID, type StageScrollService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.stage-scroll`
 * (Category-C Wave 8).
 *
 * Inert unless the game installed the pack with a positive length and speed.
 * Presentation is a high-contrast HUD plus streaming tiles/hazards so the
 * stage is visible in the first short play session. `{ hud: false }` lets
 * expanded kits keep their own presentation (factory shmups use the HUD).
 */

export interface StarterStageScrollSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly offset: number;
  readonly progress: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly fireX: number;
  readonly fireY: number;
  readonly lastHit: string | null;
  readonly outcome: string;
  readonly hazardsVisible: number;
  readonly layers: readonly { readonly id: string; readonly offset: number; readonly speedFactor: number }[];
  readonly currentSpeed: number;
  readonly crossOffset: number;
  readonly railLeg: number;
}

export interface StarterStageScrollBinding {
  readonly active: boolean;
  setMove(x: number, y: number): void;
  tick(deltaMs: number): void;
  snapshot(): StarterStageScrollSnapshot;
  render(): void;
  mode(): string | null;
  fireDir(): { readonly x: number; readonly y: number };
  startX(): number;
  startY(): number;
  dispose(): void;
}

const INERT: StarterStageScrollBinding = {
  active: false,
  setMove: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    offset: 0,
    progress: 0,
    playerX: 0,
    playerY: 0,
    fireX: 0,
    fireY: 0,
    lastHit: null,
    outcome: 'playing',
    hazardsVisible: 0,
    layers: [],
    currentSpeed: 0,
    crossOffset: 0,
    railLeg: -1,
  }),
  render: () => undefined,
  mode: () => null,
  fireDir: () => ({ x: 0, y: 0 }),
  startX: () => 0,
  startY: () => 0,
  dispose: () => undefined,
};

export function bindStarterStageScroll(context: SceneContext, options?: { readonly hud?: boolean }): StarterStageScrollBinding {
  if (!context.capabilities.has(STAGE_SCROLL_CAPABILITY_ID)) return INERT;
  const stage = context.capabilities.require<StageScrollService>(STAGE_SCROLL_CAPABILITY_ID);
  if (!stage.active()) return INERT;
  stage.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const sprites: { destroy(): void }[] = [];
  const platformKey = context.assets.resolve('platform');
  const hazardKey = context.assets.resolve('hazard');
  const tiles: { sprite: { setPosition(x: number, y: number): unknown; destroy(): void } }[] = [];
  const stride = 96;
  const tileCount = 24;
  for (let i = 0; i < tileCount; i++) {
    const sprite = scene.add.image(0, 0, platformKey).setDisplaySize(72, 18).setAlpha(0.35).setDepth(1).setScrollFactor(0);
    tiles.push({ sprite });
    sprites.push(sprite);
  }
  // Parallax planes (Final Product Completion Wave 3): one row / column of
  // tiles per authored layer, moved at the layer's own offset.
  const layerTiles: { id: string; sprites: { setPosition(x: number, y: number): unknown; destroy(): void }[]; count: number }[] = [];
  for (const layer of stage.layers()) {
    const span = stage.mode() === 'vertical' ? height : width;
    const count = Math.ceil(span / layer.spacing) + 2;
    const layerSprites: { setPosition(x: number, y: number): unknown; destroy(): void }[] = [];
    for (let i = 0; i < count; i++) {
      const sprite = scene.add.image(0, 0, platformKey).setDisplaySize(layer.size, layer.size).setAlpha(layer.alpha).setDepth(layer.speedFactor >= 1 ? 3 : 0).setScrollFactor(0);
      layerSprites.push(sprite);
      sprites.push(sprite);
    }
    layerTiles.push({ id: layer.id, sprites: layerSprites, count });
  }
  const hazardSprites: { id: string; sprite: { setPosition(x: number, y: number): unknown; setVisible(v: boolean): unknown; destroy(): void } }[] = [];
  for (const hazard of stage.hazards()) {
    const sprite = scene.add.image(hazard.x, hazard.y, hazardKey).setDisplaySize(hazard.radius * 2, hazard.radius * 2).setDepth(4).setScrollFactor(0);
    hazardSprites.push({ id: hazard.id, sprite });
    sprites.push(sprite);
  }

  function snapshot(): StarterStageScrollSnapshot {
    const p = stage.player();
    const dir = stage.fireDir();
    return {
      active: true,
      mode: stage.mode(),
      offset: stage.offset(),
      progress: stage.progress(),
      playerX: p.x,
      playerY: p.y,
      fireX: dir.x,
      fireY: dir.y,
      lastHit: stage.lastHit(),
      outcome: stage.outcome(),
      hazardsVisible: stage.hazards().filter((hazard) => hazard.visible).length,
      layers: stage.layers().map((l) => ({ id: l.id, offset: Math.round(l.offset), speedFactor: l.speedFactor })),
      currentSpeed: Math.round(stage.currentSpeed()),
      crossOffset: Math.round(stage.crossOffset()),
      railLeg: stage.railLeg(),
    };
  }

  function render(): void {
    const off = stage.offset();
    for (let i = 0; i < tiles.length; i++) {
      if (stage.mode() === 'vertical') {
        const y = ((i * stride + off) % (tileCount * stride) + tileCount * stride) % (tileCount * stride) - stride;
        tiles[i]!.sprite.setPosition(40 + (i % 3) * 440, y);
      } else {
        const x = ((i * stride - off) % (tileCount * stride) + tileCount * stride) % (tileCount * stride) - stride;
        tiles[i]!.sprite.setPosition(x, 48 + (i % 4) * 140);
      }
    }
    for (const layer of stage.layers()) {
      const tiles = layerTiles.find((t) => t.id === layer.id);
      if (!tiles) continue;
      const span = tiles.count * layer.spacing;
      for (let i = 0; i < tiles.count; i++) {
        if (stage.mode() === 'vertical') {
          const y = ((i * layer.spacing + layer.offset) % span + span) % span - layer.spacing;
          tiles.sprites[i]!.setPosition(layer.cross + (i % 2) * 40, y);
        } else {
          const x = ((i * layer.spacing - layer.offset) % span + span) % span - layer.spacing;
          tiles.sprites[i]!.setPosition(x, layer.cross + (i % 2) * 24);
        }
      }
    }
    for (const entry of hazardSprites) {
      const live = stage.hazards().find((hazard) => hazard.id === entry.id);
      entry.sprite.setVisible(live?.visible ?? false);
      if (live) entry.sprite.setPosition(live.x, live.y);
    }
    if (!title || !status || !hint) return;
    title.setText(stage.mode() === 'vertical' ? 'VERTICAL' : 'HORIZONTAL');
    const pct = Math.round(stage.progress() * 100);
    const leg = stage.railLeg();
    status.setText(
      `stage ${pct}%  ·  offset ${Math.round(stage.offset())}${leg >= 0 ? `  ·  leg ${leg + 1} @${Math.round(stage.currentSpeed())}px/s` : ''}${stage.lastHit() ? `  ·  hit ${stage.lastHit()}` : ''}${stage.outcome() !== 'playing' ? `  ·  ${stage.outcome().toUpperCase()}` : ''}`,
    );
    hint.setText('MOVE WASD/ARROWS   FIRE J/X   CLEAR THE STAGE');
  }

  render();

  let disposed = false;
  const start = stage.player();
  return {
    active: true,
    setMove(x: number, y: number): void {
      stage.setMove(x, y);
    },
    tick(deltaMs: number): void {
      stage.tick(deltaMs);
      render();
    },
    snapshot,
    render,
    mode: () => stage.mode(),
    fireDir: () => stage.fireDir(),
    startX: () => start.x,
    startY: () => start.y,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const sprite of sprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
