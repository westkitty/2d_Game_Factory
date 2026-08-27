import Phaser from 'phaser';
import { SCENE_KEYS, type GameContext } from '@sw2d/contracts';
import { createGeneratedTextures, queueImageAssets } from '../content/placeholderTextures.ts';
import { queueRoleAnimationFrames, registerRoleAnimations } from '../content/roleAnimations.ts';

/**
 * Realises the content bundle's assets and optional local-frame animations,
 * then hands off to the title.
 *
 * Everything here is local: generated textures are drawn in-process and image
 * assets come from the game's own public directory. There is nothing to fetch
 * from anywhere else, which is what makes the offline guarantee structural
 * rather than a promise.
 */
export class BootScene extends Phaser.Scene {
  readonly #context: GameContext;

  constructor(context: GameContext) {
    super(SCENE_KEYS.boot);
    this.#context = context;
  }

  preload(): void {
    queueImageAssets(this, this.#context.content.assets);
    queueRoleAnimationFrames(this, this.#context.content.animations);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`[sw2d] asset "${file.key}" failed to load from "${file.url}"`);
    });
  }

  create(): void {
    createGeneratedTextures(this, this.#context.content.assets);
    registerRoleAnimations(this, this.#context.content.animations);
    this.#context.events.emit('game:booted', { gameId: this.#context.gameId });
    this.#context.router.goToTitle();
  }
}
