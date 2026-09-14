import { MELEE_CAPABILITY_ID, type MeleeService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.melee`
 * (Category-C Wave 6; combo counter, facing arc and targeting reticle added
 * by the Final Product Completion program, Wave 2 - matrix L04).
 *
 * Inert unless the game installed the pack and the catalog has foes.
 * Presentation is a high-contrast HUD so HP / foes / combo / target are
 * readable in the first short play session: the facing arc is drawn from
 * the player, the current target wears a reticle ring, and the status line
 * carries the chain count and the window. `{ hud: false }` lets expanded
 * kits keep their own presentation.
 */

export interface StarterMeleeSnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerX: number;
  readonly playerY: number;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly facingX: number;
  readonly facingY: number;
  readonly targetId: string | null;
  readonly comboStep: number;
  readonly comboWindowLeftMs: number;
  readonly bestCombo: number;
  readonly stunned: boolean;
  readonly lastResult: string | null;
  readonly outcome: string;
}

export interface StarterMeleeBinding {
  readonly active: boolean;
  setPlayer(x: number, y: number): void;
  setFacing(dx: number, dy: number): void;
  strike(nowMs: number): 'hit' | 'miss' | 'cooldown' | 'stunned';
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
  setFacing: () => undefined,
  strike: () => 'miss',
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    playerX: 0,
    playerY: 0,
    playerHealth: 0,
    foesAlive: 0,
    facingX: 1,
    facingY: 0,
    targetId: null,
    comboStep: 0,
    comboWindowLeftMs: 0,
    bestCombo: 0,
    stunned: false,
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
  const foeSprites: { id: string; sprite: { setPosition(x: number, y: number): unknown; setVisible(v: boolean): unknown; setAlpha(a: number): unknown; destroy(): void } }[] = [];
  const arc = hud ? scene.add.graphics().setDepth(3) : null;
  const reticle = hud ? scene.add.circle(0, 0, 24).setStrokeStyle(3, 0xffe14d, 0.95).setFillStyle(0, 0).setVisible(false).setDepth(5) : null;
  let nowMsLatest = 0;

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
    const facing = melee.facing();
    return {
      active: true,
      mode: melee.mode(),
      playerX: p.x,
      playerY: p.y,
      playerHealth: melee.playerHealth(),
      foesAlive: melee.foesAlive(),
      facingX: Math.round(facing.x * 100) / 100,
      facingY: Math.round(facing.y * 100) / 100,
      targetId: melee.target()?.id ?? null,
      comboStep: melee.comboStep(),
      comboWindowLeftMs: Math.round(melee.comboWindowLeftMs(nowMsLatest)),
      bestCombo: melee.bestCombo(),
      stunned: melee.playerStunned(nowMsLatest),
      lastResult: melee.lastResult(),
      outcome: melee.outcome(),
    };
  }

  function render(): void {
    const target = melee.target();
    for (const entry of foeSprites) {
      const live = melee.foes().find((foe) => foe.id === entry.id);
      entry.sprite.setVisible(live?.alive ?? false);
      if (live) {
        entry.sprite.setPosition(live.x, live.y);
        entry.sprite.setAlpha(nowMsLatest < live.stunnedUntilMs ? 0.55 : 1);
      }
    }
    if (arc) {
      const p = melee.player();
      const f = melee.facing();
      const half = (melee.arcDeg() / 2) * (Math.PI / 180);
      const base = Math.atan2(f.y, f.x);
      arc.clear();
      arc.fillStyle(target ? 0xffe14d : 0x4f9ee0, 0.14);
      arc.slice(p.x, p.y, 145, base - half, base + half, false);
      arc.fillPath();
    }
    if (reticle) {
      reticle.setVisible(target !== null);
      if (target) reticle.setPosition(target.x, target.y);
    }
    if (!title || !status || !hint) return;
    title.setText(melee.mode() === 'arena' ? 'ARENA' : 'SKIRMISH');
    const step = melee.comboStep();
    const chain = step > 0 ? `  ·  combo ${step} (${Math.ceil(melee.comboWindowLeftMs(nowMsLatest) / 100) / 10}s)` : '';
    status.setText(
      `hp ${melee.playerHealth()}  ·  foes ${melee.foesAlive()}${chain}${target ? `  ·  target ${target.id}` : ''}${
        melee.playerStunned(nowMsLatest) ? '  ·  STUNNED' : ''
      }${melee.outcome() !== 'playing' ? `  ·  ${melee.outcome().toUpperCase()}` : ''}`,
    );
    hint.setText('MOVE WASD/ARROWS   FACE A FOE   STRIKE J/X   CHAIN 3 HITS');
  }

  render();

  let disposed = false;
  const start = melee.player();
  return {
    active: true,
    setPlayer(x: number, y: number): void {
      melee.setPlayer(x, y);
    },
    setFacing(dx: number, dy: number): void {
      melee.setFacing(dx, dy);
    },
    strike(nowMs: number) {
      nowMsLatest = nowMs;
      const result = melee.strike(nowMs);
      render();
      return result;
    },
    tick(deltaMs: number, nowMs: number): void {
      nowMsLatest = nowMs;
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
        arc?.destroy();
        reticle?.destroy();
        for (const sprite of sprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
