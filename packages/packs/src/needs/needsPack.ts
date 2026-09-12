import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  NeedAction,
  NeedState,
  NeedsActResult,
  NeedsActivityDefinition,
  NeedsCatalog,
  NeedsCreatureState,
  NeedsMode,
  NeedsOutcome,
  NeedsRelationshipState,
  NeedsService,
  NeedsSubject,
  SaveLoadOutcome,
  SaveStore,
  SystemPackDefinition,
  VersionedRecord,
} from '@sw2d/contracts';
import { DuplicateNeedError, UnknownNeedError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/** Deterministic creature autonomy layered onto the existing care/decay owner. */
export const NEEDS_SAVE_SLOT = 'needs';
const SAVE_VERSION = 1;

interface MutableNeed {
  readonly id: string;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly decayPerSecond: number;
  readonly initial: number;
  value: number;
}

interface MutableCreature {
  readonly id: string;
  readonly displayName: string;
  readonly initialX: number;
  readonly initialY: number;
  readonly speed: number;
  readonly needs: MutableNeed[];
  readonly needsById: Map<string, MutableNeed>;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  activity: NeedsActivityDefinition | null;
  activityMs: number;
  decisionMs: number;
  decisions: number;
}

interface MutableRelationship {
  readonly a: string;
  readonly b: string;
  readonly initial: number;
  readonly gainPerSecond: number;
  readonly max: number;
  affinity: number;
}

interface NeedsSave extends VersionedRecord {
  readonly creatures: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly activityId: string | null;
    readonly activityMs: number;
    readonly decisions: number;
    readonly needs: Readonly<Record<string, number>>;
  }[];
  readonly relationships: readonly { readonly a: string; readonly b: string; readonly affinity: number }[];
  readonly affinity: number;
  readonly actionsTaken: number;
  readonly holdMs: number;
  readonly outcome: NeedsOutcome;
}

class NeedsServiceImpl implements NeedsService {
  readonly #mode: NeedsMode;
  readonly #subject: NeedsSubject;
  readonly #actions: NeedAction[] = [];
  readonly #actionsById = new Map<string, NeedAction>();
  readonly #activities: readonly NeedsActivityDefinition[];
  readonly #activityById: ReadonlyMap<string, NeedsActivityDefinition>;
  readonly #creatures: MutableCreature[] = [];
  readonly #relationships: MutableRelationship[] = [];
  readonly #win: { minValue: number; holdMs: number; minActions: number };
  readonly #loseBelow: number | undefined;
  readonly #initialAffinity: number;
  readonly #events: EventBus;
  readonly #saves: SaveStore | undefined;
  readonly #decisionIntervalMs: number;
  readonly #loadOutcome: SaveLoadOutcome;
  #affinity: number;
  #selected = 0;
  #selectedCreature = 0;
  #holdMs = 0;
  #actionsTaken = 0;
  #outcome: NeedsOutcome = 'playing';
  #lastResult: string | null = null;
  #persistElapsed = 0;

  constructor(events: EventBus, catalog: NeedsCatalog | undefined, saves: SaveStore | undefined) {
    this.#events = events;
    this.#mode = catalog?.mode ?? 'creature';
    this.#subject = catalog?.subject ?? { id: 'none', displayName: 'None' };
    this.#win = catalog?.win ?? { minValue: 100, holdMs: 0, minActions: 0 };
    this.#loseBelow = catalog?.loseBelow;
    this.#initialAffinity = catalog?.affinity ?? 0;
    this.#affinity = this.#initialAffinity;
    this.#activities = catalog?.activities ?? [];
    this.#activityById = new Map(this.#activities.map((activity) => [activity.id, activity]));
    this.#decisionIntervalMs = Math.max(50, catalog?.decisionIntervalMs ?? 500);
    this.#saves = catalog?.persist === true ? saves : undefined;

    const definitions = catalog?.creatures?.length
      ? catalog.creatures
      : catalog?.needs.length
        ? [{ ...this.#subject, x: 0, y: 0 }]
        : [];
    const ids = new Set<string>();
    for (const definition of definitions) {
      if (ids.has(definition.id)) throw new DuplicateNeedError(definition.id);
      ids.add(definition.id);
      const needs: MutableNeed[] = [];
      const needsById = new Map<string, MutableNeed>();
      for (const need of catalog?.needs ?? []) {
        if (needsById.has(need.id)) throw new DuplicateNeedError(need.id);
        const initial = definition.needValues?.[need.id] ?? need.value;
        const live: MutableNeed = {
          id: need.id,
          displayName: need.displayName,
          min: need.min,
          max: need.max,
          decayPerSecond: need.decayPerSecond,
          initial,
          value: clamp(initial, need.min, need.max),
        };
        needs.push(live);
        needsById.set(live.id, live);
      }
      this.#creatures.push({
        id: definition.id,
        displayName: definition.displayName,
        initialX: definition.x,
        initialY: definition.y,
        speed: definition.speed ?? 80,
        needs,
        needsById,
        x: definition.x,
        y: definition.y,
        targetX: definition.x,
        targetY: definition.y,
        activity: null,
        activityMs: 0,
        decisionMs: 0,
        decisions: 0,
      });
    }
    for (const activity of this.#activities) {
      if (activity.needId && !(catalog?.needs ?? []).some((need) => need.id === activity.needId)) throw new UnknownNeedError(activity.needId);
    }
    for (const action of catalog?.actions ?? []) {
      if (this.#actionsById.has(action.id)) throw new DuplicateNeedError(action.id);
      for (const effect of action.effects) {
        if (!(catalog?.needs ?? []).some((need) => need.id === effect.needId)) throw new UnknownNeedError(effect.needId);
      }
      this.#actions.push(action);
      this.#actionsById.set(action.id, action);
    }
    for (const relationship of catalog?.relationships ?? []) {
      if (!ids.has(relationship.a)) throw new UnknownNeedError(relationship.a);
      if (!ids.has(relationship.b)) throw new UnknownNeedError(relationship.b);
      this.#relationships.push({
        a: relationship.a,
        b: relationship.b,
        initial: relationship.affinity,
        affinity: relationship.affinity,
        gainPerSecond: relationship.gainPerSecond ?? 0,
        max: relationship.max ?? 100,
      });
    }

    if (this.#saves) {
      const loaded = this.#saves.load<NeedsSave>(NEEDS_SAVE_SLOT, { currentVersion: SAVE_VERSION, createDefault: () => this.#saveRecord() });
      this.#loadOutcome = loaded.outcome;
      if (loaded.outcome === 'loaded') this.#restore(loaded.value);
    } else this.#loadOutcome = 'unavailable';
    for (const creature of this.#creatures) this.#decide(creature);
  }

  mode(): NeedsMode { return this.#mode; }
  active(): boolean { return this.#creatures.length > 0 && this.#actions.length > 0; }
  subject(): NeedsSubject { return this.#subject; }
  needs(): readonly NeedState[] { return this.#stateFor(this.#currentCreature()); }
  need(id: string): number { return this.#currentCreature()?.needsById.get(id)?.value ?? 0; }
  actions(): readonly NeedAction[] { return this.#actions; }
  creatures(): readonly NeedsCreatureState[] {
    return this.#creatures.map((creature) => ({
      id: creature.id,
      displayName: creature.displayName,
      x: creature.x,
      y: creature.y,
      targetX: creature.targetX,
      targetY: creature.targetY,
      activityId: creature.activity?.id ?? null,
      activityName: creature.activity?.displayName ?? null,
      decisions: creature.decisions,
      needs: this.#stateFor(creature),
    }));
  }
  relationships(): readonly NeedsRelationshipState[] { return this.#relationships.map(({ a, b, affinity }) => ({ a, b, affinity })); }
  selectedCreatureIndex(): number { return this.#selectedCreature; }
  selectCreatureByDelta(delta: number): number {
    if (this.#creatures.length === 0) return 0;
    this.#selectedCreature = wrap(this.#selectedCreature + delta, this.#creatures.length);
    return this.#selectedCreature;
  }
  selectedIndex(): number { return this.#selected; }
  selectByDelta(delta: number): number {
    if (this.#actions.length === 0) return (this.#selected = 0);
    this.#selected = wrap(this.#selected + delta, this.#actions.length);
    return this.#selected;
  }

  act(actionId?: string): NeedsActResult {
    if (this.#outcome !== 'playing') return this.#reject('not-playing', actionId);
    if (this.#actions.length === 0) return this.#reject('no-actions');
    const action = actionId ? this.#actionsById.get(actionId) : this.#actions[this.#selected];
    if (!action) return this.#reject('unknown-action', actionId);
    const current = this.#currentCreature();
    const targets = this.#mode === 'habitat' ? this.#creatures : current ? [current] : [];
    for (const creature of targets) {
      for (const effect of action.effects) {
        const need = creature.needsById.get(effect.needId);
        if (need) need.value = clamp(need.value + effect.delta, need.min, need.max);
      }
      creature.decisionMs = this.#decisionIntervalMs;
    }
    if (action.affinityDelta) {
      this.#affinity += action.affinityDelta;
      const currentId = current?.id;
      for (const relationship of this.#relationships) {
        if (relationship.a === currentId || relationship.b === currentId) relationship.affinity = clamp(relationship.affinity + action.affinityDelta, 0, relationship.max);
      }
    }
    this.#actionsTaken += 1;
    this.#lastResult = 'acted';
    this.#events.emit('needs:acted', { actionId: action.id, actionsTaken: this.#actionsTaken });
    this.#evaluateOutcome();
    this.#persist();
    return { ok: true, reason: 'acted', actionId: action.id };
  }
  actByIndex(index: number): NeedsActResult {
    const action = this.#actions[index];
    if (!action) return this.#reject('unknown-action');
    this.#selected = index;
    return this.act(action.id);
  }
  affinity(): number { return this.#affinity; }
  holdMs(): number { return this.#holdMs; }
  actionsTaken(): number { return this.#actionsTaken; }
  outcome(): NeedsOutcome { return this.#outcome; }
  lastResult(): string | null { return this.#lastResult; }
  loadOutcome(): string { return this.#loadOutcome; }

  reset(): void {
    for (const creature of this.#creatures) {
      for (const need of creature.needs) need.value = clamp(need.initial, need.min, need.max);
      creature.x = creature.initialX;
      creature.y = creature.initialY;
      creature.targetX = creature.initialX;
      creature.targetY = creature.initialY;
      creature.activity = null;
      creature.activityMs = 0;
      creature.decisionMs = 0;
      creature.decisions = 0;
      this.#decide(creature);
    }
    for (const relationship of this.#relationships) relationship.affinity = relationship.initial;
    this.#affinity = this.#initialAffinity;
    this.#selected = 0;
    this.#selectedCreature = 0;
    this.#holdMs = 0;
    this.#actionsTaken = 0;
    this.#outcome = 'playing';
    this.#lastResult = null;
    this.#saves?.clear(NEEDS_SAVE_SLOT);
  }

  tick(deltaMs: number): void {
    if (this.#outcome !== 'playing') return;
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    if (dt === 0) return this.#evaluateOutcome();
    const seconds = dt / 1000;
    for (const creature of this.#creatures) {
      for (const need of creature.needs) need.value = clamp(need.value - need.decayPerSecond * seconds, need.min, need.max);
      creature.decisionMs += dt;
      creature.activityMs += dt;
      if (!creature.activity || creature.decisionMs >= this.#decisionIntervalMs || creature.activityMs >= creature.activity.durationMs) this.#decide(creature);
      const dx = creature.targetX - creature.x;
      const dy = creature.targetY - creature.y;
      const distance = Math.hypot(dx, dy);
      const step = creature.speed * seconds;
      if (distance <= step || distance === 0) {
        creature.x = creature.targetX;
        creature.y = creature.targetY;
      } else {
        creature.x += (dx / distance) * step;
        creature.y += (dy / distance) * step;
      }
    }
    for (const relationship of this.#relationships) {
      const a = this.#creatures.find((creature) => creature.id === relationship.a);
      const b = this.#creatures.find((creature) => creature.id === relationship.b);
      if (a && b && Math.hypot(a.x - b.x, a.y - b.y) <= 140) relationship.affinity = clamp(relationship.affinity + relationship.gainPerSecond * seconds, 0, relationship.max);
    }
    if (this.#allMet()) this.#holdMs += dt;
    else this.#holdMs = 0;
    this.#evaluateOutcome();
    this.#persistElapsed += dt;
    if (this.#persistElapsed >= 500) { this.#persistElapsed = 0; this.#persist(); }
  }

  #currentCreature(): MutableCreature | undefined { return this.#creatures[this.#selectedCreature]; }
  #stateFor(creature: MutableCreature | undefined): NeedState[] {
    return creature?.needs.map(({ id, displayName, value, min, max }) => ({ id, displayName, value, min, max })) ?? [];
  }
  #reject(reason: NeedsActResult['reason'], actionId?: string): NeedsActResult {
    this.#lastResult = reason;
    return { ok: false, reason, ...(actionId ? { actionId } : {}) };
  }
  #decide(creature: MutableCreature): void {
    const triggered = this.#activities
      .filter((activity) => activity.needId && creature.needsById.get(activity.needId)!.value < (activity.below ?? Number.POSITIVE_INFINITY))
      .sort((a, b) => {
        const an = creature.needsById.get(a.needId!)!;
        const bn = creature.needsById.get(b.needId!)!;
        const ad = (an.value - an.min) / Math.max(1, an.max - an.min);
        const bd = (bn.value - bn.min) / Math.max(1, bn.max - bn.min);
        return ad - bd || a.id.localeCompare(b.id);
      });
    const fallback = this.#activities.filter((activity) => !activity.needId);
    const chosen = triggered[0] ?? fallback[(creature.decisions + this.#creatures.indexOf(creature)) % Math.max(1, fallback.length)] ?? null;
    creature.activity = chosen;
    creature.targetX = chosen?.targetX ?? creature.x;
    creature.targetY = chosen?.targetY ?? creature.y;
    creature.activityMs = 0;
    creature.decisionMs = 0;
    creature.decisions += 1;
  }
  #allMet(): boolean {
    return this.#creatures.length > 0 && this.#creatures.every((creature) => creature.needs.every((need) => need.value >= this.#win.minValue));
  }
  #evaluateOutcome(): void {
    if (this.#outcome !== 'playing') return;
    if (this.#loseBelow !== undefined && this.#creatures.some((creature) => creature.needs.some((need) => need.value <= this.#loseBelow!))) {
      this.#outcome = 'failed';
      this.#lastResult = 'failed';
      this.#events.emit('needs:failed', { subjectId: this.#subject.id });
      this.#persist();
      return;
    }
    if (this.#allMet() && this.#actionsTaken >= this.#win.minActions && this.#holdMs >= this.#win.holdMs) {
      this.#outcome = 'complete';
      this.#lastResult = 'complete';
      this.#events.emit('needs:completed', { subjectId: this.#subject.id });
      this.#persist();
    }
  }
  #saveRecord(): NeedsSave {
    return {
      schemaVersion: SAVE_VERSION,
      creatures: this.#creatures.map((creature) => ({
        id: creature.id,
        x: creature.x,
        y: creature.y,
        activityId: creature.activity?.id ?? null,
        activityMs: creature.activityMs,
        decisions: creature.decisions,
        needs: Object.fromEntries(creature.needs.map((need) => [need.id, need.value])),
      })),
      relationships: this.#relationships.map(({ a, b, affinity }) => ({ a, b, affinity })),
      affinity: this.#affinity,
      actionsTaken: this.#actionsTaken,
      holdMs: this.#holdMs,
      outcome: this.#outcome,
    };
  }
  #restore(save: NeedsSave): void {
    for (const stored of save.creatures ?? []) {
      const creature = this.#creatures.find((candidate) => candidate.id === stored.id);
      if (!creature) continue;
      creature.x = Number.isFinite(stored.x) ? stored.x : creature.x;
      creature.y = Number.isFinite(stored.y) ? stored.y : creature.y;
      creature.activity = stored.activityId ? this.#activityById.get(stored.activityId) ?? null : null;
      creature.activityMs = Number.isFinite(stored.activityMs) ? stored.activityMs : 0;
      creature.decisions = Number.isFinite(stored.decisions) ? stored.decisions : 0;
      for (const need of creature.needs) {
        const value = stored.needs?.[need.id];
        if (Number.isFinite(value)) need.value = clamp(value!, need.min, need.max);
      }
    }
    for (const stored of save.relationships ?? []) {
      const relationship = this.#relationships.find((candidate) => candidate.a === stored.a && candidate.b === stored.b);
      if (relationship && Number.isFinite(stored.affinity)) relationship.affinity = clamp(stored.affinity, 0, relationship.max);
    }
    if (Number.isFinite(save.affinity)) this.#affinity = save.affinity;
    if (Number.isFinite(save.actionsTaken)) this.#actionsTaken = Math.max(0, Math.floor(save.actionsTaken));
    if (Number.isFinite(save.holdMs)) this.#holdMs = Math.max(0, save.holdMs);
    if (save.outcome === 'playing' || save.outcome === 'complete' || save.outcome === 'failed') this.#outcome = save.outcome;
  }
  #persist(): void { this.#saves?.save(NEEDS_SAVE_SLOT, this.#saveRecord()); }
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function wrap(value: number, length: number): number { return ((value % length) + length) % length; }

export const needsPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.needs,
  version: '0.2.0',
  provides: [CAPABILITY_IDS.needs],
  dependencies: [],
  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['needs']?.value as NeedsCatalog | undefined;
    const service = new NeedsServiceImpl(context.events, catalog, context.saves);
    const restart = context.events.on('run:restarted', () => service.reset());
    const handle = context.capabilities.provide(CAPABILITY_IDS.needs, service);
    return {
      id: PACK_IDS.needs,
      update(deltaMs: number): void { service.tick(deltaMs); },
      dispose(): void { restart.dispose(); handle.dispose(); },
    };
  },
};

export type { NeedsService };
