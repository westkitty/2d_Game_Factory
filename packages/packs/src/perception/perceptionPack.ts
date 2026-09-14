import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  PerceptionActResult,
  PerceptionCatalog,
  PerceptionCoverDef,
  PerceptionMarkerDef,
  PerceptionMode,
  PerceptionOccluderDef,
  PerceptionObserverDef,
  PerceptionObserverState,
  PerceptionObserverStateSnapshot,
  PerceptionOutcome,
  PerceptionService,
  PerceptionVec,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicatePerceptionIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Perception pack: FOV cones, occlusion, suspicion, noise, hiding, patrol
 * routes and the stealth observer state machine (Category-C Wave 4; the AI
 * added by the Final Product Completion program, Wave 2 - matrix L09).
 * Definitions come from validated `content/perception.json`. No Phaser, no
 * wall clock, no RNG. Observers move themselves along authored routes,
 * chase, investigate and return; the shell only draws them.
 *
 * Deliberately not folded into `sw2d.ai`: that pack is a lightweight
 * agent-state store and explicitly is not vision geometry.
 */

const DEFAULT_CHASE_SPEED = 90;
const DEFAULT_CATCH_RADIUS = 24;
const DEFAULT_MEMORY_MS = 1200;
const DEFAULT_INVESTIGATE_MS = 1500;
const DEFAULT_TAKEDOWN_RADIUS = 40;
const SUSPICIOUS_AT = 0.35;

interface LiveObserver {
  readonly def: PerceptionObserverDef;
  x: number;
  y: number;
  facingDeg: number;
  suspicion: number;
  alert: boolean;
  seesPlayer: boolean;
  state: PerceptionObserverState;
  waypoint: number;
  waitLeftMs: number;
  lastKnown: { x: number; y: number } | null;
  /** ms since the chaser last had clear sight. */
  lostForMs: number;
  investigateLeftMs: number;
}

function toDeg(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Move (x, y) toward the target by `step`, returning the remaining distance. */
function stepToward(o: LiveObserver, tx: number, ty: number, step: number): number {
  const dx = tx - o.x;
  const dy = ty - o.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1e-6) return 0;
  const move = Math.min(step, d);
  o.x += (dx / d) * move;
  o.y += (dy / d) * move;
  if (move > 0) o.facingDeg = toDeg(dx, dy);
  return d - move;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/** Liang–Barsky: true when the open segment from a→b crosses the AABB. */
function segmentHitsAabb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: PerceptionOccluderDef,
): boolean {
  const minX = box.x;
  const minY = box.y;
  const maxX = box.x + box.width;
  const maxY = box.y + box.height;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, x1 - minX)) return false;
  if (!clip(dx, maxX - x1)) return false;
  if (!clip(-dy, y1 - minY)) return false;
  if (!clip(dy, maxY - y1)) return false;
  return t0 < t1 && t1 > 0 && t0 < 1;
}

function inCone(observer: { x: number; y: number; facingDeg: number; fovDeg: number; range: number }, px: number, py: number): { inRange: boolean; inFov: boolean; dist: number } {
  const dx = px - observer.x;
  const dy = py - observer.y;
  const dist = hypot(dx, dy);
  if (dist > observer.range || dist <= 0) return { inRange: dist <= observer.range && dist > 0, inFov: false, dist };
  const facingRad = (observer.facingDeg * Math.PI) / 180;
  const fx = Math.cos(facingRad);
  const fy = Math.sin(facingRad);
  const dot = (dx * fx + dy * fy) / dist;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  const half = ((observer.fovDeg / 2) * Math.PI) / 180;
  return { inRange: true, inFov: angle <= half, dist };
}

class PerceptionServiceImpl implements PerceptionService {
  readonly #mode: PerceptionMode;
  readonly #start: PerceptionVec;
  readonly #playerRadius: number;
  readonly #hiddenMultiplier: number;
  readonly #observers: LiveObserver[] = [];
  readonly #occluders: PerceptionOccluderDef[];
  readonly #cover: PerceptionCoverDef[];
  readonly #objectiveDefs: PerceptionMarkerDef[];
  readonly #exits: PerceptionMarkerDef[];
  readonly #events: EventBus;
  readonly #lootAlarms: boolean;
  #px: number;
  #py: number;
  #collected = new Set<string>();
  #alarm = false;
  #hidden = false;
  #outcome: PerceptionOutcome = 'playing';
  #lastResult: string | null = null;
  #takedowns = 0;
  #transitions: { observerId: string; from: PerceptionObserverState; to: PerceptionObserverState }[] = [];

  constructor(events: EventBus, catalog: PerceptionCatalog | undefined) {
    this.#events = events;
    this.#mode = catalog?.mode ?? 'infiltrate';
    this.#start = catalog?.start ?? { x: 0, y: 0 };
    this.#playerRadius = catalog?.playerRadius ?? 14;
    this.#hiddenMultiplier = catalog?.hiddenMultiplier ?? 0.2;
    this.#occluders = [...(catalog?.occluders ?? [])];
    this.#cover = [...(catalog?.cover ?? [])];
    this.#objectiveDefs = [...(catalog?.objectives ?? [])];
    this.#exits = [...(catalog?.exits ?? [])];
    this.#lootAlarms = this.#mode === 'heist';
    this.#px = this.#start.x;
    this.#py = this.#start.y;
    const seen = new Set<string>();
    const claim = (id: string): void => {
      if (seen.has(id)) throw new DuplicatePerceptionIdError(id);
      seen.add(id);
    };
    for (const observer of catalog?.observers ?? []) {
      claim(observer.id);
      this.#observers.push(this.#spawn(observer));
    }
    for (const occluder of this.#occluders) claim(occluder.id);
    for (const cover of this.#cover) claim(cover.id);
    for (const objective of this.#objectiveDefs) claim(objective.id);
    for (const exit of this.#exits) claim(exit.id);
  }

  #spawn(def: PerceptionObserverDef): LiveObserver {
    return {
      def,
      x: def.x,
      y: def.y,
      facingDeg: def.facingDeg,
      suspicion: 0,
      alert: false,
      seesPlayer: false,
      state: 'patrol',
      waypoint: 0,
      waitLeftMs: 0,
      lastKnown: null,
      lostForMs: 0,
      investigateLeftMs: 0,
    };
  }

  #setState(o: LiveObserver, next: PerceptionObserverState): void {
    if (o.state === next) return;
    this.#transitions.push({ observerId: o.def.id, from: o.state, to: next });
    this.#events.emit('perception:stateChanged', { observerId: o.def.id, from: o.state, to: next });
    o.state = next;
  }

  mode(): PerceptionMode {
    return this.#mode;
  }

  active(): boolean {
    return this.#observers.length > 0;
  }

  start(): PerceptionVec {
    return this.#start;
  }

  playerRadius(): number {
    return this.#playerRadius;
  }

  setPlayer(x: number, y: number): void {
    this.#px = x;
    this.#py = y;
  }

  player(): PerceptionVec {
    return { x: this.#px, y: this.#py };
  }

  hidden(): boolean {
    return this.#hidden;
  }

  seen(): boolean {
    return this.#observers.some((o) => o.seesPlayer);
  }

  /** Sticky once loot / noise raised it; otherwise live while any observer is alert. */
  alarm(): boolean {
    return this.#alarm || this.#observers.some((o) => o.alert && o.state !== 'downed');
  }

  maxSuspicion(): number {
    let max = 0;
    for (const observer of this.#observers) if (observer.suspicion > max) max = observer.suspicion;
    return max;
  }

  observers(): readonly PerceptionObserverStateSnapshot[] {
    return this.#observers.map((o) => ({
      id: o.def.id,
      x: o.x,
      y: o.y,
      facingDeg: o.facingDeg,
      fovDeg: o.def.fovDeg,
      range: o.def.range,
      seesPlayer: o.seesPlayer,
      suspicion: o.suspicion,
      alert: o.alert,
      state: o.state,
      lastKnown: o.lastKnown ? { ...o.lastKnown } : null,
      patrolling: (o.def.patrol?.waypoints.length ?? 0) > 0,
    }));
  }

  takedowns(): number {
    return this.#takedowns;
  }

  transitions(): readonly { readonly observerId: string; readonly from: PerceptionObserverState; readonly to: PerceptionObserverState }[] {
    return this.#transitions;
  }

  takedown(): PerceptionActResult {
    if (this.#outcome !== 'playing') return { ok: false, reason: 'not-playing' };
    let best: LiveObserver | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const o of this.#observers) {
      if (o.state === 'downed') continue;
      const d = hypot(this.#px - o.x, this.#py - o.y);
      if (d > (o.def.takedownRadius ?? DEFAULT_TAKEDOWN_RADIUS)) continue;
      if (d < bestDist) {
        best = o;
        bestDist = d;
      }
    }
    if (!best) {
      this.#lastResult = 'no-target';
      return { ok: false, reason: 'no-target' };
    }
    if (best.seesPlayer || best.state === 'chase') {
      this.#lastResult = 'in-view';
      return { ok: false, reason: 'in-view' };
    }
    this.#setState(best, 'downed');
    best.seesPlayer = false;
    best.alert = false;
    best.suspicion = 0;
    this.#takedowns += 1;
    this.#lastResult = 'takedown';
    this.#events.emit('perception:takedown', { observerId: best.def.id, takedowns: this.#takedowns });
    return { ok: true, reason: 'takedown' };
  }

  occluders(): readonly PerceptionOccluderDef[] {
    return this.#occluders;
  }

  cover(): readonly PerceptionCoverDef[] {
    return this.#cover;
  }

  objectives(): readonly (PerceptionMarkerDef & { readonly collected: boolean })[] {
    return this.#objectiveDefs.map((o) => ({ ...o, collected: this.#collected.has(o.id) }));
  }

  exits(): readonly PerceptionMarkerDef[] {
    return this.#exits;
  }

  objectiveCollected(): boolean {
    return this.#objectiveDefs.length > 0 && this.#objectiveDefs.every((o) => this.#collected.has(o.id));
  }

  tick(deltaMs: number): void {
    if (this.#outcome !== 'playing') return;
    const ms = Math.max(0, deltaMs);
    const dt = ms / 1000;
    this.#hidden = this.#cover.some((c) => hypot(this.#px - c.x, this.#py - c.y) <= c.radius + this.#playerRadius);

    for (const o of this.#observers) {
      if (o.state === 'downed') {
        o.seesPlayer = false;
        continue;
      }
      const { inRange, inFov } = inCone({ x: o.x, y: o.y, facingDeg: o.facingDeg, fovDeg: o.def.fovDeg, range: o.def.range }, this.#px, this.#py);
      const occluded = inRange && inFov && this.#occluders.some((box) => segmentHitsAabb(o.x, o.y, this.#px, this.#py, box));
      const rawSee = inRange && inFov && !occluded;
      o.seesPlayer = rawSee;
      const visibility = rawSee ? (this.#hidden ? this.#hiddenMultiplier : 1) : 0;
      const chaseSpeed = o.def.chaseSpeed ?? DEFAULT_CHASE_SPEED;

      if (visibility >= 1) {
        o.suspicion = 1;
        o.alert = true;
        o.lastKnown = { x: this.#px, y: this.#py };
        o.lostForMs = 0;
        if (o.state !== 'chase') {
          this.#setState(o, 'chase');
          this.#lastResult = 'spotted';
          this.#events.emit('perception:spotted', { hidden: false });
        }
      } else if (visibility > 0) {
        o.suspicion = clamp01(o.suspicion + o.def.suspicionRisePerSecond * visibility * dt);
        if (o.state === 'patrol' && o.suspicion >= SUSPICIOUS_AT) {
          this.#setState(o, 'suspicious');
          this.#lastResult = 'hidden';
          this.#events.emit('perception:spotted', { hidden: true });
        }
        if (o.suspicion >= 1 && o.state !== 'chase') {
          o.alert = true;
          o.lastKnown = { x: this.#px, y: this.#py };
          o.investigateLeftMs = o.def.investigateMs ?? DEFAULT_INVESTIGATE_MS;
          this.#setState(o, 'investigate');
        }
      } else {
        o.suspicion = clamp01(o.suspicion - o.def.suspicionDecayPerSecond * dt);
        if (o.state === 'suspicious' && o.suspicion < SUSPICIOUS_AT * 0.5) this.#setState(o, 'patrol');
      }
      switch (o.state) {
        case 'patrol': {
          const route = o.def.patrol;
          if (!route || route.waypoints.length === 0) break;
          if (o.waitLeftMs > 0) {
            o.waitLeftMs = Math.max(0, o.waitLeftMs - ms);
            break;
          }
          const target = route.waypoints[o.waypoint % route.waypoints.length]!;
          const left = stepToward(o, target.x, target.y, route.speed * dt);
          if (left <= 0.5) {
            o.waypoint = (o.waypoint + 1) % route.waypoints.length;
            o.waitLeftMs = route.waitMs;
          }
          break;
        }
        case 'suspicious': {
          // Turn toward the player and hold position.
          o.facingDeg = toDeg(this.#px - o.x, this.#py - o.y);
          break;
        }
        case 'chase': {
          if (visibility >= 1) {
            const d = stepToward(o, this.#px, this.#py, chaseSpeed * dt);
            if (d <= (o.def.catchRadius ?? DEFAULT_CATCH_RADIUS)) {
              this.#outcome = 'failed';
              this.#lastResult = 'caught';
              this.#events.emit('perception:caught', { observerId: o.def.id, mode: this.#mode });
              this.#events.emit('perception:alerted', { mode: this.#mode });
              return;
            }
          } else {
            o.lostForMs += ms;
            if (o.lastKnown) stepToward(o, o.lastKnown.x, o.lastKnown.y, chaseSpeed * dt);
            if (o.lostForMs >= (o.def.memoryMs ?? DEFAULT_MEMORY_MS)) {
              o.investigateLeftMs = o.def.investigateMs ?? DEFAULT_INVESTIGATE_MS;
              this.#setState(o, 'investigate');
              this.#lastResult = 'lost';
            }
          }
          break;
        }
        case 'investigate': {
          const target = o.lastKnown;
          const left = target ? stepToward(o, target.x, target.y, chaseSpeed * dt) : 0;
          if (left <= 2) {
            o.investigateLeftMs = Math.max(0, o.investigateLeftMs - ms);
            // Look around while waiting.
            o.facingDeg = (o.facingDeg + 120 * dt) % 360;
            if (o.investigateLeftMs === 0) {
              o.alert = false;
              o.suspicion = 0;
              o.lastKnown = null;
              this.#setState(o, 'return');
            }
          }
          break;
        }
        case 'return': {
          const route = o.def.patrol;
          const home = route && route.waypoints.length > 0 ? route.waypoints[o.waypoint % route.waypoints.length]! : { x: o.def.x, y: o.def.y };
          const left = stepToward(o, home.x, home.y, chaseSpeed * dt);
          if (left <= 1) {
            if (!route || route.waypoints.length === 0) o.facingDeg = o.def.facingDeg;
            this.#setState(o, 'patrol');
          }
          break;
        }
        default:
          break;
      }
    }

    if (this.#hidden && this.#lastResult !== 'spotted') this.#lastResult = 'hidden';

    for (const objective of this.#objectiveDefs) {
      if (this.#collected.has(objective.id)) continue;
      if (hypot(this.#px - objective.x, this.#py - objective.y) <= objective.radius + this.#playerRadius) {
        this.#collected.add(objective.id);
        this.#lastResult = 'looted';
        if (this.#lootAlarms) {
          this.#alarm = true;
          this.#sendToInvestigate(objective.x, objective.y);
        }
      }
    }

    if (this.objectiveCollected()) {
      for (const exit of this.#exits) {
        if (hypot(this.#px - exit.x, this.#py - exit.y) <= exit.radius + this.#playerRadius) {
          this.#outcome = 'complete';
          this.#lastResult = 'escaped';
          this.#events.emit('perception:escaped', { mode: this.#mode, alarm: this.alarm() });
          return;
        }
      }
    }
  }

  /** Every standing observer that is not already chasing goes to look at (x, y). */
  #sendToInvestigate(x: number, y: number): void {
    for (const o of this.#observers) {
      if (o.state === 'downed' || o.state === 'chase') continue;
      o.lastKnown = { x, y };
      o.investigateLeftMs = o.def.investigateMs ?? DEFAULT_INVESTIGATE_MS;
      o.alert = true;
      o.suspicion = Math.max(o.suspicion, SUSPICIOUS_AT);
      this.#setState(o, 'investigate');
    }
  }

  noise(amount: number): PerceptionActResult {
    if (this.#outcome !== 'playing') return { ok: false, reason: 'not-playing' };
    if (amount <= 0) return { ok: false, reason: 'idle' };
    for (const observer of this.#observers) {
      if (observer.state === 'downed') continue;
      observer.suspicion = clamp01(observer.suspicion + amount);
      if (observer.suspicion >= 1) observer.alert = true;
    }
    this.#alarm = true;
    this.#sendToInvestigate(this.#px, this.#py);
    this.#lastResult = 'alarmed';
    return { ok: true, reason: 'alarmed' };
  }

  outcome(): PerceptionOutcome {
    return this.#outcome;
  }

  lastResult(): string | null {
    return this.#lastResult;
  }

  reset(): void {
    this.#px = this.#start.x;
    this.#py = this.#start.y;
    this.#collected = new Set();
    this.#alarm = false;
    this.#hidden = false;
    this.#outcome = 'playing';
    this.#lastResult = null;
    this.#takedowns = 0;
    this.#transitions = [];
    for (let i = 0; i < this.#observers.length; i++) this.#observers[i] = this.#spawn(this.#observers[i]!.def);
  }
}

export const perceptionPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.perception,
  version: '0.2.0',
  provides: [CAPABILITY_IDS.perception],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['perception']?.value as PerceptionCatalog | undefined;
    const service = new PerceptionServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.perception, service);
    return {
      id: PACK_IDS.perception,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { PerceptionService };
