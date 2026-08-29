import type {
  EmitterDefinition,
  EncounterCatalog,
  EncounterCondition,
  EncounterDefinition,
  EncounterFireRequest,
  EncounterPhaseDefinition,
  EncounterService,
  EncounterSpawnRequest,
  EncounterState,
  EncounterTick,
  EncounterUpdateContext,
  EventBus,
  GameContext,
  InstalledSystemPack,
  SpawnPoint,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { expandFirePattern } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Encounters pack: the reusable layer above weapons/projectiles (capability
 * program Phase 4), publishing `combat.encounters`. Renderer-neutral: it
 * turns a validated `EncounterDefinition` into a per-tick stream of spawn and
 * fire requests plus deterministic phase transitions. `@sw2d/runtime`'s
 * `createEncounterRuntime` materialises the spawns and fires the patterns
 * through Phase 3's projectile runtime.
 */

const DEFAULT_HEALTH = 20;

export class UnknownEncounterError extends Error {
  constructor(id: string) {
    super(`No encounter defined with id "${id}" in content/encounters.json.`);
    this.name = 'UnknownEncounterError';
  }
}

function spawnPointAt(sp: SpawnPoint, index: number, total: number, view: { width: number; height: number }): { x: number; y: number } {
  const t = total <= 1 ? 0.5 : index / (total - 1);
  switch (sp.kind) {
    case 'point':
      return { x: sp.x, y: sp.y };
    case 'rect':
      return { x: sp.x + sp.width * t, y: sp.y + sp.height * t };
    case 'edge': {
      const m = 24;
      if (sp.edge === 'top') return { x: view.width * t, y: -m };
      if (sp.edge === 'bottom') return { x: view.width * t, y: view.height + m };
      if (sp.edge === 'left') return { x: -m, y: view.height * t };
      return { x: view.width + m, y: view.height * t };
    }
  }
}

interface EmitterRun {
  accMs: number;
  emissions: number;
}

class EncounterServiceImpl implements EncounterService {
  readonly #defs = new Map<string, EncounterDefinition>();
  readonly #events: EventBus;

  #def: EncounterDefinition | null = null;
  #phaseIndex = 0;
  #elapsedInPhaseMs = 0;
  #completed = false;
  /** requestIds spawned in the current phase. */
  readonly #spawnedKeys = new Set<string>();
  /** requestIds still alive. */
  readonly #liveSpawns = new Set<string>();
  /** emitter run state, keyed by `${emitterId}` (phase) or `${requestId}:${emitterId}` (entity). */
  readonly #emitterRuns = new Map<string, EmitterRun>();

  constructor(events: EventBus, catalog: EncounterCatalog | undefined) {
    this.#events = events;
    for (const def of catalog?.encounters ?? []) {
      if (this.#defs.has(def.id)) throw new Error(`Duplicate encounter id "${def.id}".`);
      this.#defs.set(def.id, def);
    }
  }

  lookup(id: string): EncounterDefinition | undefined {
    return this.#defs.get(id);
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  start(encounterId: string): void {
    const def = this.#defs.get(encounterId);
    if (!def) throw new UnknownEncounterError(encounterId);
    this.#def = def;
    this.#phaseIndex = 0;
    this.#elapsedInPhaseMs = 0;
    this.#completed = false;
    this.#spawnedKeys.clear();
    this.#liveSpawns.clear();
    this.#emitterRuns.clear();
    this.#events.emit('encounters:phaseChanged', { encounterId, phaseId: def.phases[0]?.id ?? null, phaseIndex: 0 });
  }

  stop(): void {
    this.#def = null;
    this.#completed = false;
    this.#spawnedKeys.clear();
    this.#liveSpawns.clear();
    this.#emitterRuns.clear();
  }

  reportDeath(requestId: string): void {
    this.#liveSpawns.delete(requestId);
  }

  state(): EncounterState {
    return {
      encounterId: this.#def?.id ?? null,
      phaseId: this.#def?.phases[this.#phaseIndex]?.id ?? null,
      phaseIndex: this.#phaseIndex,
      elapsedInPhaseMs: this.#elapsedInPhaseMs,
      liveSpawnCount: this.#liveSpawns.size,
      completed: this.#completed,
    };
  }

  update(deltaMs: number, ctx: EncounterUpdateContext): EncounterTick {
    const empty: EncounterTick = { spawns: [], fires: [], enteredPhaseId: null, completed: this.#completed };
    if (!this.#def || this.#completed) return empty;

    const phase = this.#def.phases[this.#phaseIndex];
    if (!phase) return empty;

    this.#elapsedInPhaseMs += deltaMs;
    const view = ctx.viewport();
    const spawns = this.#dueSpawns(phase, view);
    const fires = this.#dueFires(phase, deltaMs, ctx);

    let enteredPhaseId: string | null = null;
    if (this.#phaseComplete(phase, ctx)) {
      this.#phaseIndex += 1;
      this.#elapsedInPhaseMs = 0;
      this.#spawnedKeys.clear();
      this.#emitterRuns.clear();
      const next = this.#def.phases[this.#phaseIndex];
      if (next) {
        enteredPhaseId = next.id;
        this.#events.emit('encounters:phaseChanged', {
          encounterId: this.#def.id,
          phaseId: next.id,
          phaseIndex: this.#phaseIndex,
        });
      } else {
        this.#completed = true;
        this.#events.emit('encounters:completed', { encounterId: this.#def.id });
      }
    }

    return { spawns, fires, enteredPhaseId, completed: this.#completed };
  }

  #dueSpawns(phase: EncounterPhaseDefinition, view: { width: number; height: number }): EncounterSpawnRequest[] {
    const out: EncounterSpawnRequest[] = [];
    const groups = phase.spawns ?? [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]!;
      for (let mi = 0; mi < g.count; mi++) {
        const due = (g.startDelayMs ?? 0) + mi * (g.intervalMs ?? 0);
        const key = `${this.#def!.id}:${phase.id}:${gi}:${mi}`;
        if (this.#elapsedInPhaseMs < due || this.#spawnedKeys.has(key)) continue;
        this.#spawnedKeys.add(key);
        this.#liveSpawns.add(key);
        const pos = spawnPointAt(g.at, mi, g.count, view);
        out.push({
          requestId: key,
          archetype: g.archetype,
          x: pos.x,
          y: pos.y,
          health: g.health ?? DEFAULT_HEALTH,
          emitterIds: g.emitterIds ?? [],
          phaseId: phase.id,
        });
      }
    }
    return out;
  }

  #dueFires(phase: EncounterPhaseDefinition, deltaMs: number, ctx: EncounterUpdateContext): EncounterFireRequest[] {
    const out: EncounterFireRequest[] = [];
    const emitters = phase.emitters ?? [];
    const byId = new Map(emitters.map((e) => [e.id, e]));
    const carriedIds = new Set((phase.spawns ?? []).flatMap((g) => g.emitterIds ?? []));

    // Phase-level emitters: those no spawn group carries. Origin = boss.
    for (const e of emitters) {
      if (carriedIds.has(e.id)) continue;
      const fire = this.#tickEmitter(e, e.id, ctx.bossOrigin(), deltaMs, ctx, null);
      if (fire) out.push(fire);
    }
    // Entity-carried emitters: one run per (live entity, emitter id).
    for (const rid of this.#liveSpawns) {
      // The emitterIds carried are stored on the spawn key's group; recompute.
      const [, , giStr] = rid.split(':').slice(-3);
      const gi = Number(giStr);
      const carried = (phase.spawns ?? [])[gi]?.emitterIds ?? [];
      for (const eid of carried) {
        const e = byId.get(eid);
        const origin = ctx.originOf(rid);
        if (!e || !origin) continue;
        const fire = this.#tickEmitter(e, `${rid}:${eid}`, origin, deltaMs, ctx, rid);
        if (fire) out.push(fire);
      }
    }
    return out;
  }

  #tickEmitter(
    e: EmitterDefinition,
    runKey: string,
    origin: readonly [number, number],
    deltaMs: number,
    ctx: EncounterUpdateContext,
    sourceRequestId: string | null,
  ): EncounterFireRequest | null {
    if (this.#elapsedInPhaseMs < (e.startDelayMs ?? 0)) return null;
    const run = this.#emitterRuns.get(runKey) ?? { accMs: 0, emissions: 0 };
    if (e.maxEmissions !== undefined && run.emissions >= e.maxEmissions) {
      this.#emitterRuns.set(runKey, run);
      return null;
    }
    run.accMs += deltaMs;
    if (run.accMs < e.everyMs) {
      this.#emitterRuns.set(runKey, run);
      return null;
    }
    run.accMs -= e.everyMs;
    const emissionIndex = run.emissions;
    run.emissions += 1;
    this.#emitterRuns.set(runKey, run);

    const aim = ctx.aimAt(origin[0], origin[1]);
    return {
      emitterId: e.id,
      weaponId: e.weaponId,
      sourceRequestId,
      originX: origin[0],
      originY: origin[1],
      dirs: expandFirePattern(e.pattern, aim, emissionIndex),
    };
  }

  #phaseComplete(phase: EncounterPhaseDefinition, ctx: EncounterUpdateContext): boolean {
    return this.#conditionMet(phase, phase.completeWhen, ctx);
  }

  #conditionMet(phase: EncounterPhaseDefinition, c: EncounterCondition, ctx: EncounterUpdateContext): boolean {
    switch (c.kind) {
      case 'elapsed':
        return this.#elapsedInPhaseMs >= c.ms;
      case 'spawns-cleared': {
        const totalMembers = (phase.spawns ?? []).reduce((n, g) => n + g.count, 0);
        return this.#spawnedKeys.size >= totalMembers && this.#liveSpawns.size === 0;
      }
      case 'entity-health-below':
        return ctx.healthFraction(c.entityId) < c.fraction;
      case 'flag':
        return ctx.flag(c.flag) === (c.value ?? true);
    }
  }
}

export const encountersPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.encounters,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.encounters],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content.data['encounters']?.value as EncounterCatalog | undefined;
    const service = new EncounterServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.encounters, service);
    return {
      id: PACK_IDS.encounters,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { EncounterService } from '@sw2d/contracts';
