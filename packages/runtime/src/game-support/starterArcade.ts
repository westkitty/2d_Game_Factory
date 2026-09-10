import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.arcade` (Category-C Wave 15).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a fishing or cooking starter. The pack stays score / combo / lives /
 * elapsed — this file is presentation, not a casting/tension or recipe
 * framework. Overlay fishing/cooking kits stay local (P3-H).
 */

const ARCADE_CAPABILITY_ID = 'arcade.score';

export type ArcadeStarterMode = 'fishing' | 'cooking';

export type FishingPhase = 'idle' | 'cast' | 'bite' | 'landed';

export interface StarterArcadeSnapshot {
  readonly active: boolean;
  readonly mode: ArcadeStarterMode | null;
  readonly score: number;
  readonly elapsedMs: number;
  readonly phase: FishingPhase | 'cook';
  readonly caught: number;
  readonly missed: number;
  readonly selectedIndex: number;
  readonly recipeStep: number;
  readonly mistakes: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterArcadeBinding {
  readonly active: boolean;
  select(delta: number): void;
  confirm(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterArcadeSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterArcadeBinding = {
  active: false,
  select: () => undefined,
  confirm: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    score: 0,
    elapsedMs: 0,
    phase: 'idle',
    caught: 0,
    missed: 0,
    selectedIndex: 0,
    recipeStep: 0,
    mistakes: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
  elapsedMs(): number;
}

const CAST_MS = 480;
const BITE_MS = 700;
const LAND_MS = 200;
const CATCH_TARGET = 2;
const FISH_SCORE = 50;
const DISH_SCORE = 100;
const RECIPE = [0, 1, 2] as const;
const INGREDIENTS = ['FLOUR', 'EGG', 'MIX'] as const;
const WATER_COLOR = 0x173a5c;
const BOBBER_COLOR = 0xe0574f;
const BITE_COLOR = 0xf0c274;
const LAND_COLOR = 0x65d0a8;
const EMPTY_COLOR = 0x384054;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function bindStarterArcade(
  context: SceneContext,
  options?: { readonly mode?: ArcadeStarterMode | null; readonly hud?: boolean },
): StarterArcadeBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'fishing' && mode !== 'cooking') return INERT;
  if (!context.capabilities.has(ARCADE_CAPABILITY_ID)) return INERT;
  const arcade = context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID);

  const existing = arcade.score();
  if (existing !== 0) arcade.addScore(-existing);

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const slots: { setFillStyle(color: number, alpha?: number): unknown; setStrokeStyle(width: number, color: number, alpha?: number): unknown; destroy(): void }[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  if (hud) {
    if (mode === 'fishing') {
      slots.push(scene.add.rectangle(width * 0.5, height * 0.52, 420, 160, WATER_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20));
      labels.push(scene.add.text(width * 0.5, height * 0.52, '', mutedStyle(18)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
    } else {
      for (let i = 0; i < INGREDIENTS.length; i++) {
        const x = width * 0.5 + (i - 1) * 220;
        slots.push(scene.add.rectangle(x, height * 0.5, 160, 120, EMPTY_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20));
        labels.push(scene.add.text(x, height * 0.5, INGREDIENTS[i]!, mutedStyle(16)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
      }
    }
  }

  let phase: FishingPhase = 'idle';
  let phaseAt = arcade.elapsedMs();
  let caught = 0;
  let missed = 0;
  let selectedIndex = 0;
  let recipeStep = 0;
  let mistakes = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterArcadeSnapshot {
    return {
      active: true,
      mode,
      score: arcade.score(),
      elapsedMs: Math.round(arcade.elapsedMs()),
      phase: mode === 'fishing' ? phase : 'cook',
      caught,
      missed,
      selectedIndex,
      recipeStep,
      mistakes,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'fishing') {
      const color = phase === 'bite' ? BITE_COLOR : phase === 'landed' ? LAND_COLOR : phase === 'cast' ? BOBBER_COLOR : WATER_COLOR;
      slots[0]?.setFillStyle(color, 0.95);
      labels[0]?.setText(phase === 'bite' ? 'BITE' : phase === 'landed' ? 'LANDED' : phase === 'cast' ? 'WAITING' : 'CAST');
    } else {
      for (let i = 0; i < slots.length; i++) {
        const selected = i === selectedIndex;
        const done = i < recipeStep;
        slots[i]?.setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : 0x8a93a6, 0.95);
        slots[i]?.setFillStyle(done ? LAND_COLOR : selected ? BITE_COLOR : EMPTY_COLOR, 0.95);
        labels[i]?.setText(INGREDIENTS[i]!);
      }
    }
    if (!title || !status || !hint) return;
    if (mode === 'fishing') {
      title.setText(snap.outcome === 'complete' ? 'CAUGHT' : 'FISH');
      status.setText(
        `caught ${snap.caught}/${CATCH_TARGET}  ·  score ${snap.score}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ENTER CASTS AND LANDS');
    } else {
      title.setText(snap.outcome === 'complete' ? 'DISH READY' : 'KITCHEN');
      status.setText(
        `step ${snap.recipeStep}/${RECIPE.length}  ·  score ${snap.score}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ARROWS PICK   ENTER ADDS TO THE DISH');
    }
  }

  function confirmFishing(): void {
    const now = arcade.elapsedMs();
    if (phase === 'idle') {
      phase = 'cast';
      phaseAt = now;
      lastResult = 'cast';
      return;
    }
    if (phase === 'cast') {
      lastResult = 'waiting';
      return;
    }
    if (phase === 'bite') {
      if (now - phaseAt <= BITE_MS) {
        phase = 'landed';
        phaseAt = now;
        caught += 1;
        arcade.addScore(FISH_SCORE);
        lastResult = 'landed';
        if (caught >= CATCH_TARGET) outcome = 'complete';
        return;
      }
      phase = 'idle';
      missed += 1;
      lastResult = 'missed';
      return;
    }
    lastResult = 'landed';
  }

  function confirmCooking(): void {
    const expected = RECIPE[recipeStep];
    if (expected === undefined) {
      lastResult = 'ready';
      return;
    }
    if (selectedIndex !== expected) {
      mistakes += 1;
      lastResult = 'wrong';
      return;
    }
    recipeStep += 1;
    lastResult = 'added';
    if (recipeStep >= RECIPE.length) {
      arcade.addScore(Math.max(0, DISH_SCORE - 20 * mistakes));
      outcome = 'complete';
      lastResult = 'ready';
    }
  }

  function poll(): void {
    if (mode !== 'fishing' || outcome !== 'playing') return;
    const now = arcade.elapsedMs();
    if (phase === 'cast' && now - phaseAt >= CAST_MS) {
      phase = 'bite';
      phaseAt = now;
      lastResult = 'bite';
      return;
    }
    if (phase === 'bite' && now - phaseAt > BITE_MS) {
      phase = 'idle';
      missed += 1;
      lastResult = 'missed';
      return;
    }
    if (phase === 'landed' && outcome === 'playing' && now - phaseAt >= LAND_MS) {
      phase = 'idle';
    }
  }

  paint();

  return {
    active: true,
    select(delta: number): void {
      if (disposed || mode !== 'cooking' || outcome !== 'playing') return;
      selectedIndex = wrap(selectedIndex + delta, INGREDIENTS.length);
      paint();
    },
    confirm(): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'fishing') confirmFishing();
      else confirmCooking();
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(_deltaMs: number): void {
      if (disposed) return;
      poll();
      paint();
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
        for (const slot of slots) slot.destroy();
        for (const label of labels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
