/**
 * Scene lifecycle contract.
 *
 * Scene keys are namespaced so a game-specific scene can never collide with a
 * runtime scene.
 */
export const SCENE_KEYS = {
  boot: 'sw2d.boot',
  title: 'sw2d.title',
  play: 'sw2d.play',
  pause: 'sw2d.pause',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

/**
 * The only supported way to change scene, pause, or restart a run.
 *
 * Systems must not drive the scene manager directly: routing through the router
 * is what guarantees teardown ordering and correct run bookkeeping.
 */
export interface SceneRouter {
  readonly current: SceneKey | null;
  readonly paused: boolean;
  /** Increments on every run start, including restarts. Used by QA and debug. */
  readonly runIndex: number;
  goToTitle(): void;
  startRun(): void;
  /** Tears the play scene down completely and starts a fresh run. */
  restartRun(): void;
  setPaused(paused: boolean): void;
  togglePaused(): void;
}
