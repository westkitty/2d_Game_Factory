/**
 * A lightweight particle system for visual effects in generated games.
 *
 * Provides burst and continuous particle emitters with configurable lifetime,
 * velocity, gravity, fade, and size curves. Pure math - no rendering dependency.
 * The game's rendering layer reads particle state and draws accordingly.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

export interface ParticleEmitterConfig {
  /** Particles per second for continuous emitters. */
  readonly rate: number;
  /** Lifetime range in milliseconds. */
  readonly lifetime: { min: number; max: number };
  /** Initial speed range. */
  readonly speed: { min: number; max: number };
  /** Emission angle range in radians (0 = right). */
  readonly angle: { min: number; max: number };
  /** Gravity applied per second. */
  readonly gravity: { x: number; y: number };
  /** Size range. */
  readonly size: { min: number; max: number };
  /** Available colors (randomly selected per particle). */
  readonly colors: readonly string[];
  /** Whether particles fade out over their lifetime. */
  readonly fadeOut: boolean;
  /** Whether particles shrink over their lifetime. */
  readonly shrink: boolean;
  /** Rotation speed range in radians per second. */
  readonly rotationSpeed: { min: number; max: number };
  /** Maximum active particles. */
  readonly maxParticles: number;
}

const DEFAULT_CONFIG: ParticleEmitterConfig = {
  rate: 20,
  lifetime: { min: 500, max: 1500 },
  speed: { min: 20, max: 80 },
  angle: { min: 0, max: Math.PI * 2 },
  gravity: { x: 0, y: 100 },
  size: { min: 2, max: 6 },
  colors: ['#ffffff'],
  fadeOut: true,
  shrink: false,
  rotationSpeed: { min: -2, max: 2 },
  maxParticles: 200,
};

export interface ParticleSystem {
  /** Get all active particles. */
  readonly particles: readonly Particle[];

  /** Emit a burst of particles at a position. */
  burst(x: number, y: number, count: number): void;

  /** Start continuous emission at a position. */
  startContinuous(x: number, y: number): void;

  /** Stop continuous emission. */
  stopContinuous(): void;

  /** Update the particle position (for continuous emitters). */
  setEmitterPosition(x: number, y: number): void;

  /** Update all particles by delta time. */
  update(deltaMs: number): void;

  /** Clear all particles. */
  clear(): void;

  /** Get the number of active particles. */
  readonly count: number;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticle(x: number, y: number, config: ParticleEmitterConfig): Particle {
  const angle = randomRange(config.angle.min, config.angle.max);
  const speed = randomRange(config.speed.min, config.speed.max);
  const life = randomRange(config.lifetime.min, config.lifetime.max);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life,
    maxLife: life,
    size: randomRange(config.size.min, config.size.max),
    color: config.colors[Math.floor(Math.random() * config.colors.length)] ?? '#ffffff',
    alpha: 1,
    rotation: 0,
    rotationSpeed: randomRange(config.rotationSpeed.min, config.rotationSpeed.max),
  };
}

/**
 * Creates a particle system with the given configuration.
 */
export function createParticleSystem(config: Partial<ParticleEmitterConfig> = {}): ParticleSystem {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const particles: Particle[] = [];
  let continuous = false;
  let emitterX = 0;
  let emitterY = 0;
  let emitAccumulator = 0;

  function burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count && particles.length < cfg.maxParticles; i++) {
      particles.push(createParticle(x, y, cfg));
    }
  }

  function startContinuous(x: number, y: number): void {
    continuous = true;
    emitterX = x;
    emitterY = y;
  }

  function stopContinuous(): void {
    continuous = false;
  }

  function setEmitterPosition(x: number, y: number): void {
    emitterX = x;
    emitterY = y;
  }

  function update(deltaMs: number): void {
    const dtSec = deltaMs / 1000;

    // Continuous emission
    if (continuous) {
      emitAccumulator += cfg.rate * dtSec;
      while (emitAccumulator >= 1 && particles.length < cfg.maxParticles) {
        particles.push(createParticle(emitterX, emitterY, cfg));
        emitAccumulator--;
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.life -= deltaMs;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Apply gravity
      p.vx += cfg.gravity.x * dtSec;
      p.vy += cfg.gravity.y * dtSec;

      // Move
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      // Rotate
      p.rotation += p.rotationSpeed * dtSec;

      // Fade
      if (cfg.fadeOut) {
        p.alpha = p.life / p.maxLife;
      }

      // Shrink
      if (cfg.shrink) {
        const progress = 1 - (p.life / p.maxLife);
        p.size = p.size * (1 - progress * 0.5);
      }
    }
  }

  function clear(): void {
    particles.length = 0;
    continuous = false;
    emitAccumulator = 0;
  }

  return {
    get particles() {
      return particles;
    },
    burst,
    startContinuous,
    stopContinuous,
    setEmitterPosition,
    update,
    clear,
    get count() {
      return particles.length;
    },
  };
}
