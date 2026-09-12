import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  NeedAction,
  NeedState,
  NeedsActResult,
  NeedsCatalog,
  NeedsMode,
  NeedsOutcome,
  NeedsService,
  NeedsSubject,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateNeedError, UnknownNeedError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Needs pack: decaying needs, care actions, affinity and a wellbeing
 * hold/fail (Category-C Wave 2). Definitions come from validated
 * `content/needs.json`. No Phaser, no wall clock, no RNG.
 *
 * Deliberately not folded into `sw2d.simulation`: that pack is a resource
 * ledger + timed-job primitive. This one owns care/decay/affinity semantics
 * that three creature recipes share. Not a colony / behaviour-AI pack.
 */

interface MutableNeed {
  readonly id: string;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly decayPerSecond: number;
  readonly initial: number;
  value: number;
}

class NeedsServiceImpl implements NeedsService {
  readonly #mode: NeedsMode;
  readonly #subject: NeedsSubject;
  readonly #needs: MutableNeed[] = [];
  readonly #needsById = new Map<string, MutableNeed>();
  readonly #actions: NeedAction[] = [];
  readonly #actionsById = new Map<string, NeedAction>();
  readonly #win: { minValue: number; holdMs: number; minActions: number };
  readonly #loseBelow: number | undefined;
  readonly #initialAffinity: number;
  readonly #events: EventBus;
  #affinity: number;
  #selected = 0;
  #holdMs = 0;
  #actionsTaken = 0;
  #outcome: NeedsOutcome = 'playing';
  #lastResult: string | null = null;

  constructor(events: EventBus, catalog: NeedsCatalog | undefined) {
    this.#events = events;
    this.#mode = catalog?.mode ?? 'creature';
    this.#subject = catalog?.subject ?? { id: 'none', displayName: 'None' };
    this.#win = catalog?.win ?? { minValue: 100, holdMs: 0, minActions: 0 };
    this.#loseBelow = catalog?.loseBelow;
    this.#initialAffinity = catalog?.affinity ?? 0;
    this.#affinity = this.#initialAffinity;
    for (const need of catalog?.needs ?? []) {
      if (this.#needsById.has(need.id)) throw new DuplicateNeedError(need.id);
      const live: MutableNeed = {
        id: need.id,
        displayName: need.displayName,
        min: need.min,
        max: need.max,
        decayPerSecond: need.decayPerSecond,
        initial: need.value,
        value: clamp(need.value, need.min, need.max),
      };
      this.#needs.push(live);
      this.#needsById.set(live.id, live);
    }
    for (const action of catalog?.actions ?? []) {
      if (this.#actionsById.has(action.id)) throw new DuplicateNeedError(action.id);
      for (const effect of action.effects) {
        if (!this.#needsById.has(effect.needId)) throw new UnknownNeedError(effect.needId);
      }
      this.#actions.push(action);
      this.#actionsById.set(action.id, action);
    }
  }

  mode(): NeedsMode {
    return this.#mode;
  }

  active(): boolean {
    return this.#needs.length > 0 && this.#actions.length > 0;
  }

  subject(): NeedsSubject {
    return this.#subject;
  }

  needs(): readonly NeedState[] {
    return this.#needs.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      value: n.value,
      min: n.min,
      max: n.max,
    }));
  }

  need(id: string): number {
    return this.#needsById.get(id)?.value ?? 0;
  }

  actions(): readonly NeedAction[] {
    return this.#actions;
  }

  selectedIndex(): number {
    return this.#selected;
  }

  selectByDelta(delta: number): number {
    const len = this.#actions.length;
    if (len === 0) {
      this.#selected = 0;
      return 0;
    }
    this.#selected = ((this.#selected + delta) % len + len) % len;
    return this.#selected;
  }

  act(actionId?: string): NeedsActResult {
    if (this.#outcome !== 'playing') {
      this.#lastResult = 'not-playing';
      return { ok: false, reason: 'not-playing', ...(actionId ? { actionId } : {}) };
    }
    if (this.#actions.length === 0) {
      this.#lastResult = 'no-actions';
      return { ok: false, reason: 'no-actions' };
    }
    const action = actionId ? this.#actionsById.get(actionId) : this.#actions[this.#selected];
    if (!action) {
      this.#lastResult = 'unknown-action';
      return { ok: false, reason: 'unknown-action', ...(actionId ? { actionId } : {}) };
    }
    for (const effect of action.effects) {
      const need = this.#needsById.get(effect.needId);
      if (!need) continue;
      need.value = clamp(need.value + effect.delta, need.min, need.max);
    }
    if (action.affinityDelta) this.#affinity += action.affinityDelta;
    this.#actionsTaken += 1;
    this.#lastResult = 'acted';
    this.#events.emit('needs:acted', { actionId: action.id, actionsTaken: this.#actionsTaken });
    this.#evaluateOutcome();
    return { ok: true, reason: 'acted', actionId: action.id };
  }

  actByIndex(index: number): NeedsActResult {
    const action = this.#actions[index];
    if (!action) {
      this.#lastResult = 'unknown-action';
      return { ok: false, reason: 'unknown-action' };
    }
    this.#selected = index;
    return this.act(action.id);
  }

  affinity(): number {
    return this.#affinity;
  }

  holdMs(): number {
    return this.#holdMs;
  }

  actionsTaken(): number {
    return this.#actionsTaken;
  }

  outcome(): NeedsOutcome {
    return this.#outcome;
  }

  lastResult(): string | null {
    return this.#lastResult;
  }

  reset(): void {
    for (const need of this.#needs) need.value = clamp(need.initial, need.min, need.max);
    this.#affinity = this.#initialAffinity;
    this.#selected = 0;
    this.#holdMs = 0;
    this.#actionsTaken = 0;
    this.#outcome = 'playing';
    this.#lastResult = null;
  }

  tick(deltaMs: number): void {
    if (this.#outcome !== 'playing') return;
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    if (dt === 0) {
      this.#evaluateOutcome();
      return;
    }
    const seconds = dt / 1000;
    for (const need of this.#needs) {
      need.value = clamp(need.value - need.decayPerSecond * seconds, need.min, need.max);
    }
    if (this.#allMet()) this.#holdMs += dt;
    else this.#holdMs = 0;
    this.#evaluateOutcome();
  }

  #allMet(): boolean {
    if (this.#needs.length === 0) return false;
    return this.#needs.every((n) => n.value >= this.#win.minValue);
  }

  #evaluateOutcome(): void {
    if (this.#outcome !== 'playing') return;
    if (this.#loseBelow !== undefined) {
      for (const need of this.#needs) {
        if (need.value <= this.#loseBelow) {
          this.#outcome = 'failed';
          this.#lastResult = 'failed';
          this.#events.emit('needs:failed', { subjectId: this.#subject.id });
          return;
        }
      }
    }
    if (this.#allMet() && this.#actionsTaken >= this.#win.minActions && this.#holdMs >= this.#win.holdMs) {
      this.#outcome = 'complete';
      this.#lastResult = 'complete';
      this.#events.emit('needs:completed', { subjectId: this.#subject.id });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export const needsPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.needs,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.needs],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['needs']?.value as NeedsCatalog | undefined;
    const service = new NeedsServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.needs, service);
    return {
      id: PACK_IDS.needs,
      update(deltaMs: number): void {
        service.tick(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { NeedsService };
