import type {
  AppliedEffects,
  CharacterDefinition,
  ChoiceOption,
  DialogueChoice,
  DialogueDocument,
  DialogueEffect,
  DialogueEffectKind,
  DialogueEvent,
  DialogueHistory,
  DialogueLine,
  DialogueNode,
  DialogueSaveState,
  DialogueService,
  DialogueStatus,
  DialogueView,
  DialogueWorldView,
  EventBus,
  GameContext,
  InstalledSystemPack,
  ItemsService,
  SkippedDialogueEffect,
  SystemPackDefinition,
} from '@sw2d/contracts';
import {
  DIALOGUE_EFFECT_CAPABILITY,
  EMPTY_DIALOGUE_HISTORY,
  IDLE_DIALOGUE_VIEW,
  evaluateConditions,
  portraitRoleFor,
  validateDialogueDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { NarrativeService } from '../narrative/narrativePack.ts';
import type { ProgressionService } from '../progression/progressionPack.ts';
import type { WorldService } from '../world/worldPack.ts';
import dialogueConfigSchema from '../../schemas/dialogue-config.schema.json' with { type: 'json' };

export const DIALOGUE_CONFIG_SCHEMA_ID = dialogueConfigSchema.$id;
registerSchema(dialogueConfigSchema);

/**
 * Dialogue pack (post-ten program Phase 20).
 *
 * Walks an authored dialogue graph and reports where it is. It renders nothing
 * - the DOM presentation lives in `@sw2d/runtime`, because the accessibility
 * requirements (semantic text available immediately, real focus management) are
 * genuinely browser concerns and a renderer-neutral contract cannot meet them.
 *
 * Every effect writes through the capability that owns the state it touches:
 * narrative flags to `narrative.state`, world flags to `world.state`, items to
 * `items.state`, currency/xp/unlocks to `progression.state`. A missing owner
 * skips the effect and **says so** by name rather than failing silently, so a
 * game that forgot to install `sw2d.items` finds out from the effect report
 * rather than from a player noticing they never got the key.
 */

export interface DialogueConfig {
  /** Content document name. Default `dialogue`. */
  readonly documentName?: string;
}

export class MissingDialogueDocumentError extends Error {
  constructor(documentName: string) {
    super(
      `sw2d.dialogue requires a "${documentName}" content document. Author content/dialogue.json ` +
        '(urn:sw2d:schema:content-dialogue:v1).',
    );
    this.name = 'MissingDialogueDocumentError';
  }
}

export class UnknownDialogueNodeError extends Error {
  constructor(nodeId: string) {
    super(`Unknown dialogue node: "${nodeId}".`);
    this.name = 'UnknownDialogueNodeError';
  }
}

/**
 * The capability owners an effect may need. Any of them may legitimately be absent.
 *
 * `items` is narrowed to the three methods a dialogue actually touches rather
 * than the whole `ItemsService`: a line of dialogue has no business calling
 * `consume()` with a combat target, and requiring the full interface would
 * force every caller to supply methods this never reaches.
 */
export interface DialogueDependencies {
  readonly narrative?: NarrativeService;
  readonly world?: WorldService;
  readonly items?: Pick<ItemsService, 'count' | 'grant' | 'remove'>;
  readonly progression?: ProgressionService;
}

export class DialogueServiceImpl implements DialogueService {
  readonly #document: DialogueDocument;
  readonly #nodes = new Map<string, DialogueNode>();
  readonly #characters = new Map<string, CharacterDefinition>();
  readonly #deps: DialogueDependencies;
  readonly #events: EventBus | undefined;

  #nodeId: string | null = null;
  #lineIndex = 0;
  #status: DialogueStatus = 'idle';

  #nodeVisits = new Map<string, number>();
  #lineViews = new Map<string, number>();
  #choiceCounts = new Map<string, number>();
  #spentChoices = new Set<string>();

  readonly #pending: DialogueEvent[] = [];

  constructor(document: DialogueDocument, deps: DialogueDependencies = {}, events?: EventBus) {
    validateDialogueDocument(document);
    this.#document = document;
    this.#deps = deps;
    this.#events = events;
    for (const node of document.nodes) this.#nodes.set(node.id, node);
    for (const character of document.characters ?? []) this.#characters.set(character.id, character);
  }

  // --- Reads ------------------------------------------------------------

  characters(): readonly CharacterDefinition[] {
    return [...this.#characters.values()];
  }

  character(characterId: string): CharacterDefinition | undefined {
    return this.#characters.get(characterId);
  }

  nodes(): readonly DialogueNode[] {
    return this.#document.nodes;
  }

  history(): DialogueHistory {
    return {
      nodeVisits: Object.fromEntries(this.#nodeVisits),
      lineViews: Object.fromEntries(this.#lineViews),
      choiceCounts: Object.fromEntries(this.#choiceCounts),
      spentChoices: [...this.#spentChoices].sort((a, b) => a.localeCompare(b)),
    };
  }

  /** What a condition is allowed to ask about, wired to the real owners. */
  #world(): DialogueWorldView {
    return {
      narrativeFlag: (flag) => this.#deps.narrative?.hasFlag(flag) ?? false,
      worldFlag: (flag) => this.#deps.world?.hasFlag(flag) ?? false,
      progressionUnlock: (flag) => this.#deps.progression?.isUnlocked(flag) ?? false,
      // Deliberately the dialogue's own history: this is a question about the
      // shape of the conversation, not about the game's codex.
      seenNode: (nodeId) => (this.#nodeVisits.get(nodeId) ?? 0) > 0,
      seenLine: (lineId) => (this.#lineViews.get(lineId) ?? 0) > 0,
      choiceCount: (choiceId) => this.#choiceCounts.get(choiceId) ?? 0,
      itemCount: (itemId) => this.#deps.items?.count(itemId) ?? 0,
    };
  }

  #currentNode(): DialogueNode | undefined {
    return this.#nodeId === null ? undefined : this.#nodes.get(this.#nodeId);
  }

  #currentLine(): DialogueLine | undefined {
    const node = this.#currentNode();
    if (!node) return undefined;
    return node.lines[this.#lineIndex];
  }

  #optionsFor(node: DialogueNode | undefined): readonly ChoiceOption[] {
    if (!node?.choices) return [];
    const world = this.#world();
    return node.choices.map((choice) => {
      // Spent is reported before conditions: a once-choice already taken is
      // unavailable for a reason the player can understand, and saying
      // "conditions" there would be misleading.
      const spent = choice.once === true && this.#spentChoices.has(choice.id);
      const allowed = evaluateConditions(choice.conditions, world);
      return {
        id: choice.id,
        text: choice.text,
        available: !spent && allowed,
        blockedBy: spent ? ('spent' as const) : allowed ? null : ('conditions' as const),
      };
    });
  }

  view(): DialogueView {
    const node = this.#currentNode();
    if (!node || this.#status === 'idle' || this.#status === 'ended') {
      return { ...IDLE_DIALOGUE_VIEW, status: this.#status, nodeId: this.#nodeId };
    }
    if (this.#status === 'choices') {
      return {
        status: 'choices',
        nodeId: node.id,
        lineId: null,
        speakerId: null,
        speakerName: null,
        text: '',
        portraitRole: null,
        expression: null,
        hasMoreLines: false,
        choices: this.#optionsFor(node),
      };
    }
    const line = this.#currentLine();
    if (!line) return { ...IDLE_DIALOGUE_VIEW, status: this.#status, nodeId: node.id };
    const speaker = line.speaker ? this.#characters.get(line.speaker) : undefined;
    const portrait = portraitRoleFor(speaker, line.expression);
    return {
      status: 'lines',
      nodeId: node.id,
      lineId: line.id,
      speakerId: line.speaker ?? null,
      speakerName: speaker?.displayName ?? null,
      text: line.text,
      portraitRole: portrait.role,
      expression: portrait.expression,
      hasMoreLines: this.#lineIndex + 1 < node.lines.length,
      choices: [],
    };
  }

  availableChoices(): readonly ChoiceOption[] {
    return this.#optionsFor(this.#currentNode());
  }

  // --- Effects ----------------------------------------------------------

  #applyEffects(effects: readonly DialogueEffect[] | undefined): AppliedEffects {
    const applied: DialogueEffectKind[] = [];
    const skipped: SkippedDialogueEffect[] = [];
    if (!effects || effects.length === 0) return { applied, skipped };

    for (const effect of effects) {
      const owner = this.#ownerFor(effect.kind);
      if (owner === 'missing') {
        skipped.push({
          kind: effect.kind,
          reason: 'missing-capability',
          capability: DIALOGUE_EFFECT_CAPABILITY[effect.kind]!,
        });
        continue;
      }
      switch (effect.kind) {
        case 'set-narrative-flag':
          this.#deps.narrative!.setFlag(effect.flag, effect.value);
          break;
        case 'set-world-flag':
          this.#deps.world!.setFlag(effect.flag, effect.value);
          break;
        case 'grant-item':
          this.#deps.items!.grant(effect.itemId, effect.quantity);
          break;
        case 'remove-item':
          this.#deps.items!.remove(effect.itemId, effect.quantity);
          break;
        case 'progression':
          if (effect.currency !== undefined) this.#deps.progression!.addCurrency(effect.currency);
          if (effect.xp !== undefined) this.#deps.progression!.addXp(effect.xp);
          if (effect.unlock !== undefined) this.#deps.progression!.unlock(effect.unlock);
          break;
        case 'mark-seen':
          // Deliberately the narrative capability's codex, not this service's
          // own history: "the player has seen this entry" is a fact about the
          // game, and something else may want to ask it.
          this.#deps.narrative!.markSeen(effect.entryId);
          break;
        case 'world-transition':
          // Applied by the caller after the effect pass, so a transition never
          // races the effects that were supposed to happen before it.
          break;
      }
      applied.push(effect.kind);
    }

    const result: AppliedEffects = { applied, skipped };
    this.#emit({ kind: 'effects-applied', result });
    return result;
  }

  #ownerFor(kind: DialogueEffectKind): 'present' | 'missing' {
    const capability = DIALOGUE_EFFECT_CAPABILITY[kind];
    if (capability === null) return 'present';
    switch (capability) {
      case 'narrative.state':
        return this.#deps.narrative ? 'present' : 'missing';
      case 'world.state':
        return this.#deps.world ? 'present' : 'missing';
      case 'items.state':
        return this.#deps.items ? 'present' : 'missing';
      case 'progression.state':
        return this.#deps.progression ? 'present' : 'missing';
      default:
        return 'missing';
    }
  }

  /** The last `world-transition` in a list, or null. Later wins. */
  #transitionIn(effects: readonly DialogueEffect[] | undefined): string | null {
    let target: string | null = null;
    for (const effect of effects ?? []) if (effect.kind === 'world-transition') target = effect.nodeId;
    return target;
  }

  // --- Walking the graph -------------------------------------------------

  #enter(nodeId: string): void {
    const node = this.#nodes.get(nodeId);
    if (!node) throw new UnknownDialogueNodeError(nodeId);
    this.#nodeId = nodeId;
    this.#lineIndex = 0;
    const visit = (this.#nodeVisits.get(nodeId) ?? 0) + 1;
    this.#nodeVisits.set(nodeId, visit);
    this.#emit({ kind: 'node-entered', nodeId, visit });

    if (node.lines.length === 0) {
      this.#status = 'choices';
      return;
    }
    this.#status = 'lines';
    this.#showCurrentLine();
  }

  /** Count the line as viewed and run its effects, exactly once per showing. */
  #showCurrentLine(): void {
    const line = this.#currentLine();
    if (!line) return;
    this.#lineViews.set(line.id, (this.#lineViews.get(line.id) ?? 0) + 1);
    this.#emit({ kind: 'line-shown', lineId: line.id, speakerId: line.speaker ?? null });
    this.#applyEffects(line.effects);
    const transition = this.#transitionIn(line.effects);
    if (transition) this.#enter(transition);
  }

  start(nodeId?: string): DialogueView {
    const target = nodeId ?? this.#document.startNode ?? this.#document.nodes[0]!.id;
    if (!this.#nodes.has(target)) throw new UnknownDialogueNodeError(target);
    this.#emit({ kind: 'started', nodeId: target });
    this.#enter(target);
    return this.view();
  }

  advance(): DialogueView {
    // A caller must not be able to skip past a pending decision.
    if (this.#status !== 'lines') return this.view();
    const node = this.#currentNode();
    if (!node) return this.view();

    if (this.#lineIndex + 1 < node.lines.length) {
      this.#lineIndex += 1;
      this.#showCurrentLine();
      return this.view();
    }

    if ((node.choices?.length ?? 0) > 0) {
      this.#status = 'choices';
      return this.view();
    }
    if (node.next) {
      this.#enter(node.next);
      return this.view();
    }
    return this.end();
  }

  choose(choiceId: string): DialogueView {
    const node = this.#currentNode();
    const choice: DialogueChoice | undefined = node?.choices?.find((entry) => entry.id === choiceId);
    if (!choice) return this.view();
    const option = this.#optionsFor(node).find((entry) => entry.id === choiceId);
    // An unavailable choice is refused outright rather than half-taken: no
    // count, no effects, no transition.
    if (!option?.available) return this.view();

    this.#choiceCounts.set(choiceId, (this.#choiceCounts.get(choiceId) ?? 0) + 1);
    if (choice.once === true) this.#spentChoices.add(choiceId);
    this.#emit({ kind: 'choice-taken', choiceId, target: choice.target ?? null });

    this.#applyEffects(choice.effects);
    const transition = this.#transitionIn(choice.effects) ?? choice.target;
    if (!transition) return this.end();
    this.#enter(transition);
    return this.view();
  }

  end(): DialogueView {
    const nodeId = this.#nodeId;
    this.#status = 'ended';
    this.#emit({ kind: 'ended', nodeId });
    return this.view();
  }

  // --- Persistence ------------------------------------------------------

  save(): DialogueSaveState {
    return {
      nodeId: this.#nodeId,
      lineIndex: this.#lineIndex,
      status: this.#status,
      history: this.history(),
    };
  }

  restore(state: DialogueSaveState): DialogueView {
    this.#nodeVisits = new Map(Object.entries(state.history?.nodeVisits ?? {}));
    this.#lineViews = new Map(Object.entries(state.history?.lineViews ?? {}));
    this.#choiceCounts = new Map(Object.entries(state.history?.choiceCounts ?? {}));
    this.#spentChoices = new Set(state.history?.spentChoices ?? []);

    // A saved node that no longer exists (the script was rewritten between
    // builds) falls back to idle rather than throwing: a player's save should
    // not crash the game because a writer renamed a scene.
    if (state.nodeId === null || !this.#nodes.has(state.nodeId)) {
      this.#nodeId = null;
      this.#lineIndex = 0;
      this.#status = state.nodeId === null ? state.status : 'idle';
      return this.view();
    }
    this.#nodeId = state.nodeId;
    const node = this.#nodes.get(state.nodeId)!;
    this.#lineIndex = Math.max(0, Math.min(state.lineIndex, Math.max(0, node.lines.length - 1)));
    this.#status = state.status;
    // Restoring does not re-show the line: its effects already happened before
    // the save, and re-running them would double every consequence on reload.
    return this.view();
  }

  reset(): void {
    this.#nodeId = null;
    this.#lineIndex = 0;
    this.#status = 'idle';
    this.#nodeVisits.clear();
    this.#lineViews.clear();
    this.#choiceCounts.clear();
    this.#spentChoices.clear();
    this.#pending.length = 0;
  }

  // --- Events -----------------------------------------------------------

  #emit(event: DialogueEvent): void {
    this.#pending.push(event);
    switch (event.kind) {
      case 'node-entered':
        this.#events?.emit('dialogue:nodeEntered', { nodeId: event.nodeId, visit: event.visit });
        break;
      case 'line-shown':
        this.#events?.emit('dialogue:lineShown', { lineId: event.lineId, speakerId: event.speakerId });
        break;
      case 'choice-taken':
        this.#events?.emit('dialogue:choiceTaken', { choiceId: event.choiceId, target: event.target });
        break;
      case 'ended':
        this.#events?.emit('dialogue:ended', { nodeId: event.nodeId });
        break;
      default:
        break;
    }
  }

  drainEvents(): readonly DialogueEvent[] {
    return this.#pending.splice(0, this.#pending.length);
  }
}

export { EMPTY_DIALOGUE_HISTORY };

export const dialoguePack: SystemPackDefinition<DialogueConfig, GameContext> = {
  id: PACK_IDS.dialogue,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.dialogue],
  // Every dependency is optional at the capability level: a dialogue with no
  // effects needs none of them, and one whose owner is missing skips loudly
  // rather than refusing to install a whole conversation.
  dependencies: [],
  configSchemaId: DIALOGUE_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: DialogueConfig): InstalledSystemPack {
    const documentName = config?.documentName ?? 'dialogue';
    const document = context.content.data[documentName]?.value as DialogueDocument | undefined;
    if (!document) throw new MissingDialogueDocumentError(documentName);

    const service = new DialogueServiceImpl(
      document,
      {
        ...(context.capabilities.get<NarrativeService>(CAPABILITY_IDS.narrative)
          ? { narrative: context.capabilities.require<NarrativeService>(CAPABILITY_IDS.narrative) }
          : {}),
        ...(context.capabilities.get<WorldService>(CAPABILITY_IDS.world)
          ? { world: context.capabilities.require<WorldService>(CAPABILITY_IDS.world) }
          : {}),
        ...(context.capabilities.get<ItemsService>(CAPABILITY_IDS.items)
          ? { items: context.capabilities.require<ItemsService>(CAPABILITY_IDS.items) }
          : {}),
        ...(context.capabilities.get<ProgressionService>(CAPABILITY_IDS.progression)
          ? { progression: context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression) }
          : {}),
      },
      context.events,
    );

    const handle = context.capabilities.provide(CAPABILITY_IDS.dialogue, service);
    return {
      id: PACK_IDS.dialogue,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { DialogueService } from '@sw2d/contracts';
