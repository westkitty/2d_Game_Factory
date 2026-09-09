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
  PerceptionOutcome,
  PerceptionService,
  PerceptionVec,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicatePerceptionIdError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Perception pack: FOV cones, occlusion, suspicion, noise and hiding
 * (Category-C Wave 4). Definitions come from validated
 * `content/perception.json`. No Phaser, no wall clock, no RNG, no patrol AI.
 *
 * Deliberately not folded into `sw2d.ai`: that pack is a lightweight
 * agent-state store and explicitly is not vision geometry.
 */

interface LiveObserver {
  readonly def: PerceptionObserverDef;
  suspicion: number;
  alert: boolean;
  seesPlayer: boolean;
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

function inCone(observer: PerceptionObserverDef, px: number, py: number): { inRange: boolean; inFov: boolean; dist: number } {
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
  readonly #failOnAlert: boolean;
  readonly #lootAlarms: boolean;
  #px: number;
  #py: number;
  #collected = new Set<string>();
  #alarm = false;
  #hidden = false;
  #outcome: PerceptionOutcome = 'playing';
  #lastResult: string | null = null;

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
    this.#failOnAlert = this.#mode === 'infiltrate';
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
      this.#observers.push({ def: observer, suspicion: 0, alert: false, seesPlayer: false });
    }
    for (const occluder of this.#occluders) claim(occluder.id);
    for (const cover of this.#cover) claim(cover.id);
    for (const objective of this.#objectiveDefs) claim(objective.id);
    for (const exit of this.#exits) claim(exit.id);
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

  alarm(): boolean {
    return this.#alarm;
  }

  maxSuspicion(): number {
    let max = 0;
    for (const observer of this.#observers) if (observer.suspicion > max) max = observer.suspicion;
    return max;
  }

  observers(): readonly PerceptionObserverState[] {
    return this.#observers.map((o) => ({
      id: o.def.id,
      x: o.def.x,
      y: o.def.y,
      facingDeg: o.def.facingDeg,
      fovDeg: o.def.fovDeg,
      range: o.def.range,
      seesPlayer: o.seesPlayer,
      suspicion: o.suspicion,
      alert: o.alert,
    }));
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
    const dt = Math.max(0, deltaMs) / 1000;
    this.#hidden = this.#cover.some((c) => hypot(this.#px - c.x, this.#py - c.y) <= c.radius + this.#playerRadius);

    let spotted = false;
    for (const observer of this.#observers) {
      const { inRange, inFov } = inCone(observer.def, this.#px, this.#py);
      const occluded =
        inRange &&
        inFov &&
        this.#occluders.some((box) => segmentHitsAabb(observer.def.x, observer.def.y, this.#px, this.#py, box));
      const rawSee = inRange && inFov && !occluded;
      observer.seesPlayer = rawSee;
      const visibility = rawSee ? (this.#hidden ? this.#hiddenMultiplier : 1) : 0;
      if (visibility >= 1) {
        observer.suspicion = 1;
        observer.alert = true;
        spotted = true;
      } else if (visibility > 0) {
        observer.suspicion = clamp01(observer.suspicion + observer.def.suspicionRisePerSecond * visibility * dt);
        observer.alert = observer.suspicion >= 1;
      } else {
        observer.suspicion = clamp01(observer.suspicion - observer.def.suspicionDecayPerSecond * dt);
        observer.alert = observer.suspicion >= 1;
      }
      if (observer.alert) this.#alarm = true;
    }

    if (spotted) {
      this.#lastResult = this.#hidden ? 'hidden' : 'spotted';
      this.#events.emit('perception:spotted', { hidden: this.#hidden });
      if (this.#failOnAlert && !this.#hidden) {
        this.#outcome = 'failed';
        this.#lastResult = 'spotted';
        this.#events.emit('perception:alerted', { mode: this.#mode });
        return;
      }
    } else if (this.#hidden) {
      this.#lastResult = 'hidden';
    }

    if (this.#failOnAlert && this.#alarm && !this.#hidden && this.seen()) {
      this.#outcome = 'failed';
      this.#lastResult = 'spotted';
      this.#events.emit('perception:alerted', { mode: this.#mode });
      return;
    }

    for (const objective of this.#objectiveDefs) {
      if (this.#collected.has(objective.id)) continue;
      if (hypot(this.#px - objective.x, this.#py - objective.y) <= objective.radius + this.#playerRadius) {
        this.#collected.add(objective.id);
        this.#lastResult = 'looted';
        if (this.#lootAlarms) this.#alarm = true;
      }
    }

    if (this.objectiveCollected()) {
      for (const exit of this.#exits) {
        if (hypot(this.#px - exit.x, this.#py - exit.y) <= exit.radius + this.#playerRadius) {
          this.#outcome = 'complete';
          this.#lastResult = 'escaped';
          this.#events.emit('perception:escaped', { mode: this.#mode, alarm: this.#alarm });
          return;
        }
      }
    }
  }

  noise(amount: number): PerceptionActResult {
    if (this.#outcome !== 'playing') return { ok: false, reason: 'not-playing' };
    if (amount <= 0) return { ok: false, reason: 'idle' };
    for (const observer of this.#observers) {
      observer.suspicion = clamp01(observer.suspicion + amount);
      if (observer.suspicion >= 1) observer.alert = true;
    }
    this.#alarm = true;
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
    for (const observer of this.#observers) {
      observer.suspicion = 0;
      observer.alert = false;
      observer.seesPlayer = false;
    }
  }
}

export const perceptionPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.perception,
  version: '0.1.0',
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
