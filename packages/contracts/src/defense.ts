/**
 * Defense objectives, towers & territory (post-ten program Phase 21).
 *
 * Two capabilities from one problem space: `strategy.defense` (towers, their
 * placement, what they shoot at, upgrades, lanes and a base with health) and
 * `strategy.territory` (capture zones that change hands and score).
 *
 * ## A tower does not own a projectile engine
 *
 * A tower has a `weaponId` and nothing else about firing. `combat.weapons`
 * (certified Phase 3) owns cooldowns, fire modes, ammo, burst queues and
 * projectile spawns; a tower decides *what to shoot at* and asks that service to
 * fire. A tower-specific projectile system would be a second implementation of
 * the hardest part of shooting, and it would drift.
 *
 * ## Blocking placement is checked against the real pathfinder
 *
 * A tower that blocks movement can trap a lane. The only honest way to know is
 * to apply the blocker, ask `world.navigation` whether every required
 * entrance-to-objective route still exists, and take it away again. That is the
 * pack's job because it needs the live grid; what lives here is the *ordering* -
 * the cheap checks (zone, overlap, funds) run first, and the expensive route
 * check runs last and only if they passed.
 *
 * Renderer-neutral and pure. Nothing here reads a clock, a renderer or
 * `Math.random`; every tie-break is a stable id comparison so the same board
 * always produces the same target.
 */

import { footprintRect, pointInRect, rectContains, rectsOverlap } from './geometry.ts';
import type { Footprint, Point, Rect } from './geometry.ts';
import { DEFAULT_FOOTPRINT } from './geometry.ts';

export const DEFENSE_CAPABILITY_ID = 'strategy.defense';
export const TERRITORY_CAPABILITY_ID = 'strategy.territory';

// --- Target selection ----------------------------------------------------

/**
 * `first-on-route` / `last-on-route` are the two that matter and the two most
 * often got wrong: "first" means furthest along its route, i.e. closest to the
 * objective and most urgent - not the earliest to have spawned.
 */
export type TargetPolicy =
  | 'nearest'
  | 'first-on-route'
  | 'last-on-route'
  | 'lowest-health'
  | 'highest-health';

export const TARGET_POLICIES: readonly TargetPolicy[] = [
  'nearest',
  'first-on-route',
  'last-on-route',
  'lowest-health',
  'highest-health',
];

export interface TargetCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly maxHealth: number;
  /** Distance travelled along its lane. Higher is further along, so nearer the objective. */
  readonly routeProgress: number;
}

export function distanceBetween(from: Point, candidate: TargetCandidate): number {
  return Math.hypot(candidate.x - from.x, candidate.y - from.y);
}

export function inRange(from: Point, candidate: TargetCandidate, range: number): boolean {
  // Inclusive: a target exactly at the range boundary is in range, so a tower's
  // stated range is the range it actually has.
  return distanceBetween(from, candidate) <= range;
}

/**
 * The whole targeting rule, pure. Ties break on ascending entity id in every
 * policy, so two towers looking at the same board always agree and a replay
 * never diverges on Map ordering.
 */
export function selectTarget(
  policy: TargetPolicy,
  from: Point,
  range: number,
  candidates: readonly TargetCandidate[],
): TargetCandidate | null {
  const reachable = candidates.filter((candidate) => inRange(from, candidate, range));
  if (reachable.length === 0) return null;

  const score = (candidate: TargetCandidate): number => {
    switch (policy) {
      case 'nearest':
        return distanceBetween(from, candidate);
      case 'first-on-route':
        return -candidate.routeProgress;
      case 'last-on-route':
        return candidate.routeProgress;
      case 'lowest-health':
        return candidate.health;
      case 'highest-health':
        return -candidate.health;
    }
  };

  let best = reachable[0]!;
  let bestScore = score(best);
  for (const candidate of reachable.slice(1)) {
    const candidateScore = score(candidate);
    if (candidateScore < bestScore || (candidateScore === bestScore && candidate.id < best.id)) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

// --- Towers --------------------------------------------------------------

export interface TowerUpgradeTier {
  readonly id: string;
  readonly displayName?: string;
  readonly cost: number;
  /** Replaces the tower's weapon entirely. Omit to keep the current one. */
  readonly weaponId?: string;
  /** Multiplies the base range. Tiers compound. */
  readonly rangeMultiplier?: number;
  /** Multiplies the weapon's cooldown. Below 1 is faster. Tiers compound. */
  readonly cooldownMultiplier?: number;
  /** Multiplies the weapon's damage. Tiers compound. */
  readonly damageMultiplier?: number;
}

export interface TowerDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly cost: number;
  readonly footprint?: Footprint;
  readonly range: number;
  /** Weapon id from `content/weapons.json`. There is one weapon system. */
  readonly weaponId: string;
  readonly targetPolicy: TargetPolicy;
  /** Ordered tiers. A tower at tier n has applied tiers 0..n-1. */
  readonly upgrades?: readonly TowerUpgradeTier[];
  /** Fraction of everything spent that selling returns. 0..1, default 0. */
  readonly refundRatio?: number;
  /**
   * Whether the tower blocks movement. Only a blocking tower needs the
   * expensive route check, and only a blocking tower can trap a lane.
   */
  readonly blocking?: boolean;
}

export interface TowerState {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly position: Point;
  /** 0 for a freshly placed tower. */
  readonly tier: number;
  /** Base range with every applied tier's multiplier compounded in. */
  readonly range: number;
  readonly weaponId: string;
  readonly cooldownMultiplier: number;
  readonly damageMultiplier: number;
  /** Everything spent on this tower so far - the base cost plus every upgrade. */
  readonly invested: number;
  readonly targetId: string | null;
}

/** Everything an applied tier stack changes, compounded. Pure. */
export function resolveTowerStats(
  definition: TowerDefinition,
  tier: number,
): {
  readonly range: number;
  readonly weaponId: string;
  readonly cooldownMultiplier: number;
  readonly damageMultiplier: number;
  readonly invested: number;
} {
  const tiers = (definition.upgrades ?? []).slice(0, Math.max(0, tier));
  let range = definition.range;
  let weaponId = definition.weaponId;
  let cooldownMultiplier = 1;
  let damageMultiplier = 1;
  let invested = definition.cost;
  for (const applied of tiers) {
    range *= applied.rangeMultiplier ?? 1;
    if (applied.weaponId) weaponId = applied.weaponId;
    cooldownMultiplier *= applied.cooldownMultiplier ?? 1;
    damageMultiplier *= applied.damageMultiplier ?? 1;
    invested += applied.cost;
  }
  return { range, weaponId, cooldownMultiplier, damageMultiplier, invested };
}

export function refundFor(definition: TowerDefinition, invested: number): number {
  const ratio = definition.refundRatio ?? 0;
  const clamped = ratio <= 0 ? 0 : ratio >= 1 ? 1 : ratio;
  return Math.floor(invested * clamped);
}

// --- Placement -----------------------------------------------------------

export type BuildZoneKind = 'buildable' | 'blocked';

export interface BuildZone {
  readonly id: string;
  readonly kind: BuildZoneKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type TowerPlacementFailure =
  | 'unknown-tower'
  | 'outside-zone'
  | 'inside-blocked-zone'
  | 'overlaps-tower'
  | 'insufficient-funds'
  | 'blocks-route';

export interface TowerPlacementResult {
  readonly ok: boolean;
  readonly reason?: TowerPlacementFailure;
  readonly definitionId: string;
  readonly position: Point;
  readonly cost: number;
  readonly instanceId?: string;
}

/**
 * The whole placement rule, pure, in the order that matters.
 *
 * Zone, overlap and funds are cheap and are checked first. `routeIntact` is the
 * expensive one - it costs a temporary grid mutation and a pathfind per required
 * route - so it runs last, only if everything else passed, and only for a tower
 * that actually blocks. A preview that ran it on every pointer move would make
 * the cursor stutter across the board.
 */
export function evaluateTowerPlacement(
  definition: TowerDefinition,
  position: Point,
  zones: readonly BuildZone[],
  occupiedRects: readonly Rect[],
  funds: number,
  routeIntact?: () => boolean,
): TowerPlacementFailure | undefined {
  const rect = footprintRect(position, definition.footprint ?? DEFAULT_FOOTPRINT);

  const buildable = zones.filter((zone) => zone.kind === 'buildable');
  if (!buildable.some((zone) => rectContains(zone, rect))) return 'outside-zone';
  if (zones.filter((zone) => zone.kind === 'blocked').some((zone) => rectsOverlap(zone, rect))) {
    return 'inside-blocked-zone';
  }
  if (occupiedRects.some((other) => rectsOverlap(rect, other))) return 'overlaps-tower';
  if (funds < definition.cost) return 'insufficient-funds';

  if (definition.blocking === true && routeIntact && !routeIntact()) return 'blocks-route';
  return undefined;
}

/** A route the level guarantees: an entrance that must always reach an objective. */
export interface RouteRequirement {
  readonly id: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
}

// --- Lanes and waves -----------------------------------------------------

export interface LaneDefinition {
  readonly id: string;
  readonly spawnX: number;
  readonly spawnY: number;
  /** Ordered waypoints from the spawn to the objective. */
  readonly route: readonly Point[];
  /** Which base a leaker damages. */
  readonly objectiveId: string;
  /** Encounter id from `content/encounters.json`. Waves are Phase 4's job. */
  readonly encounterId?: string;
}

/** Total world-space length of a lane, used to normalise route progress. */
export function laneLength(lane: LaneDefinition): number {
  let total = 0;
  let previous: Point = { x: lane.spawnX, y: lane.spawnY };
  for (const point of lane.route) {
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}

// --- Base ----------------------------------------------------------------

export interface BaseDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly maxHealth: number;
  /** Damage one leaker deals when it reaches the objective. */
  readonly breachDamage: number;
}

export interface BaseState {
  readonly id: string;
  readonly health: number;
  readonly maxHealth: number;
  readonly breaches: number;
  /** Health has reached zero. The defeat condition. */
  readonly destroyed: boolean;
}

// --- Territory -----------------------------------------------------------

export type ZoneShape =
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: 'circle'; readonly x: number; readonly y: number; readonly radius: number };

export function shapeContains(shape: ZoneShape, point: Point): boolean {
  if (shape.kind === 'rect') return pointInRect(point, shape);
  return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius;
}

export interface CaptureZoneDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly shape: ZoneShape;
  /** Team holding it at the start, or null for neutral. */
  readonly initialOwner?: string | null;
  /** How long one uncontested occupant needs to take it, from zero. */
  readonly captureMs: number;
  /** Progress lost per second while nobody is present. 0 keeps partial progress. */
  readonly decayPerSecond?: number;
  /** Score per second awarded to the owner while they hold it. */
  readonly scorePerSecond?: number;
  /**
   * Whether more occupants capture proportionally faster. Default false: one
   * defender holding against five is a design decision, not an accident.
   */
  readonly scaleWithOccupants?: boolean;
}

export interface ZoneOccupant {
  readonly id: string;
  readonly teamId: string;
  readonly x: number;
  readonly y: number;
}

export interface CaptureZoneState {
  readonly id: string;
  readonly owner: string | null;
  /** The team currently making progress, or null when nobody is. */
  readonly capturingTeam: string | null;
  /** 0..1 toward `capturingTeam` taking it. */
  readonly progress: number;
  /** Two or more opposing teams present: progress is frozen, not shared. */
  readonly contested: boolean;
  readonly occupants: Readonly<Record<string, number>>;
}

/**
 * One frame of a capture zone, pure.
 *
 * Contested means **frozen**, not "whoever has more wins". A tug-of-war where
 * the larger team simply wins faster removes the reason to defend at all; a
 * frozen zone makes the other team have to actually clear it.
 */
export function tickCaptureZone(
  definition: CaptureZoneDefinition,
  state: CaptureZoneState,
  occupants: readonly ZoneOccupant[],
  deltaMs: number,
): CaptureZoneState {
  const inside = occupants.filter((occupant) => shapeContains(definition.shape, occupant));
  const byTeam = new Map<string, number>();
  for (const occupant of inside) byTeam.set(occupant.teamId, (byTeam.get(occupant.teamId) ?? 0) + 1);
  const teams = [...byTeam.keys()].sort((a, b) => a.localeCompare(b));
  const counts = Object.fromEntries([...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  // More than one team present: frozen.
  if (teams.length > 1) {
    return { ...state, contested: true, occupants: counts };
  }

  if (teams.length === 0) {
    const decay = (definition.decayPerSecond ?? 0) * (deltaMs / 1000);
    const progress = Math.max(0, state.progress - decay);
    return {
      ...state,
      contested: false,
      occupants: counts,
      progress,
      // Losing all progress releases the claim, but never the ownership: a zone
      // stays captured until someone else takes it.
      capturingTeam: progress > 0 ? state.capturingTeam : null,
    };
  }

  const team = teams[0]!;
  const count = byTeam.get(team) ?? 1;
  const rate = definition.scaleWithOccupants === true ? count : 1;
  const step = (deltaMs / Math.max(1, definition.captureMs)) * rate;

  // A team standing in a zone it already owns holds it; nothing to capture.
  if (state.owner === team && state.capturingTeam === null) {
    return { ...state, contested: false, occupants: counts, progress: 0 };
  }

  // A different team entering must first undo the incumbent's progress.
  if (state.capturingTeam !== null && state.capturingTeam !== team) {
    const progress = state.progress - step;
    if (progress > 0) return { ...state, contested: false, occupants: counts, progress };
    return { ...state, contested: false, occupants: counts, capturingTeam: team, progress: -progress };
  }

  const progress = state.progress + step;
  if (progress < 1) {
    return { ...state, contested: false, occupants: counts, capturingTeam: team, progress };
  }
  return { ...state, contested: false, occupants: counts, owner: team, capturingTeam: null, progress: 0 };
}

// --- Document ------------------------------------------------------------

/** The validated `content/defense.json` document. */
export interface DefenseDocument {
  readonly schemaVersion: number;
  readonly towers?: readonly TowerDefinition[];
  readonly zones?: readonly BuildZone[];
  readonly lanes?: readonly LaneDefinition[];
  readonly bases?: readonly BaseDefinition[];
  readonly routes?: readonly RouteRequirement[];
  readonly captureZones?: readonly CaptureZoneDefinition[];
  /** Currency the defender opens with, when the game does not supply one. */
  readonly startingFunds?: number;
}

export class InvalidDefenseDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDefenseDocumentError';
  }
}

/** The semantic gate the JSON schema cannot express: cross-references and orderings. */
export function validateDefenseDocument(document: DefenseDocument): void {
  const fail = (message: string): never => {
    throw new InvalidDefenseDocumentError(message);
  };

  const towerIds = new Set<string>();
  for (const tower of document.towers ?? []) {
    if (towerIds.has(tower.id)) fail(`Tower "${tower.id}" is defined more than once.`);
    towerIds.add(tower.id);
    if (tower.range <= 0) fail(`Tower "${tower.id}" has a non-positive range.`);
    if (tower.cost < 0) fail(`Tower "${tower.id}" has a negative cost.`);
    const ratio = tower.refundRatio ?? 0;
    if (ratio < 0 || ratio > 1) fail(`Tower "${tower.id}" has a refundRatio of ${ratio}; it must be 0..1.`);
    const tierIds = new Set<string>();
    for (const tier of tower.upgrades ?? []) {
      if (tierIds.has(tier.id)) fail(`Tower "${tower.id}" defines upgrade "${tier.id}" more than once.`);
      tierIds.add(tier.id);
      if (tier.cost < 0) fail(`Tower "${tower.id}" upgrade "${tier.id}" has a negative cost.`);
      for (const [name, value] of [
        ['rangeMultiplier', tier.rangeMultiplier],
        ['cooldownMultiplier', tier.cooldownMultiplier],
        ['damageMultiplier', tier.damageMultiplier],
      ] as const) {
        if (value !== undefined && value <= 0) {
          fail(`Tower "${tower.id}" upgrade "${tier.id}" has a non-positive ${name}.`);
        }
      }
    }
  }

  const zoneIds = new Set<string>();
  for (const zone of document.zones ?? []) {
    if (zoneIds.has(zone.id)) fail(`Build zone "${zone.id}" is defined more than once.`);
    zoneIds.add(zone.id);
    if (zone.width <= 0 || zone.height <= 0) fail(`Build zone "${zone.id}" has no area.`);
  }

  const baseIds = new Set<string>();
  for (const base of document.bases ?? []) {
    if (baseIds.has(base.id)) fail(`Base "${base.id}" is defined more than once.`);
    baseIds.add(base.id);
    if (base.maxHealth <= 0) fail(`Base "${base.id}" has a non-positive maxHealth.`);
    if (base.breachDamage <= 0) fail(`Base "${base.id}" has a non-positive breachDamage.`);
  }

  const laneIds = new Set<string>();
  for (const lane of document.lanes ?? []) {
    if (laneIds.has(lane.id)) fail(`Lane "${lane.id}" is defined more than once.`);
    laneIds.add(lane.id);
    if (lane.route.length === 0) fail(`Lane "${lane.id}" has no route.`);
    if (!baseIds.has(lane.objectiveId)) {
      fail(`Lane "${lane.id}" targets base "${lane.objectiveId}", which is not defined.`);
    }
  }

  const captureIds = new Set<string>();
  for (const zone of document.captureZones ?? []) {
    if (captureIds.has(zone.id)) fail(`Capture zone "${zone.id}" is defined more than once.`);
    captureIds.add(zone.id);
    if (zone.captureMs <= 0) fail(`Capture zone "${zone.id}" has a non-positive captureMs.`);
    if ((zone.decayPerSecond ?? 0) < 0) fail(`Capture zone "${zone.id}" has a negative decayPerSecond.`);
    if (zone.shape.kind === 'circle' && zone.shape.radius <= 0) {
      fail(`Capture zone "${zone.id}" has a non-positive radius.`);
    }
    if (zone.shape.kind === 'rect' && (zone.shape.width <= 0 || zone.shape.height <= 0)) {
      fail(`Capture zone "${zone.id}" has no area.`);
    }
  }

  const routeIds = new Set<string>();
  for (const route of document.routes ?? []) {
    if (routeIds.has(route.id)) fail(`Route requirement "${route.id}" is defined more than once.`);
    routeIds.add(route.id);
  }

  if ((document.towers ?? []).some((tower) => tower.blocking === true) && (document.routes ?? []).length === 0) {
    fail(
      'A blocking tower is defined but no route requirement is: nothing would stop a player ' +
        'from walling off the lane entirely.',
    );
  }
}

// --- Events --------------------------------------------------------------

export type DefenseEvent =
  | { readonly kind: 'tower-placed'; readonly instanceId: string; readonly definitionId: string; readonly cost: number }
  | { readonly kind: 'tower-upgraded'; readonly instanceId: string; readonly tier: number; readonly cost: number }
  | { readonly kind: 'tower-sold'; readonly instanceId: string; readonly refund: number }
  | { readonly kind: 'tower-fired'; readonly instanceId: string; readonly targetId: string }
  | { readonly kind: 'base-breached'; readonly baseId: string; readonly damage: number; readonly health: number }
  | { readonly kind: 'base-destroyed'; readonly baseId: string };

export type TerritoryEvent =
  | { readonly kind: 'zone-captured'; readonly zoneId: string; readonly owner: string }
  | { readonly kind: 'zone-contested'; readonly zoneId: string; readonly contested: boolean }
  | { readonly kind: 'score'; readonly teamId: string; readonly amount: number };

// --- Services ------------------------------------------------------------

/**
 * Frame advancement is absent from both interfaces, as in Phases 16, 19 and 20.
 * The pack owns `update(deltaMs)`; consumers observe through `drainEvents()`.
 */
export interface DefenseService {
  towers(): readonly TowerState[];
  tower(instanceId: string): TowerState | undefined;
  definitions(): readonly TowerDefinition[];
  funds(): number;

  /** Validate without committing - what a placement preview shows. */
  canPlace(definitionId: string, x: number, y: number): TowerPlacementResult;
  /** Validate again and commit. The re-check is not optional: the board moves. */
  place(definitionId: string, x: number, y: number): TowerPlacementResult;
  upgrade(instanceId: string): { readonly ok: boolean; readonly tier: number; readonly cost: number };
  sell(instanceId: string): { readonly ok: boolean; readonly refund: number };

  lanes(): readonly LaneDefinition[];
  bases(): readonly BaseState[];
  /** A leaker reached the objective. Applies the lane's base's breach damage. */
  breach(laneId: string): BaseState | undefined;

  /** Register a target the towers can see. Ids are the game's own entity ids. */
  setTargets(targets: readonly TargetCandidate[]): void;
  reset(): void;
  drainEvents(): readonly DefenseEvent[];
}

export interface TerritoryService {
  zones(): readonly CaptureZoneState[];
  zone(zoneId: string): CaptureZoneState | undefined;
  /** Who is standing where this frame. The game owns the units; this owns the zones. */
  setOccupants(occupants: readonly ZoneOccupant[]): void;
  score(teamId: string): number;
  scores(): Readonly<Record<string, number>>;
  reset(): void;
  drainEvents(): readonly TerritoryEvent[];
}
