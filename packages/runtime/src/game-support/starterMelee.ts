import { MELEE_CAPABILITY_ID, type MeleeService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.melee`
 * (Category-C Wave 6).
 *
 * Inert unless the game installed the pack and the catalog has foes.
 * Presentation is a high-contrast HUD so HP / foes / last strike are
 * readable in the first short play session. `{ hud: false }` lets expanded
 * kits keep their own presentation.
 */

export interface StarterMeleeSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerX: number;
  readonly playerY: number;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

export interface StarterMeleeBinding {
  readonly active: boolean;
  setPlayer(x: number, y: number): void;
  strike(nowMs: number): 'hit' | 'miss' | 'cooldown';
  tick(deltaMs: number, nowMs: number): void;
  snapshot(): StarterMeleeSnapshot;
  render(): void;
  mode(): string | null;
  startX(): number;
  startY(): number;
  foes(): readonly { readonly id: string; readonly x: number; readonly y: number; readonly alive: boolean; readonly health: number }[];
  dispose(): void;
}

const INERT: StarterMeleeBinding = {
  active: false,
  setPlayer: () => undefined,
  strike: () => 'miss',
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    playerX: 0,
    playerY: 0,
    playerHealth: 0,
    foesAlive: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  mode: () => null,
  startX: () => 0,
  startY: () => 0,
  foes: () => [],
  dispose: () => undefined,
};

export function bindStarterMelee(context: SceneContext, options?: { readonly hud?: boolean }): StarterMeleeBinding {
  if (!context.capabilities.has(MELEE_CAPABILITY_ID)) return INERT;
  const melee = context.capabilities.require<MeleeService>(MELEE_CAPABILITY_ID);
  if (!melee.active()) return INERT;
  melee.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const sprites: { destroy(): void }[] = [];
  const foeSprites: { id: string; sprite: { setPosition(x: number, y: number): unknown; setVisible(v: boolean): unknown; destroy(): void } }[] = [];

  if (hud) {
    const foeKey = context.assets.resolve('enemy');
    for (const foe of melee.foes()) {
      const sprite = scene.add.image(foe.x, foe.y, foeKey).setDisplaySize(34, 34).setDepth(4);
      foeSprites.push({ id: foe.id, sprite });
      sprites.push(sprite);
    }
  }

  function snapshot(): StarterMeleeSnapshot {
    const p = melee.player();
    return {
      active: true,
      mode: melee.mode(),
      playerX: p.x,
      playerY: p.y,
      playerHealth: melee.playerHealth(),
      foesAlive: melee.foesAlive(),
      lastResult: melee.lastResult(),
      outcome: melee.outcome(),
    };
  }

  function render(): void {
    for (const entry of foeSprites) {
      const live = melee.foes().find((foe) => foe.id === entry.id);
      entry.sprite.setVisible(live?.alive ?? false);
      if (live) entry.sprite.setPosition(live.x, live.y);
    }
    if (!title || !status || !hint) return;
    title.setText(melee.mode() === 'arena' ? 'ARENA' : 'SKIRMISH');
    status.setText(
      `hp ${melee.playerHealth()}  ·  foes ${melee.foesAlive()}${melee.outcome() !== 'playing' ? `  ·  ${melee.outcome().toUpperCase()}` : ''}`,
    );
    hint.setText('MOVE WASD/ARROWS   STRIKE J/X');
  }

  render();

  let disposed = false;
  const start = melee.player();
  return {
    active: true,
    setPlayer(x: number, y: number): void {
      melee.setPlayer(x, y);
    },
    strike(nowMs: number) {
      const result = melee.strike(nowMs);
      render();
      return result;
    },
    tick(deltaMs: number, nowMs: number): void {
      melee.tick(deltaMs, nowMs);
      render();
    },
    snapshot,
    render,
    mode: () => melee.mode(),
    startX: () => start.x,
    startY: () => start.y,
    foes: () => melee.foes(),
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
