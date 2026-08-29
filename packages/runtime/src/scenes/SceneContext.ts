import Phaser from 'phaser';
import type {
  DisposableBag,
  GameContext,
  InteractionService,
  SpatialPointerInput,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { bindRoleAnimations } from '../content/roleAnimations.ts';
import { InteractionServiceImpl } from '../game-support/interactionService.ts';

/**
 * GameContext plus the engine services a rendering pack needs.
 *
 * Engine specifics stop here: @sw2d/contracts stays Phaser-free so the CLI,
 * schema tooling and QA harness can consume it without a renderer, while packs
 * that actually draw still get a fully typed scene.
 *
 * `spatialPointer` and `interaction` are scene-scoped, not on the closed
 * `GameContext`, because world-space resolution needs a live camera - see
 * `docs/architecture/adr/0018-spatial-pointer-input-ownership.md`.
 */
export interface SceneContext extends GameContext {
  readonly scene: Phaser.Scene;
  /** Scene-lifetime teardown. Disposed on shutdown, before the next run starts. */
  readonly sceneDisposables: DisposableBag;
  /** World-space pointer state, advanced once per frame by the runtime host. */
  readonly spatialPointer: SpatialPointerInput;
  /** World-space interaction targeting, owned by this scene and disposed with it. */
  readonly interaction: InteractionService;
}

/** A system pack that runs inside a Phaser scene. */
export type ScenePackDefinition<TConfig = never> = SystemPackDefinition<TConfig, SceneContext>;

/**
 * Derive a scene context from the game context.
 *
 * Prototype-based so the base context's live getters (accessibility in
 * particular) keep reflecting current state rather than being snapshotted.
 * The semantic-role animation binder and the world-space interaction service
 * are scene-lifetime infrastructure: installed here before rendering packs add
 * their actors and disposed with the same scene bag, so every current and
 * future starter kit gets identical behaviour without kit-specific hooks.
 */
export function createSceneContext(
  base: GameContext,
  scene: Phaser.Scene,
  sceneDisposables: DisposableBag,
  spatialPointer: SpatialPointerInput,
): SceneContext {
  const context = Object.create(base) as SceneContext;
  const interaction = new InteractionServiceImpl(spatialPointer);
  const tickInteraction = (): void => interaction.update();
  scene.events.on(Phaser.Scenes.Events.UPDATE, tickInteraction);
  sceneDisposables.addFn(() => scene.events.off(Phaser.Scenes.Events.UPDATE, tickInteraction));
  sceneDisposables.add(interaction);

  Object.defineProperties(context, {
    scene: { value: scene, enumerable: true },
    sceneDisposables: { value: sceneDisposables, enumerable: true },
    spatialPointer: { value: spatialPointer, enumerable: true },
    interaction: { value: interaction, enumerable: true },
  });
  sceneDisposables.add(bindRoleAnimations(scene, base.assets, base.content.animations));
  return context;
}
