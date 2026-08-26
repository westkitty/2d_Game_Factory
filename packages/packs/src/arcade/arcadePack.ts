import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import arcadeConfigSchema from '../../schemas/arcade-config.schema.json' with { type: 'json' };

/**
 * Arcade pack: score, combo, round counters and elapsed timing. No
 * leaderboards, ghost recording, replay, matchmaking or complete wave
 * spawning here - those consume this state.
 *
 * Timing is stepped deterministically through `update(deltaMs)`, driven by
 * `SystemHost.update()`; nothing here reads the wall clock.
 */

export const ARCADE_CONFIG_SCHEMA_ID = arcadeConfigSchema.$id;
registerSchema(arcadeConfigSchema);

export interface ArcadeConfig {
  readonly startingLives?: number;
  readonly comboWindowMs?: number;
}

export interface ArcadeService {
  score(): number;
  addScore(delta: number): number;
  combo(): number;
  /** Increments combo if within `comboWindowMs` of the previous hit; otherwise resets combo to 1. Deterministic given `nowMs`. */
  registerHit(nowMs: number): number;
  resetCombo(): void;
  round(): number;
  nextRound(): number;
  lives(): number;
  /** Clamped at 0; returns the remaining lives. */
  loseLife(): number;
  /** Total time accumulated through `update(deltaMs)` since install. */
  elapsedMs(): number;
}

class ArcadeServiceImpl implements ArcadeService {
  #score = 0;
  #combo = 0;
  #round = 1;
  #lives: number;
  #elapsedMs = 0;
  #lastHitMs: number | null = null;
  readonly #comboWindowMs: number;
  readonly #events: EventBus;

  constructor(events: EventBus, startingLives: number, comboWindowMs: number) {
    this.#events = events;
    this.#lives = startingLives;
    this.#comboWindowMs = comboWindowMs;
  }

  score(): number {
    return this.#score;
  }

  addScore(delta: number): number {
    this.#score += delta;
    this.#events.emit('arcade:scoreChanged', { score: this.#score, delta });
    return this.#score;
  }

  combo(): number {
    return this.#combo;
  }

  registerHit(nowMs: number): number {
    const withinWindow = this.#lastHitMs !== null && nowMs - this.#lastHitMs <= this.#comboWindowMs;
    this.#combo = withinWindow ? this.#combo + 1 : 1;
    this.#lastHitMs = nowMs;
    return this.#combo;
  }

  resetCombo(): void {
    this.#combo = 0;
    this.#lastHitMs = null;
  }

  round(): number {
    return this.#round;
  }

  nextRound(): number {
    this.#round += 1;
    return this.#round;
  }

  lives(): number {
    return this.#lives;
  }

  loseLife(): number {
    this.#lives = Math.max(0, this.#lives - 1);
    return this.#lives;
  }

  elapsedMs(): number {
    return this.#elapsedMs;
  }

  tick(deltaMs: number): void {
    this.#elapsedMs += deltaMs;
  }
}

export const arcadePack: SystemPackDefinition<ArcadeConfig, GameContext> = {
  id: PACK_IDS.arcade,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.arcade],
  dependencies: [],
  configSchemaId: ARCADE_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: ArcadeConfig): InstalledSystemPack {
    const service = new ArcadeServiceImpl(context.events, config?.startingLives ?? 3, config?.comboWindowMs ?? 800);
    const handle = context.capabilities.provide(CAPABILITY_IDS.arcade, service);

    return {
      id: PACK_IDS.arcade,
      update(deltaMs: number): void {
        service.tick(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
