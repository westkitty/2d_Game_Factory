import type { Disposable } from './disposable.ts';

/**
 * Typed cross-system event map.
 *
 * This interface holds *runtime-owned* lifecycle events only - the ones the
 * machine itself raises and any game may rely on. Gameplay events belong to
 * whichever package owns the system that raises them, and are merged in
 * declaratively:
 *
 *   declare module '@sw2d/contracts' {
 *     interface GameEventMap {
 *       'combat:entityDied': { readonly entityId: string };
 *     }
 *   }
 *
 * See `packages/packs/src/events.ts` for the worked example. Keeping gameplay
 * events out of this file is load-bearing rather than tidy: adding one would
 * otherwise mean editing `@sw2d/contracts`, which the protected boundary
 * reserves for runtime work, every time a pack family or preset grows an
 * event (ADR-0012).
 *
 * Do not add an event for every trivial local operation; events are for
 * cross-system communication.
 */
export interface GameEventMap {
  'game:booted': { readonly gameId: string };
  'scene:changed': { readonly from: string | null; readonly to: string };
  'run:started': { readonly runIndex: number };
  'run:restarted': { readonly runIndex: number };
  'pause:changed': { readonly paused: boolean };
  'settings:changed': { readonly reason: 'patch' | 'reset' | 'load' };
  'accessibility:changed': Record<string, never>;
  'audio:unlocked': Record<string, never>;
}

export type GameEventName = keyof GameEventMap & string;

export interface EventBus {
  /** Subscribe. Dispose the returned handle to unsubscribe. */
  on<K extends GameEventName>(name: K, handler: (payload: GameEventMap[K]) => void): Disposable;
  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void;
  /** Live handler counts per event name. Used by restart-leak diagnostics. */
  listenerCounts(): Readonly<Record<string, number>>;
}
