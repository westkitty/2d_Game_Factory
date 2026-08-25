import type { ActionId } from './actions.ts';
import type { AccessibilityState } from './accessibility.ts';
import type { Disposable } from './disposable.ts';
import type { GameSettings } from './persistence.ts';

/**
 * Stable machine-readable snapshot for automated QA and for humans.
 *
 * Counters here are the evidence used to prove that restart does not duplicate
 * listeners, adapters or pack installs. Keep the shape additive.
 */
export interface DebugSnapshot {
  readonly snapshotVersion: number;
  readonly gameId: string;
  readonly runtimeVersion: string;
  readonly scene: string | null;
  readonly paused: boolean;
  readonly runIndex: number;
  readonly fps: number;
  readonly actions: Readonly<Record<ActionId, number>>;
  readonly installedPacks: readonly string[];
  readonly capabilities: readonly string[];
  /** Live handler counts: event bus names, input adapters, context disposables. */
  readonly listeners: Readonly<Record<string, number>>;
  readonly settings: GameSettings;
  readonly accessibility: AccessibilityState;
  readonly audioUnlock: string;
  /** Contributions registered by packs and by game-specific code. */
  readonly extra: Readonly<Record<string, unknown>>;
}

export interface DebugState {
  snapshot(): DebugSnapshot;
  /**
   * Publish a named section into `snapshot().extra`.
   * Dispose the handle to withdraw it; leftover sections after a restart are a leak.
   */
  contribute(id: string, produce: () => unknown): Disposable;
  /** True when development-only diagnostics are permitted. */
  readonly enabled: boolean;
}
