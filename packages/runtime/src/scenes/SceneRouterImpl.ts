import type Phaser from 'phaser';
import { SCENE_KEYS, type EventBus, type SceneKey, type SceneRouter } from '@sw2d/contracts';

/**
 * Scenes the router owns exclusively. Boot is included so it stops once it has
 * handed off; a boot scene left running is a scene nobody is accounting for.
 */
const ALL_KEYS: readonly SceneKey[] = [
  SCENE_KEYS.boot,
  SCENE_KEYS.title,
  SCENE_KEYS.play,
  SCENE_KEYS.pause,
];

/**
 * The only supported way to change scene, pause or restart.
 *
 * Centralising this is what makes teardown ordering knowable: nothing else calls
 * the Phaser scene manager, so "what happens on restart" has exactly one answer.
 */
export class SceneRouterImpl implements SceneRouter {
  #game: Phaser.Game | null = null;
  #current: SceneKey | null = null;
  #runIndex = 0;
  #paused = false;
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  attach(game: Phaser.Game): void {
    this.#game = game;
  }

  get current(): SceneKey | null {
    return this.#current;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get runIndex(): number {
    return this.#runIndex;
  }

  goToTitle(): void {
    this.#clearPause();
    this.#switchTo(SCENE_KEYS.title);
  }

  startRun(): void {
    this.#clearPause();
    this.#runIndex += 1;
    this.#switchTo(SCENE_KEYS.play);
    this.#events.emit('run:started', { runIndex: this.#runIndex });
  }

  restartRun(): void {
    this.#clearPause();
    this.#runIndex += 1;
    // Stop first, then start: a full stop runs the scene shutdown handler, which
    // is where system packs, adapters and listeners are released.
    this.#manager().stop(SCENE_KEYS.play);
    this.#switchTo(SCENE_KEYS.play);
    this.#events.emit('run:restarted', { runIndex: this.#runIndex });
  }

  setPaused(paused: boolean): void {
    if (paused === this.#paused) return;
    if (this.#current !== SCENE_KEYS.play) return;
    const manager = this.#manager();
    this.#paused = paused;
    if (paused) {
      manager.pause(SCENE_KEYS.play);
      manager.run(SCENE_KEYS.pause);
    } else {
      manager.stop(SCENE_KEYS.pause);
      manager.resume(SCENE_KEYS.play);
    }
    this.#events.emit('pause:changed', { paused });
  }

  togglePaused(): void {
    this.setPaused(!this.#paused);
  }

  #clearPause(): void {
    if (!this.#paused) return;
    this.#paused = false;
    this.#manager().stop(SCENE_KEYS.pause);
    this.#events.emit('pause:changed', { paused: false });
  }

  #manager(): Phaser.Scenes.SceneManager {
    if (!this.#game) throw new Error('[sw2d] SceneRouter used before the game was created');
    return this.#game.scene;
  }

  #switchTo(key: SceneKey): void {
    const manager = this.#manager();
    for (const other of ALL_KEYS) {
      if (other === key) continue;
      if (manager.isActive(other) || manager.isPaused(other) || manager.isSleeping(other)) {
        manager.stop(other);
      }
    }
    const from = this.#current;
    this.#current = key;
    manager.start(key);
    this.#events.emit('scene:changed', { from, to: key });
  }
}
