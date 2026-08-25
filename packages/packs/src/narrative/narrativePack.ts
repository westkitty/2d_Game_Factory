import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Narrative pack: lightweight state for later visual novel/adventure
 * systems - current node, flags, choice transitions, seen/codex entries. No
 * scripting language, renderer, portrait system, dialogue graph loader,
 * localization platform or quest framework here.
 */

export interface NarrativeService {
  currentNode(): string | null;
  goTo(nodeId: string): void;
  /** No-op (no event) if `value` already equals the flag's current value. */
  setFlag(flag: string, value: boolean): void;
  hasFlag(flag: string): boolean;
  /** Records that `choiceId` was made, then transitions to `resultNodeId`. */
  choose(choiceId: string, resultNodeId: string): void;
  markSeen(entryId: string): void;
  hasSeen(entryId: string): boolean;
  seenEntries(): readonly string[];
  chosenChoices(): readonly string[];
}

class NarrativeServiceImpl implements NarrativeService {
  #node: string | null = null;
  readonly #flags = new Set<string>();
  readonly #seen = new Set<string>();
  readonly #choices = new Set<string>();
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  currentNode(): string | null {
    return this.#node;
  }

  goTo(nodeId: string): void {
    this.#node = nodeId;
  }

  setFlag(flag: string, value: boolean): void {
    const had = this.#flags.has(flag);
    if (had === value) return;
    if (value) this.#flags.add(flag);
    else this.#flags.delete(flag);
    this.#events.emit('narrative:flagChanged', { flag, value });
  }

  hasFlag(flag: string): boolean {
    return this.#flags.has(flag);
  }

  choose(choiceId: string, resultNodeId: string): void {
    this.#choices.add(choiceId);
    this.goTo(resultNodeId);
  }

  markSeen(entryId: string): void {
    this.#seen.add(entryId);
  }

  hasSeen(entryId: string): boolean {
    return this.#seen.has(entryId);
  }

  seenEntries(): readonly string[] {
    return [...this.#seen].sort();
  }

  chosenChoices(): readonly string[] {
    return [...this.#choices].sort();
  }
}

export const narrativePack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.narrative,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.narrative],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new NarrativeServiceImpl(context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.narrative, service);

    return {
      id: PACK_IDS.narrative,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
