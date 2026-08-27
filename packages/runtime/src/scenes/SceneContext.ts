import type Phaser from 'phaser';
import type { DisposableBag, GameContext, SystemPackDefinition } from '@sw2d/contracts';
import { bindRoleAnimations } from '../content/roleAnimations.ts';

/**
 * GameContext plus the engine services a rendering pack needs.
 *
 * Engine specifics stop here: @sw2d/contracts stays Phaser-free so the CLI,
 * schema tooling and QA harness can consume it without a renderer, while packs
 * that actually draw still get a fully typed scene.
 */
export interface SceneContext extends GameContext {
  readonly scene: Phaser.Scene;
  /** Scene-lifetime teardown. Disposed on shutdown, before the next run starts. */
  readonly sceneDisposables: DisposableBag;
}

/** A system pack that runs inside a Phaser scene. */
export type ScenePackDefinition<TConfig = never> = SystemPackDefinition<TConfig, SceneContext>;

/**
 * Derive a scene context from the game context.
 *
 * Prototype-based so the base context's live getters (accessibility in
 * particular) keep reflecting current state rather than being snapshotted.
 * The semantic-role animation binder is scene-lifetime infrastructure: it is
 * installed here before rendering packs add their actors and disposed with the
 * same scene bag, so every current and future starter kit gets identical
 * animation behaviour without kit-specific hooks.
 */
export function createSceneContext(
  base: GameContext,
  scene: Phaser.Scene,
  sceneDisposables: DisposableBag,
): SceneContext {
  const context = Object.create(base) as SceneContext;
  Object.defineProperties(context, {
    scene: { value: scene, enumerable: true },
    sceneDisposables: { value: sceneDisposables, enumerable: true },
  });
  sceneDisposables.add(bindRoleAnimations(scene, base.assets, base.content.animations));
  return context;
}
