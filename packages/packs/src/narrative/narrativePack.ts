import type {
  DialogueCatalog,
  EventBus,
  GameContext,
  InstalledSystemPack,
  NarrativeParserDef,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Narrative pack: lightweight node/flag/choice/seen state plus a bounded,
 * catalog-authored parser for interactive-fiction starters. Rendering,
 * portraits and dialogue graphs remain outside this pack.
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
  parserActive(): boolean;
  submit(command: string): NarrativeCommandResult;
  transcript(): readonly string[];
  lastCommand(): string | null;
  lastText(): string;
  outcome(): 'playing' | 'complete';
  ending(): string | null;
  /** Scene-lifetime restart: the pack is game-lifetime. */
  reset(): void;
}

export interface NarrativeCommandResult {
  readonly ok: boolean;
  readonly reason: 'matched' | 'empty' | 'unknown-verb' | 'unknown-object' | 'blocked' | 'complete';
  readonly text: string;
  readonly commandId?: string;
  readonly objectId?: string;
  readonly indirectObjectId?: string;
}

class NarrativeServiceImpl implements NarrativeService {
  #node: string | null = null;
  readonly #flags = new Set<string>();
  readonly #seen = new Set<string>();
  readonly #choices = new Set<string>();
  readonly #events: EventBus;
  readonly #parser: NarrativeParserDef | undefined;
  #transcript: string[] = [];
  #lastCommand: string | null = null;
  #lastText = '';
  #outcome: 'playing' | 'complete' = 'playing';
  #ending: string | null = null;

  constructor(events: EventBus, parser?: NarrativeParserDef) {
    this.#events = events;
    this.#parser = parser;
    if (parser) {
      this.#node = parser.startNodeId;
      this.#lastText = parser.prompt;
    }
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

  parserActive(): boolean { return Boolean(this.#parser?.commands.length); }

  submit(input: string): NarrativeCommandResult {
    const parser = this.#parser;
    const normalized = input.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ');
    this.#lastCommand = normalized || null;
    if (!parser || normalized.length === 0) return this.#commandResult(false, 'empty', parser?.prompt ?? 'Enter a command.');
    if (this.#outcome === 'complete') return this.#commandResult(false, 'complete', this.#lastText);
    const words = normalized.split(' ');
    const verb = words[0]!;
    const verbCommands = parser.commands.filter((command) => command.verb === verb || command.aliases?.includes(verb));
    if (verbCommands.length === 0) return this.#commandResult(false, 'unknown-verb', parser.unknownVerb);
    const withIndex = words.findIndex((word) => word === 'with' || word === 'using');
    const directPhrase = words.slice(1, withIndex >= 0 ? withIndex : undefined).filter((word) => !['at', 'the', 'a', 'an'].includes(word)).join(' ');
    const indirectPhrase = withIndex >= 0 ? words.slice(withIndex + 1).filter((word) => !['the', 'a', 'an'].includes(word)).join(' ') : '';
    const resolve = (phrase: string): string | null => {
      if (!phrase) return null;
      const matches = parser.objects.filter((object) => [object.id, ...object.nouns, ...(object.aliases ?? [])].some((name) => name === phrase));
      return matches.length === 1 ? matches[0]!.id : null;
    };
    const objectId = resolve(directPhrase);
    const indirectObjectId = resolve(indirectPhrase);
    if ((directPhrase && !objectId) || (indirectPhrase && !indirectObjectId)) return this.#commandResult(false, 'unknown-object', parser.unknownObject);
    const shape = verbCommands.filter((command) => (command.objectId ?? null) === objectId && (command.indirectObjectId ?? null) === indirectObjectId);
    if (shape.length === 0) return this.#commandResult(false, 'unknown-object', parser.unknownObject);
    const command = shape.find((candidate) =>
      !(candidate.requireFlags ?? []).some((flag) => !this.#flags.has(flag)) &&
      !(candidate.forbidFlags ?? []).some((flag) => this.#flags.has(flag)),
    );
    if (!command) return this.#commandResult(false, 'blocked', parser.blocked, {
      ...(objectId ? { objectId } : {}),
      ...(indirectObjectId ? { indirectObjectId } : {}),
    });
    for (const flag of command.setFlags ?? []) this.setFlag(flag, true);
    for (const flag of command.clearFlags ?? []) this.setFlag(flag, false);
    this.#choices.add(command.id);
    this.#node = command.nodeId;
    this.#lastText = command.text;
    if (command.ending) {
      this.#ending = command.ending;
      this.#outcome = 'complete';
    }
    return this.#commandResult(true, 'matched', command.text, {
      commandId: command.id,
      ...(objectId ? { objectId } : {}),
      ...(indirectObjectId ? { indirectObjectId } : {}),
    });
  }

  transcript(): readonly string[] { return this.#transcript; }
  lastCommand(): string | null { return this.#lastCommand; }
  lastText(): string { return this.#lastText; }
  outcome(): 'playing' | 'complete' { return this.#outcome; }
  ending(): string | null { return this.#ending; }

  reset(): void {
    this.#node = null;
    this.#flags.clear();
    this.#seen.clear();
    this.#choices.clear();
    this.#transcript = [];
    this.#lastCommand = null;
    this.#lastText = this.#parser?.prompt ?? '';
    this.#outcome = 'playing';
    this.#ending = null;
    if (this.#parser) this.#node = this.#parser.startNodeId;
  }

  #commandResult(
    ok: boolean,
    reason: NarrativeCommandResult['reason'],
    text: string,
    detail: Partial<Pick<NarrativeCommandResult, 'commandId' | 'objectId' | 'indirectObjectId'>> = {},
  ): NarrativeCommandResult {
    const line = `${this.#lastCommand ? `> ${this.#lastCommand}\n` : ''}${text}`;
    this.#transcript = [...this.#transcript, line].slice(-8);
    this.#lastText = text;
    return { ok, reason, text, ...detail };
  }
}

export const narrativePack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.narrative,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.narrative],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const dialogue = context.content?.data?.['dialogue']?.value as DialogueCatalog | undefined;
    const service = new NarrativeServiceImpl(context.events, dialogue?.parser);
    const handle = context.capabilities.provide(CAPABILITY_IDS.narrative, service);

    return {
      id: PACK_IDS.narrative,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
