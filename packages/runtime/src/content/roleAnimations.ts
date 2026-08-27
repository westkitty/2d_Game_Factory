import Phaser from 'phaser';
import type { AssetCatalog, Disposable, RoleAnimationDescriptor } from '@sw2d/contracts';

/**
 * Queue every image used only as an animation frame.
 *
 * Role base textures continue to travel through AssetDescriptor. Animation
 * frames are separate local-image resources so one semantic role can have an
 * ordered sequence without pretending the AssetCatalog has several winners
 * for the same role.
 */
export function queueRoleAnimationFrames(
  scene: Phaser.Scene,
  animations: readonly RoleAnimationDescriptor[] | undefined,
): void {
  for (const animation of animations ?? []) {
    for (const frame of animation.frames) {
      if (scene.textures.exists(frame.key)) continue;
      scene.load.image(frame.key, frame.url);
    }
  }
}

/** Register presentation animations after Boot has loaded all local textures. */
export function registerRoleAnimations(
  scene: Phaser.Scene,
  animations: readonly RoleAnimationDescriptor[] | undefined,
): void {
  for (const animation of animations ?? []) {
    if (scene.anims.exists(animation.key)) continue;

    const missing = animation.frames.filter((frame) => !scene.textures.exists(frame.key));
    if (missing.length > 0) {
      console.error(
        `[sw2d] animation "${animation.key}" was not registered: ${missing.length} frame texture(s) failed to load.`,
      );
      continue;
    }

    scene.anims.create({
      key: animation.key,
      frames: animation.frames.map((frame) => ({ key: frame.key })),
      frameRate: animation.frameRate ?? 8,
      repeat: animation.repeat ?? -1,
      yoyo: animation.yoyo ?? false,
    });
  }
}

/**
 * Bind semantic-role animations to Phaser Sprites without teaching individual
 * starter kits about the workbench.
 *
 * Each role still resolves to one ordinary base texture. Any Sprite added to
 * the Play scene with that texture starts the role's declared animation. The
 * Scene ADDED_TO_SCENE event also covers actors created later during gameplay,
 * while non-Sprite objects and roles without animations remain untouched.
 */
export function bindRoleAnimations(
  scene: Phaser.Scene,
  assets: AssetCatalog,
  animations: readonly RoleAnimationDescriptor[] | undefined,
): Disposable {
  const animationByBaseTexture = new Map<string, string>();

  for (const animation of animations ?? []) {
    if (!assets.has(animation.role)) continue;
    const baseTexture = assets.resolve(animation.role);
    if (!animationByBaseTexture.has(baseTexture)) {
      animationByBaseTexture.set(baseTexture, animation.key);
    }
  }

  const maybePlay = (gameObject: Phaser.GameObjects.GameObject): void => {
    if (!(gameObject instanceof Phaser.GameObjects.Sprite)) return;
    const animationKey = animationByBaseTexture.get(gameObject.texture.key);
    if (!animationKey || !scene.anims.exists(animationKey)) return;
    if (gameObject.anims.currentAnim?.key === animationKey && gameObject.anims.isPlaying) return;
    gameObject.play(animationKey);
  };

  if (animationByBaseTexture.size === 0) return { dispose() {} };

  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, maybePlay);
  // createSceneContext is normally established before packs add their actors,
  // but applying to current children makes the helper correct for any caller
  // that creates a Sprite immediately before deriving its scene context.
  for (const gameObject of scene.children.list) maybePlay(gameObject);

  return {
    dispose(): void {
      scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, maybePlay);
    },
  };
}
