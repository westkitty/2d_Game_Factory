import Phaser from 'phaser';
import { DEFAULT_UI_COPY, SCENE_KEYS, type GameContext, type UiCopy } from '@sw2d/contracts';
import { RUNTIME_UI, headingStyle, mutedStyle } from './theme.ts';

/**
 * Pause overlay, launched above a paused PlayScene.
 *
 * Every option is a semantic action, so the same menu works from keyboard,
 * on-screen buttons and (later) a gamepad with no branching here.
 */
export class PauseScene extends Phaser.Scene {
  readonly #context: GameContext;

  constructor(context: GameContext) {
    super(SCENE_KEYS.pause);
    this.#context = context;
  }

  create(): void {
    const copy: UiCopy = { ...DEFAULT_UI_COPY, ...this.#context.content.ui };
    const { width, height } = this.scale.gameSize;

    this.add.rectangle(0, 0, width, height, 0x080a10, 0.82).setOrigin(0).setScrollFactor(0);
    this.add.text(width / 2, height * 0.36, copy.pausedHeading, headingStyle(34)).setOrigin(0.5);

    const rows = [copy.pausedResume, copy.pausedRestart, copy.pausedQuit];
    rows.forEach((row, index) => {
      this.add
        .text(width / 2, height * 0.5 + index * 26, row, mutedStyle(15))
        .setOrigin(0.5);
    });
  }

  override update(): void {
    const input = this.#context.input;
    const router = this.#context.router;

    if (input.consumePress('PAUSE') || input.consumePress('CONFIRM')) {
      this.#context.audio.playCue('game.resume');
      router.setPaused(false);
      return;
    }
    if (input.consumePress('SECONDARY_ACTION')) {
      this.#context.audio.playCue('game.restart');
      router.restartRun();
      return;
    }
    if (input.consumePress('CANCEL')) {
      this.#context.audio.playCue('ui.cancel');
      router.goToTitle();
    }
  }
}

/** Neutral background colour reused by the overlay. */
export const PAUSE_OVERLAY_COLOR = RUNTIME_UI.overlay;
