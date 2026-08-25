import type { ActionId, DebugSnapshot, DebugState, Disposable } from '@sw2d/contracts';

export const DEBUG_SNAPSHOT_VERSION = 1;

export interface DebugSources {
  readonly gameId: string;
  readonly runtimeVersion: string;
  scene(): string | null;
  paused(): boolean;
  runIndex(): number;
  fps(): number;
  actions(): Readonly<Record<ActionId, number>>;
  installedPacks(): readonly string[];
  capabilities(): readonly string[];
  listeners(): Readonly<Record<string, number>>;
  settings(): DebugSnapshot['settings'];
  accessibility(): DebugSnapshot['accessibility'];
  audioUnlock(): string;
}

/**
 * Stable snapshot API for automated QA and for humans.
 *
 * Deliberately a pull-based, side-effect-free read: a QA journey can call it at
 * any moment without perturbing the game. Contributions are disposable, so a
 * section still present after a restart is itself evidence of a leak.
 */
export class DebugStateImpl implements DebugState {
  readonly enabled: boolean;
  readonly #sources: DebugSources;
  readonly #contributors = new Map<string, () => unknown>();

  constructor(sources: DebugSources, enabled: boolean) {
    this.#sources = sources;
    this.enabled = enabled;
  }

  contribute(id: string, produce: () => unknown): Disposable {
    this.#contributors.set(id, produce);
    return {
      dispose: () => {
        if (this.#contributors.get(id) === produce) this.#contributors.delete(id);
      },
    };
  }

  snapshot(): DebugSnapshot {
    const extra: Record<string, unknown> = {};
    for (const [id, produce] of this.#contributors) {
      try {
        extra[id] = produce();
      } catch (error) {
        extra[id] = { error: String(error) };
      }
    }
    const source = this.#sources;
    return {
      snapshotVersion: DEBUG_SNAPSHOT_VERSION,
      gameId: source.gameId,
      runtimeVersion: source.runtimeVersion,
      scene: source.scene(),
      paused: source.paused(),
      runIndex: source.runIndex(),
      fps: Math.round(source.fps()),
      actions: source.actions(),
      installedPacks: source.installedPacks(),
      capabilities: source.capabilities(),
      listeners: source.listeners(),
      settings: source.settings(),
      accessibility: source.accessibility(),
      audioUnlock: source.audioUnlock(),
      extra,
    };
  }
}
