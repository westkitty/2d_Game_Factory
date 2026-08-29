import Phaser from 'phaser';
import { DEFAULT_UI_COPY, SCENE_KEYS, type GameContext, type UiCopy } from '@sw2d/contracts';
import { DisposableBagImpl } from '../core/DisposableBagImpl.ts';
import { startPromptFor } from '../input/keyLabels.ts';
import { RUNTIME_UI, accentStyle, headingStyle, mutedStyle } from './theme.ts';

/** Title state. Wording comes from content; the runtime supplies only the state. */
export class TitleScene extends Phaser.Scene {
  readonly #context: GameContext;
  #bag = new DisposableBagImpl('title-scene');

  constructor(context: GameContext) {
    super(SCENE_KEYS.title);
    this.#context = context;
  }

  create(): void {
    this.#bag = new DisposableBagImpl('title-scene');
    const copy: UiCopy = { ...DEFAULT_UI_COPY, ...this.#context.content.ui };
    const { width, height } = this.scale.gameSize;

    this.cameras.main.setBackgroundColor(RUNTIME_UI.background);
    this.add.text(width / 2, height * 0.34, copy.title, headingStyle(44)).setOrigin(0.5);
    this.add.text(width / 2, height * 0.44, copy.subtitle, mutedStyle(16)).setOrigin(0.5);

    // A player is never asked to "press CONFIRM": the hint is the game's own
    // physical CONFIRM keys, so it stays honest if a game rebinds them. The
    // visible on-screen Start control (DOM) covers the pointer/tap path.
    const startText = startPromptFor(
      this.#context.input.bindings.CONFIRM?.keyboard,
      this.#context.content.ui?.startPrompt,
      DEFAULT_UI_COPY.startPrompt,
    );
    const prompt = this.add
      .text(width / 2, height * 0.64, startText, accentStyle(18))
      .setOrigin(0.5);

    // Reduced motion is honoured even by the title prompt: no pulsing when asked
    // not to animate.
    if (!this.#context.accessibility.reducedMotion) {
      const tween = this.tweens.add({
        targets: prompt,
        alpha: { from: 1, to: 0.35 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
      this.#bag.addFn(() => tween.remove());
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#bag.dispose());
  }

  override update(): void {
    if (this.#context.input.consumePress('CONFIRM')) {
      this.#context.audio.playCue('game.start');
      this.#context.router.startRun();
    }
  }
}
