/**
 * Phaser 4.2.1 ships typings that omit several documented SceneManager runtime
 * methods (they exist in src/scene/SceneManager.js and are part of the public
 * API). Declared here rather than casting at every call site so scene routing
 * stays fully type-checked.
 *
 * Re-verify on each Phaser upgrade: if upstream adds these, delete this file.
 */
declare namespace Phaser.Scenes {
  interface SceneManager {
    getScene<T extends Phaser.Scene = Phaser.Scene>(key: string): T | null;
    isActive(key: string): boolean;
    isPaused(key: string): boolean;
    isSleeping(key: string): boolean;
    isVisible(key: string): boolean;
    start(key: string, data?: object): Phaser.Scenes.SceneManager;
    stop(key: string, data?: object): Phaser.Scenes.SceneManager;
    run(key: string, data?: object): Phaser.Scenes.SceneManager;
    pause(key: string, data?: object): Phaser.Scenes.SceneManager;
    resume(key: string, data?: object): Phaser.Scenes.SceneManager;
    sleep(key: string, data?: object): Phaser.Scenes.SceneManager;
    wake(key: string, data?: object): Phaser.Scenes.SceneManager;
    bringToTop(key: string): Phaser.Scenes.SceneManager;
  }
}
