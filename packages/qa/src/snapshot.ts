import type { Harness } from './harness.ts';

/** Mirrors @sw2d/contracts DebugSnapshot loosely - just the shape every spec actually reads. */
export interface DebugSnapshotLike {
  readonly scene: string | null;
  readonly runIndex: number;
  readonly paused: boolean;
  readonly installedPacks: readonly string[];
  /** Live capability ids. Phase 15's leak check reads this to prove one hub, not two. */
  readonly capabilities: readonly string[];
  /** Live listener/adapter counts, keyed by name. The restart-leak surface. */
  readonly listeners: Readonly<Record<string, number>>;
  readonly extra: Readonly<Record<string, unknown>>;
}

/** `window.__SW2D__.snapshot()`, cast once here instead of in every spec file. */
export function readSnapshot(harness: Harness): Promise<DebugSnapshotLike> {
  return harness.evaluate(
    () => (window as unknown as { __SW2D__: { snapshot(): DebugSnapshotLike } }).__SW2D__.snapshot(),
  );
}

/** The one debug.contribute() key every generated shell pack uses, regardless of controller family - see packages/cli/src/generator/controllerTemplates.ts's shellPackId(). */
export async function readShellState<T>(harness: Harness, shellPackId: string): Promise<T> {
  const snapshot = await readSnapshot(harness);
  return snapshot.extra[shellPackId] as T;
}
