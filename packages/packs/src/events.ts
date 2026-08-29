/**
 * Gameplay events owned by @sw2d/packs, merged into the core
 * `GameEventMap` rather than declared inside `@sw2d/contracts` (ADR-0012).
 *
 * Contracts owns runtime lifecycle events (`pause:changed`,
 * `settings:changed`, ...). A pack family owns its own; declaration merging
 * keeps `emit`/`on` fully typed for anyone who imports this package, without
 * a gameplay vocabulary accumulating inside the dependency-free core - and
 * without a preset author having to edit a protected package to raise an
 * event.
 *
 * Naming: `<capability family>:<pastTenseFact>`. One or two per family, added
 * only where a cross-system reaction is plausible (a HUD, another pack) - not
 * for every internal mutation.
 */

declare module '@sw2d/contracts' {
  interface GameEventMap {
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
    'items:countChanged': { readonly itemId: string; readonly count: number; readonly delta: number };
    'items:consumed': { readonly itemId: string; readonly count: number };
    'weapons:fired': { readonly ownerId: string; readonly weaponId: string; readonly shots: number };
    'weapons:ammoChanged': { readonly ownerId: string; readonly ammo: number };
    'encounters:phaseChanged': { readonly encounterId: string; readonly phaseId: string | null; readonly phaseIndex: number };
    'encounters:completed': { readonly encounterId: string };
    'runs:started': { readonly runId: string; readonly seed: number; readonly attempt: number };
    'runs:ended': { readonly runId: string; readonly outcome: 'victory' | 'defeat' | 'abandoned'; readonly durationMs: number; readonly stats: unknown };
    'runs:reset': { readonly runId: string; readonly attempt: number; readonly seed: number; readonly failures: readonly unknown[] };
    'runs:currencyChanged': { readonly transientCurrency: number; readonly delta: number };
    'runs:upgradePurchased': { readonly upgradeId: string; readonly kind: 'transient' | 'permanent' };
    'runs:killRecorded': { readonly kills: number };
    'runs:roomCleared': { readonly roomsCleared: number };
    'runs:waveCleared': { readonly wavesCleared: number };
  }
}

export {};
