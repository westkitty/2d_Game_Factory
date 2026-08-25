import Phaser from 'phaser';
import type { AssetDescriptor } from '@sw2d/contracts';

/**
 * Draws 'generated' asset specs into the texture cache at boot.
 *
 * Placeholder art is produced locally so foundation work is never blocked on
 * sourcing, licensing or hosting real assets - and so the production build has
 * nothing to fetch. Image-backed assets are handled by the loader instead.
 */
export function createGeneratedTextures(scene: Phaser.Scene, descriptors: readonly AssetDescriptor[]): void {
  for (const descriptor of descriptors) {
    if (descriptor.spec.kind !== 'generated') continue;
    if (scene.textures.exists(descriptor.key)) continue;

    const { width, height, fill, stroke, strokeWidth = 0, cornerRadius = 0 } = descriptor.spec;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, 1);
    if (cornerRadius > 0) graphics.fillRoundedRect(0, 0, width, height, cornerRadius);
    else graphics.fillRect(0, 0, width, height);

    if (stroke && strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, Phaser.Display.Color.HexStringToColor(stroke).color, 1);
      const inset = strokeWidth / 2;
      if (cornerRadius > 0) {
        graphics.strokeRoundedRect(inset, inset, width - strokeWidth, height - strokeWidth, cornerRadius);
      } else {
        graphics.strokeRect(inset, inset, width - strokeWidth, height - strokeWidth);
      }
    }

    graphics.generateTexture(descriptor.key, width, height);
    graphics.destroy();
  }
}

/** Image-backed assets queued onto a scene's loader. All URLs must be same-origin. */
export function queueImageAssets(scene: Phaser.Scene, descriptors: readonly AssetDescriptor[]): void {
  for (const descriptor of descriptors) {
    if (descriptor.spec.kind !== 'image') continue;
    if (scene.textures.exists(descriptor.key)) continue;
    scene.load.image(descriptor.key, descriptor.spec.url);
  }
}
