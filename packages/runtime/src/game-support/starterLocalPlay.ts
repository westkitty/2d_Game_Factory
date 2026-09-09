import { LOCAL_PLAY_CAPABILITY_ID, type LocalPlayService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated shell to `sw2d.local-play` (Category-C Wave 7).
 *
 * Inert unless the game installed the pack with at least two seats.
 * `{ hud: false }` lets expanded kits keep their own presentation.
 * Window key listeners feed versus axes without rewriting ActionInputHost
 * (WASD and arrows already share MOVE_*).
 */

export interface StarterLocalPlaySnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly currentPlayer: number;
  readonly scores: readonly number[];
  readonly turns: number;
  readonly winner: number | null;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly axis0: number;
  readonly axis1: number;
}

export interface StarterLocalPlayBinding {
  readonly active: boolean;
  pump(): void;
  act(): void;
  axis(playerIndex: number): number;
  snapshot(): StarterLocalPlaySnapshot;
  render(): void;
  mode(): string | null;
  dispose(): void;
}

const INERT: StarterLocalPlayBinding = {
  active: false,
  pump: () => undefined,
  act: () => undefined,
  axis: () => 0,
  snapshot: () => ({
    active: false,
    mode: null,
    currentPlayer: 0,
    scores: [],
    turns: 0,
    winner: null,
    lastResult: null,
    outcome: 'playing',
    axis0: 0,
    axis1: 0,
  }),
  render: () => undefined,
  mode: () => null,
  dispose: () => undefined,
};

export function bindStarterLocalPlay(context: SceneContext, options?: { readonly hud?: boolean }): StarterLocalPlayBinding {
  if (!context.capabilities.has(LOCAL_PLAY_CAPABILITY_ID)) return INERT;
  const seats = context.capabilities.require<LocalPlayService>(LOCAL_PLAY_CAPABILITY_ID);
  if (!seats.active()) return INERT;
  seats.reset();
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const held = new Set<string>();
  const onDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.repeat) return;
    held.add(keyboardEvent.code);
  };
  const onUp = (event: Event): void => {
    held.delete((event as KeyboardEvent).code);
  };
  const onBlur = (): void => {
    held.clear();
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  function snapshot(): StarterLocalPlaySnapshot {
    return {
      active: true,
      mode: seats.mode(),
      currentPlayer: seats.currentPlayer(),
      scores: seats.scores(),
      turns: seats.turns(),
      winner: seats.winner(),
      lastResult: seats.lastResult(),
      outcome: seats.outcome(),
      axis0: seats.axis(0),
      axis1: seats.axis(1),
    };
  }

  function render(): void {
    if (!title || !status || !hint) return;
    const snap = snapshot();
    if (seats.mode() === 'versus') {
      title.setText('VERSUS');
      status.setText(`P1 ${snap.axis0}  ·  P2 ${snap.axis1}`);
      hint.setText('P1 ARROWS   P2 WASD');
      return;
    }
    title.setText(`PLAYER ${snap.currentPlayer + 1}`);
    status.setText(
      `P1 ${snap.scores[0] ?? 0}  ·  P2 ${snap.scores[1] ?? 0}  ·  turn ${snap.turns}${snap.winner !== null ? `  ·  winner P${snap.winner + 1}` : ''}`,
    );
    hint.setText('J/ENTER ACTS   PASS THE KEYBOARD');
  }

  render();

  let disposed = false;
  return {
    active: true,
    pump(): void {
      seats.setHeld([...held]);
      render();
    },
    act(): void {
      seats.act();
      render();
    },
    axis(playerIndex: number): number {
      return seats.axis(playerIndex);
    },
    snapshot,
    render,
    mode: () => seats.mode(),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
