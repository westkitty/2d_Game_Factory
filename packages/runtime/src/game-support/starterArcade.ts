import type { CookingCatalog, FishingCatalog, MicrogameCatalog } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.arcade` (Category-C Wave 15).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a fishing, cooking, or micro starter. The pack stays score / combo /
 * lives / elapsed — this file is presentation, not a casting/tension, recipe,
 * or scheduler framework. Overlay fishing/cooking/microgame kits stay local.
 */

const ARCADE_CAPABILITY_ID = 'arcade.score';

export type ArcadeStarterMode = 'fishing' | 'cooking' | 'micro';

export type FishingPhase = 'idle' | 'cast' | 'bite' | 'hook' | 'tension' | 'reel' | 'landed' | 'failed';

export interface StarterArcadeSnapshot {
  readonly active: boolean;
  readonly mode: ArcadeStarterMode | null;
  readonly score: number;
  readonly elapsedMs: number;
  readonly phase: FishingPhase | 'cook' | 'countdown' | 'go' | 'play' | 'transition';
  readonly caught: number;
  readonly missed: number;
  readonly selectedIndex: number;
  readonly recipeStep: number;
  readonly mistakes: number;
  readonly round: number;
  readonly mash: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
  readonly roundId: string | null;
  readonly roundKind: string | null;
  readonly roundsCompleted: number;
  readonly failures: number;
  readonly tension: number;
  readonly reel: number;
  readonly fishId: string | null;
  readonly inventory: readonly string[];
  readonly dish: string | null;
  readonly action: string | null;
}

export interface StarterArcadeBinding {
  readonly active: boolean;
  select(delta: number): void;
  confirm(): void;
  secondary(): void;
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
    round: 0,
    mash: 0,
    lastResult: null,
    outcome: 'playing',
    roundId: null,
    roundKind: null,
    roundsCompleted: 0,
    failures: 0,
    tension: 0,
    reel: 0,
    fishId: null,
    inventory: [],
    dish: null,
    action: null,
  }),
  secondary: () => undefined,
  render: () => undefined,
  dispose: () => undefined,
};

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
  elapsedMs(): number;
}

const LAND_MS = 200;
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
  if (mode !== 'fishing' && mode !== 'cooking' && mode !== 'micro') return INERT;
  if (!context.capabilities.has(ARCADE_CAPABILITY_ID)) return INERT;
  const arcade = context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID);
  const fishing = context.content?.data?.['fishing']?.value as FishingCatalog | undefined;
  const cooking = context.content?.data?.['cooking']?.value as CookingCatalog | undefined;
  const microgames = context.content?.data?.['microgames']?.value as MicrogameCatalog | undefined;
  const ingredients = cooking?.ingredients ?? [];
  const recipe = cooking?.recipes[0];
  const rounds = microgames?.rounds ?? [];

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
    if (mode === 'fishing' || mode === 'micro') {
      slots.push(scene.add.rectangle(width * 0.5, height * 0.52, 420, 160, WATER_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20));
      labels.push(scene.add.text(width * 0.5, height * 0.52, '', mutedStyle(18)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
    } else {
      for (let i = 0; i < ingredients.length; i++) {
        const x = width * 0.5 + (i - 1) * 220;
        slots.push(scene.add.rectangle(x, height * 0.5, 160, 120, EMPTY_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20));
        labels.push(scene.add.text(x, height * 0.5, ingredients[i]!.label, mutedStyle(16)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
      }
    }
  }

  let phase: FishingPhase = 'idle';
  let microPhase: 'countdown' | 'go' | 'play' | 'transition' = 'countdown';
  let phaseAt = arcade.elapsedMs();
  let caught = 0;
  let missed = 0;
  let selectedIndex = 0;
  let recipeStep = 0;
  let mistakes = 0;
  let mash = 0;
  let roundIndex = 0;
  let roundsCompleted = 0;
  let failures = 0;
  let alternateNext: 'primary' | 'secondary' = 'primary';
  let tension = 50;
  let reel = 0;
  let fishId: string | null = null;
  const inventory: string[] = [];
  let dish: string | null = null;
  let stepStartedAt = arcade.elapsedMs();
  let lastPollAt = arcade.elapsedMs();
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterArcadeSnapshot {
    const round = rounds[roundIndex];
    const action = recipe?.actions[recipeStep];
    return {
      active: true,
      mode,
      score: arcade.score(),
      elapsedMs: Math.round(arcade.elapsedMs()),
      phase: mode === 'fishing' ? phase : mode === 'micro' ? microPhase : 'cook',
      caught,
      missed,
      selectedIndex,
      recipeStep,
      mistakes,
      round: mode === 'micro' ? Math.min(roundIndex + 1, rounds.length) : 0,
      mash,
      lastResult,
      outcome,
      roundId: mode === 'micro' ? round?.id ?? null : null,
      roundKind: mode === 'micro' ? round?.kind ?? null : null,
      roundsCompleted,
      failures,
      tension: Math.round(tension),
      reel,
      fishId,
      inventory,
      dish,
      action: mode === 'cooking' ? action?.action ?? null : null,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'fishing') {
      const color = phase === 'bite' || phase === 'hook' ? BITE_COLOR : phase === 'landed' ? LAND_COLOR : phase === 'cast' || phase === 'reel' ? BOBBER_COLOR : WATER_COLOR;
      slots[0]?.setFillStyle(color, 0.95);
      labels[0]?.setText(phase === 'bite' ? 'BITE' : phase === 'hook' ? 'HOOK' : phase === 'tension' ? `TENSION ${snap.tension}` : phase === 'reel' ? `REEL ${snap.reel}/${fishing?.reelTarget ?? 1}` : phase === 'landed' ? 'LANDED' : phase === 'failed' ? 'LINE LOST' : phase === 'cast' ? 'WAITING' : 'CAST');
    } else if (mode === 'micro') {
      const color = microPhase === 'go' ? BITE_COLOR : microPhase === 'play' ? BOBBER_COLOR : snap.outcome === 'complete' ? LAND_COLOR : WATER_COLOR;
      slots[0]?.setFillStyle(color, 0.95);
      labels[0]?.setText(snap.outcome === 'complete' ? 'SET CLEAR' : microPhase === 'go' ? 'GO' : microPhase === 'play' ? `${snap.roundKind?.toUpperCase()} ${mash}/${rounds[roundIndex]?.target ?? 0}` : microPhase === 'transition' ? 'CLEAR' : 'READY');
    } else {
      for (let i = 0; i < slots.length; i++) {
        const selected = i === selectedIndex;
        const done = i < recipeStep;
        slots[i]?.setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : 0x8a93a6, 0.95);
        slots[i]?.setFillStyle(done ? LAND_COLOR : selected ? BITE_COLOR : EMPTY_COLOR, 0.95);
        labels[i]?.setText(ingredients[i]?.label ?? '');
      }
    }
    if (!title || !status || !hint) return;
    if (mode === 'fishing') {
      title.setText(snap.outcome === 'complete' ? 'CAUGHT' : 'FISH');
      status.setText(
        `caught ${snap.caught}/${fishing?.catchTarget ?? 0}  ·  inventory ${snap.inventory.length}  ·  score ${snap.score}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ENTER CASTS, HOOKS, SETS TENSION, AND REELS');
    } else if (mode === 'micro') {
      title.setText(snap.outcome === 'complete' ? 'SET CLEAR' : 'MICRO');
      status.setText(
        `round ${snap.round}/${rounds.length} ${snap.roundKind ?? ''}  ·  clears ${snap.roundsCompleted}  ·  score ${snap.score}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText(snap.outcome === 'playing' ? (snap.roundKind === 'alternate' ? 'ALTERNATE ENTER AND K' : snap.roundKind === 'hold' ? 'HOLD J' : 'ENTER ON GO') : 'SET CLEAR');
    } else {
      title.setText(snap.outcome === 'complete' ? 'DISH READY' : 'KITCHEN');
      status.setText(
        `step ${snap.recipeStep}/${recipe?.actions.length ?? 0} ${snap.action ?? ''}  ·  score ${snap.score}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ARROWS PICK   ENTER PERFORMS THE ORDERED ACTION');
    }
  }

  function confirmFishing(): void {
    const now = arcade.elapsedMs();
    const config = fishing;
    if (!config || config.fish.length === 0) return;
    if (phase === 'idle') {
      phase = 'cast';
      phaseAt = now;
      fishId = config.fish[caught % config.fish.length]!.id;
      tension = 50;
      reel = 0;
      lastResult = 'cast';
      return;
    }
    if (phase === 'cast') {
      lastResult = 'waiting';
      return;
    }
    if (phase === 'bite') {
      if (now - phaseAt <= config.biteMs) {
        phase = 'hook';
        phaseAt = now;
        lastResult = 'hooked';
        return;
      }
      failFish('missed');
      return;
    }
    if (phase === 'hook') {
      phase = 'tension';
      phaseAt = now;
      lastResult = 'tension-set';
      return;
    }
    if (phase === 'tension') {
      if (tension < config.tensionMin || tension > config.tensionMax) return failFish('line-broke');
      phase = 'reel';
      reel = 1;
      phaseAt = now;
      lastResult = 'reeling';
      return;
    }
    if (phase === 'reel') {
      tension += 8;
      if (tension > config.tensionMax) return failFish('line-broke');
      reel += 1;
      lastResult = 'reeling';
      if (reel >= config.reelTarget) landFish();
      return;
    }
    lastResult = 'landed';
  }

  function failFish(reason: string): void {
    phase = 'failed';
    phaseAt = arcade.elapsedMs();
    missed += 1;
    failures += 1;
    lastResult = reason;
  }

  function landFish(): void {
    const caughtFish = fishing?.fish.find((entry) => entry.id === fishId);
    phase = 'landed';
    phaseAt = arcade.elapsedMs();
    caught += 1;
    if (fishId) inventory.push(fishId);
    arcade.addScore(caughtFish?.score ?? 0);
    lastResult = 'landed';
    if (caught >= (fishing?.catchTarget ?? 1)) outcome = 'complete';
  }

  function confirmCooking(): void {
    const expected = recipe?.actions[recipeStep];
    if (!expected) {
      lastResult = 'ready';
      return;
    }
    const now = arcade.elapsedMs();
    if (now - stepStartedAt > expected.maxDelayMs) {
      failures += 1;
      mistakes += 1;
      recipeStep = 0;
      stepStartedAt = now;
      lastResult = 'too-slow';
      return;
    }
    if (ingredients[selectedIndex]?.id !== expected.ingredientId) {
      mistakes += 1;
      failures += 1;
      lastResult = 'wrong';
      return;
    }
    recipeStep += 1;
    stepStartedAt = now;
    lastResult = 'added';
    if (recipeStep >= (recipe?.actions.length ?? 0)) {
      arcade.addScore(Math.max(0, (recipe?.score ?? 0) - 20 * mistakes));
      dish = recipe?.dish ?? null;
      outcome = 'complete';
      lastResult = 'ready';
    }
  }

  function confirmMicro(button: 'primary' | 'secondary' = 'primary'): void {
    const now = arcade.elapsedMs();
    const round = rounds[roundIndex];
    if (!round) return;
    if (microPhase === 'countdown') {
      failures += 1;
      lastResult = 'early';
      phaseAt = now;
      return;
    }
    if (microPhase === 'go') {
      if (round.kind === 'react') return completeRound();
      microPhase = 'play';
      mash = 0;
      lastResult = 'started';
    }
    if (round.kind === 'hold') return;
    if (round.kind === 'alternate') {
      if (button !== alternateNext) {
        failures += 1;
        lastResult = 'wrong-button';
        return;
      }
      alternateNext = alternateNext === 'primary' ? 'secondary' : 'primary';
    }
    mash += 1;
    lastResult = round.kind;
    if (mash >= round.target) completeRound();
  }

  function completeRound(): void {
    const round = rounds[roundIndex];
    if (!round) return;
    arcade.addScore(round.score);
    roundsCompleted += 1;
    lastResult = 'round-clear';
    if (roundsCompleted >= rounds.length) {
      outcome = 'complete';
      lastResult = 'set';
      return;
    }
    microPhase = 'transition';
    phaseAt = arcade.elapsedMs();
  }

  function poll(): void {
    if (outcome !== 'playing') return;
    const now = arcade.elapsedMs();
    const delta = Math.max(0, now - lastPollAt);
    lastPollAt = now;
    if (mode === 'micro') {
      const round = rounds[roundIndex];
      if (!round) return;
      if (microPhase === 'countdown' && now - phaseAt >= round.countdownMs) {
        microPhase = 'go';
        phaseAt = now;
        lastResult = 'go';
      } else if ((microPhase === 'go' || microPhase === 'play') && now - phaseAt > round.durationMs) {
        failures += 1;
        lastResult = 'round-failed';
        microPhase = 'countdown';
        phaseAt = now;
        mash = 0;
      } else if (microPhase === 'play' && round.kind === 'hold' && context.input.isDown('PRIMARY_ACTION')) {
        mash += delta;
        if (mash >= round.target) completeRound();
      } else if (microPhase === 'transition' && now - phaseAt >= 180) {
        roundIndex = (roundIndex + 1) % rounds.length;
        microPhase = 'countdown';
        phaseAt = now;
        mash = 0;
        alternateNext = 'primary';
      }
      return;
    }
    if (mode !== 'fishing') return;
    if (phase === 'cast' && now - phaseAt >= (fishing?.castMs ?? 1)) {
      phase = 'bite';
      phaseAt = now;
      lastResult = 'bite';
      return;
    }
    if (phase === 'bite' && now - phaseAt > (fishing?.biteMs ?? 1)) {
      failFish('missed');
      return;
    }
    if ((phase === 'hook' || phase === 'tension' || phase === 'reel') && now - phaseAt > (fishing?.hookMs ?? 1) * 3) return failFish('line-broke');
    if (phase === 'reel') {
      const pull = fishing?.fish.find((entry) => entry.id === fishId)?.pull ?? 0;
      tension -= pull * (delta / 1000);
      if (tension < (fishing?.tensionMin ?? 0)) return failFish('slack-line');
    }
    if (phase === 'landed' && outcome === 'playing' && now - phaseAt >= LAND_MS) {
      phase = 'idle';
    }
    if (phase === 'failed' && now - phaseAt >= LAND_MS) phase = 'idle';
  }

  paint();

  return {
    active: true,
    select(delta: number): void {
      if (disposed || mode !== 'cooking' || outcome !== 'playing') return;
      selectedIndex = wrap(selectedIndex + delta, ingredients.length);
      paint();
    },
    secondary(): void {
      if (disposed || mode !== 'micro' || outcome !== 'playing') return;
      confirmMicro('secondary');
      paint();
    },
    confirm(): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'fishing') confirmFishing();
      else if (mode === 'micro') confirmMicro();
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
