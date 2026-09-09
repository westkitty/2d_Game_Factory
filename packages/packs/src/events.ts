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
    'economy:served': { readonly customerId: string; readonly goodId: string; readonly cash: number; readonly stock: number };
    'economy:customerArrived': { readonly customerId: string; readonly goodId: string; readonly queueLength: number };
    'economy:customerLeft': { readonly customerId: string; readonly reason: 'impatient' };
    'economy:stockChanged': { readonly goodId: string; readonly stock: number; readonly cash: number };
    'needs:acted': { readonly actionId: string; readonly actionsTaken: number };
    'needs:completed': { readonly subjectId: string };
    'needs:failed': { readonly subjectId: string };
    'dialogue:nodeChanged': { readonly nodeId: string | null; readonly conversationId: string | null };
    'dialogue:ended': { readonly ending: string; readonly conversationId: string };
    'perception:spotted': { readonly hidden: boolean };
    'perception:alerted': { readonly mode: string };
    'perception:escaped': { readonly mode: string; readonly alarm: boolean };
    'ballPaddle:returned': { readonly mode: string };
    'ballPaddle:brick': { readonly brickId: string; readonly score: number };
    'ballPaddle:miss': { readonly lives: number };
    'ballPaddle:cleared': Record<string, never>;
    'ballPaddle:drained': Record<string, never>;
    'ballPaddle:scored': { readonly side: 'player' | 'opponent'; readonly player: number; readonly opponent: number };
    'ballPaddle:matchOver': { readonly outcome: 'complete' | 'failed' };
    'melee:struck': { readonly attackerId: string; readonly foeId: string };
    'melee:missed': { readonly attackerId: string };
    'melee:contact': { readonly foeId: string; readonly health: number };
    'melee:cleared': { readonly mode: string };
    'melee:downed': Record<string, never>;
  }
}

export {};
