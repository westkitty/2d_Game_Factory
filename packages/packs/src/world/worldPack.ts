import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * World pack: reusable world-state primitives - flags, checkpoint identity,
 * zone/trigger state. No Tiled, rooms, tilemap loading, camera zones or
 * transitions here; those consume this state in a later phase.
 */

export interface WorldService {
  /** No-op (no event) if `value` already equals the flag's current value. */
  setFlag(flag: string, value: boolean): void;
  hasFlag(flag: string): boolean;
  flags(): readonly string[];

  activateCheckpoint(checkpointId: string): void;
  currentCheckpoint(): string | null;

  setZoneEntered(zoneId: string, entered: boolean): void;
  isZoneEntered(zoneId: string): boolean;

  /** Clears all flags, the active checkpoint and all zone state. */
  reset(): void;
}

class WorldServiceImpl implements WorldService {
  readonly #flags = new Set<string>();
  readonly #zones = new Set<string>();
  #checkpoint: string | null = null;
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  setFlag(flag: string, value: boolean): void {
    const had = this.#flags.has(flag);
    if (had === value) return;
    if (value) this.#flags.add(flag);
    else this.#flags.delete(flag);
    this.#events.emit('world:flagChanged', { flag, value });
  }

  hasFlag(flag: string): boolean {
    return this.#flags.has(flag);
  }

  flags(): readonly string[] {
    return [...this.#flags].sort();
  }

  activateCheckpoint(checkpointId: string): void {
    this.#checkpoint = checkpointId;
    this.#events.emit('world:checkpointActivated', { checkpointId });
  }

  currentCheckpoint(): string | null {
    return this.#checkpoint;
  }

  setZoneEntered(zoneId: string, entered: boolean): void {
    if (entered) this.#zones.add(zoneId);
    else this.#zones.delete(zoneId);
  }

  isZoneEntered(zoneId: string): boolean {
    return this.#zones.has(zoneId);
  }

  reset(): void {
    this.#flags.clear();
    this.#zones.clear();
    this.#checkpoint = null;
  }
}

export const worldPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.world,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.world],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new WorldServiceImpl(context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.world, service);

    return {
      id: PACK_IDS.world,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
