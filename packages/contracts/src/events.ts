import type { Disposable } from './disposable.ts';

/**
 * Typed cross-system event map.
 *
 * System packs extend this via declaration merging:
 *
 *   declare module '@sw2d/contracts' {
 *     interface GameEventMap {
 *       'combat:playerDamaged': { readonly amount: number };
 *     }
 *   }
 *
 * That keeps gameplay events out of the core while keeping emit/on fully typed.
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

  // Phase 4 system pack events. One or two per family, added only where a
  // cross-system reaction is plausible (HUD, other packs) - not for every
  // internal mutation. See @sw2d/packs.
  'combat:entityDamaged': { readonly entityId: string; readonly amount: number; readonly current: number };
  'combat:entityDied': { readonly entityId: string };
  'ai:stateChanged': { readonly agentId: string; readonly from: string; readonly to: string };
  'world:flagChanged': { readonly flag: string; readonly value: boolean };
  'world:checkpointActivated': { readonly checkpointId: string };
  'progression:currencyChanged': { readonly currency: number; readonly delta: number };
  'progression:unlockChanged': { readonly flag: string; readonly unlocked: boolean };
  'arcade:scoreChanged': { readonly score: number; readonly delta: number };
  'puzzle:solved': { readonly puzzleId: string };
  'simulation:resourceChanged': { readonly resourceId: string; readonly amount: number; readonly delta: number };
  'narrative:flagChanged': { readonly flag: string; readonly value: boolean };
  'strategy:turnChanged': { readonly team: string; readonly turnNumber: number };
}

export type GameEventName = keyof GameEventMap & string;

export interface EventBus {
  /** Subscribe. Dispose the returned handle to unsubscribe. */
  on<K extends GameEventName>(name: K, handler: (payload: GameEventMap[K]) => void): Disposable;
  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void;
  /** Live handler counts per event name. Used by restart-leak diagnostics. */
  listenerCounts(): Readonly<Record<string, number>>;
}
