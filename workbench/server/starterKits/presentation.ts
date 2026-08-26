/**
 * The shared "procedural life" module every starter kit overlays into a
 * generated game's `src/game-specific/`.
 *
 * A single still image should not make a game feel dead (section 21), but the
 * answer to that is not a universal animation engine. This is a small,
 * bounded set of presentation effects that work on one static texture: facing
 * flip, idle bob, velocity lean, jump squash, landing squash, hit flash, a
 * ground shadow and a pickup bounce. Source pixels are never modified - every
 * effect is a transform on the sprite, applied at draw time.
 *
 * It is emitted as game-side source rather than added to the runtime because
 * it is presentation policy, which `README.md`'s one rule puts squarely in
 * `src/game-specific/`.
 */
export const PRESENTATION_MODULE = `import Phaser from 'phaser';

/**
 * Bounded presentation effects for static art.
 *
 * Every method here transforms a sprite; none of them touches the texture, so
 * the imported pixels the workbench assigned to this role are exactly what is
 * drawn. Tunables are plain constants - change them freely, this file is
 * normal game work.
 */

const IDLE_BOB_AMPLITUDE = 1.6;
const IDLE_BOB_PERIOD_MS = 1400;
const LEAN_DEGREES_PER_SPEED = 0.012;
const MAX_LEAN_DEGREES = 7;
const SQUASH_RECOVER_MS = 160;
const FLASH_MS = 140;

export interface ActorPresentationOptions {
  readonly idleBob?: boolean;
  readonly lean?: boolean;
  readonly squash?: boolean;
  readonly shadow?: boolean;
}

/**
 * Wraps one sprite with the small motion vocabulary above.
 *
 * The base scale is captured once at construction, so every squash and
 * recovery is relative to whatever display size the game gave the sprite -
 * a 512px imported PNG and a 28px generated placeholder both behave.
 */
export class ActorPresentation {
  readonly #sprite: Phaser.Physics.Arcade.Sprite;
  readonly #options: Required<ActorPresentationOptions>;
  readonly #baseScaleX: number;
  readonly #baseScaleY: number;
  readonly #shadow: Phaser.GameObjects.Ellipse | null;

  #elapsedMs = 0;
  #squashRemainingMs = 0;
  #squashAmount = 0;
  #flashRemainingMs = 0;
  #wasOnGround = true;

  constructor(sprite: Phaser.Physics.Arcade.Sprite, options: ActorPresentationOptions = {}) {
    this.#sprite = sprite;
    this.#options = {
      idleBob: options.idleBob ?? true,
      lean: options.lean ?? true,
      squash: options.squash ?? true,
      shadow: options.shadow ?? true,
    };
    this.#baseScaleX = sprite.scaleX;
    this.#baseScaleY = sprite.scaleY;
    this.#shadow = this.#options.shadow
      ? sprite.scene.add.ellipse(sprite.x, sprite.y, sprite.displayWidth * 0.7, 6, 0x000000, 0.28).setDepth(sprite.depth - 1)
      : null;
  }

  /** Call once per frame, after the body's velocity has been set. */
  update(deltaMs: number, onGround: boolean): void {
    this.#elapsedMs += deltaMs;
    const body = this.#sprite.body as Phaser.Physics.Arcade.Body | null;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;

    if (vx !== 0) this.#sprite.setFlipX(vx < 0);

    if (onGround && !this.#wasOnGround) this.squash(0.22);
    this.#wasOnGround = onGround;

    let scaleX = this.#baseScaleX;
    let scaleY = this.#baseScaleY;

    if (this.#options.squash) {
      if (this.#squashRemainingMs > 0) {
        this.#squashRemainingMs = Math.max(0, this.#squashRemainingMs - deltaMs);
        const t = this.#squashRemainingMs / SQUASH_RECOVER_MS;
        scaleX *= 1 + this.#squashAmount * t;
        scaleY *= 1 - this.#squashAmount * t;
      } else if (!onGround) {
        // Airborne stretch, proportional to vertical speed and capped so a
        // long fall never turns the actor into a sliver.
        const stretch = Math.min(0.12, Math.abs(vy) * 0.00012);
        scaleX *= 1 - stretch;
        scaleY *= 1 + stretch;
      }
    }

    this.#sprite.setScale(scaleX, scaleY);

    if (this.#options.lean) {
      const lean = Math.max(-MAX_LEAN_DEGREES, Math.min(MAX_LEAN_DEGREES, vx * LEAN_DEGREES_PER_SPEED));
      this.#sprite.setAngle(onGround ? lean : lean * 0.5);
    }

    if (this.#options.idleBob && onGround && Math.abs(vx) < 8) {
      const phase = (this.#elapsedMs % IDLE_BOB_PERIOD_MS) / IDLE_BOB_PERIOD_MS;
      this.#sprite.setY(this.#sprite.y + Math.sin(phase * Math.PI * 2) * IDLE_BOB_AMPLITUDE * (deltaMs / 16.67) * 0.25);
    }

    if (this.#flashRemainingMs > 0) {
      this.#flashRemainingMs = Math.max(0, this.#flashRemainingMs - deltaMs);
      this.#sprite.setAlpha(this.#flashRemainingMs > 0 && Math.floor(this.#flashRemainingMs / 40) % 2 === 0 ? 0.35 : 1);
      if (this.#flashRemainingMs === 0) this.#sprite.setAlpha(1);
    }

    if (this.#shadow) {
      this.#shadow.setPosition(this.#sprite.x, this.#sprite.y + this.#sprite.displayHeight / 2);
      this.#shadow.setAlpha(onGround ? 0.28 : 0.12);
    }
  }

  squash(amount: number): void {
    this.#squashAmount = amount;
    this.#squashRemainingMs = SQUASH_RECOVER_MS;
  }

  flash(): void {
    this.#flashRemainingMs = FLASH_MS;
  }

  dispose(): void {
    try {
      this.#shadow?.destroy();
      this.#sprite.setAlpha(1);
      this.#sprite.setAngle(0);
    } catch {
      /* scene already tearing down */
    }
  }
}

/** A gentle vertical bounce for pickups and markers, so a static coin still reads as collectable. */
export class BobbingMarkers {
  readonly #entries: { sprite: Phaser.GameObjects.Sprite; baseY: number; phase: number }[] = [];
  #elapsedMs = 0;

  add(sprite: Phaser.GameObjects.Sprite, phase: number): void {
    this.#entries.push({ sprite, baseY: sprite.y, phase });
  }

  remove(sprite: Phaser.GameObjects.Sprite): void {
    const index = this.#entries.findIndex((entry) => entry.sprite === sprite);
    if (index !== -1) this.#entries.splice(index, 1);
  }

  update(deltaMs: number): void {
    this.#elapsedMs += deltaMs;
    for (const entry of this.#entries) {
      const t = (this.#elapsedMs / 900 + entry.phase) % 1;
      entry.sprite.setY(entry.baseY + Math.sin(t * Math.PI * 2) * 3);
    }
  }

  dispose(): void {
    this.#entries.length = 0;
  }
}

/**
 * Draws the background role if the theme supplies one, stretched to cover the
 * viewport and pinned behind everything else. Returns null when no background
 * asset is mapped, which is the normal case for a project that only imported
 * a character.
 */
export function addBackground(scene: Phaser.Scene, textureKey: string | null, width: number, height: number): Phaser.GameObjects.Image | null {
  if (textureKey === null) return null;
  const image = scene.add.image(width / 2, height / 2, textureKey);
  const scale = Math.max(width / image.width, height / image.height);
  image.setScale(scale);
  image.setScrollFactor(0);
  image.setDepth(-100);
  return image;
}
`;
