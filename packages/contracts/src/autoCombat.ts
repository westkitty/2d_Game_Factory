/** Post-ten Phase 22: deterministic autonomous-combat orchestration. */

export const AUTO_COMBAT_CAPABILITY_ID = 'strategy.auto-combat';

export type AutoCombatTargetPolicy = 'nearest' | 'lowest-health' | 'highest-threat' | 'preferred-role';
export type AutoCombatUnitPhase = 'acquire' | 'move' | 'engage' | 'reassess' | 'dead' | 'complete';
export type AutoCombatRoundPhase = 'deploy' | 'ready' | 'battle' | 'resolve' | 'cleanup' | 'next';

export interface AutoCombatArchetype {
  readonly id: string;
  readonly teamId: string;
  readonly weaponId: string;
  readonly range: number;
  readonly moveSpeed: number;
  readonly maxHealth: number;
  readonly targetPolicy: AutoCombatTargetPolicy;
  readonly roleTags?: readonly string[];
  readonly threat?: number;
  /** At most once per this many simulation ms; never retarget every frame. */
  readonly reassessMs?: number;
}

export interface DeploymentSlot {
  readonly id: string;
  readonly teamId: string;
  readonly x: number;
  readonly y: number;
}

export interface AutoCombatDocument {
  readonly schemaVersion: number;
  readonly archetypes: readonly AutoCombatArchetype[];
  readonly slots: readonly DeploymentSlot[];
}

export interface AutoCombatUnitState {
  readonly instanceId: string;
  readonly archetypeId: string;
  readonly teamId: string;
  readonly x: number;
  readonly y: number;
  readonly phase: AutoCombatUnitPhase;
  readonly targetId: string | null;
  readonly nextReassessAtMs: number;
}

export interface AutoCombatCandidate {
  readonly id: string;
  readonly teamId: string;
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly threat: number;
  readonly roleTags: readonly string[];
}

export function selectAutoCombatTarget(
  policy: AutoCombatTargetPolicy,
  preferredRole: string | undefined,
  from: { readonly x: number; readonly y: number },
  candidates: readonly AutoCombatCandidate[],
): AutoCombatCandidate | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map((candidate) => {
    const distance = Math.hypot(candidate.x - from.x, candidate.y - from.y);
    const score = policy === 'nearest' ? distance : policy === 'lowest-health' ? candidate.health : policy === 'highest-threat' ? -candidate.threat : candidate.roleTags.includes(preferredRole ?? '') ? 0 : 1;
    return { candidate, score, distance };
  });
  scored.sort((a, b) => a.score - b.score || a.distance - b.distance || a.candidate.id.localeCompare(b.candidate.id));
  return scored[0]!.candidate;
}

export function moveToward(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }, distance: number): { readonly x: number; readonly y: number } {
  const dx = to.x - from.x; const dy = to.y - from.y; const length = Math.hypot(dx, dy);
  if (length === 0 || distance >= length) return { x: to.x, y: to.y };
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

export interface AutoCombatService {
  phase(): AutoCombatRoundPhase;
  units(): readonly AutoCombatUnitState[];
  deploy(archetypeId: string, slotId: string): { readonly ok: boolean; readonly instanceId?: string; readonly reason?: 'unknown-archetype' | 'unknown-slot' | 'wrong-team' | 'occupied-slot' | 'round-started' };
  start(): boolean;
  winner(): string | null;
  reset(): void;
  drainEvents(): readonly AutoCombatEvent[];
}

export type AutoCombatEvent =
  | { readonly kind: 'deployed'; readonly instanceId: string; readonly slotId: string }
  | { readonly kind: 'targeted'; readonly instanceId: string; readonly targetId: string | null }
  | { readonly kind: 'defeated'; readonly instanceId: string }
  | { readonly kind: 'round-complete'; readonly winner: string | null };

export class InvalidAutoCombatDocumentError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidAutoCombatDocumentError'; }
}

export function validateAutoCombatDocument(document: AutoCombatDocument): void {
  const fail = (message: string): never => { throw new InvalidAutoCombatDocumentError(message); };
  const ids = new Set<string>();
  for (const unit of document.archetypes) {
    if (ids.has(unit.id)) fail(`Archetype "${unit.id}" is defined more than once.`); ids.add(unit.id);
    if (unit.range < 0 || unit.moveSpeed < 0 || unit.maxHealth <= 0) fail(`Archetype "${unit.id}" has invalid range, moveSpeed or maxHealth.`);
  }
  const slots = new Set<string>();
  for (const slot of document.slots) { if (slots.has(slot.id)) fail(`Deployment slot "${slot.id}" is defined more than once.`); slots.add(slot.id); }
}
