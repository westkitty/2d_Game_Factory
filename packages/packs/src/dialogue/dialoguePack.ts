import type {
  DialogueActResult,
  DialogueCatalog,
  DialogueChoiceDef,
  DialogueChoiceState,
  DialogueConversationDef,
  DialogueHotspotDef,
  DialogueHotspotState,
  DialogueMode,
  DialogueNodeDef,
  DialogueNodeKind,
  DialogueOutcome,
  DialogueService,
  DialogueSceneDef,
  DialogueSpeakerDef,
  EventBus,
  GameContext,
  InstalledSystemPack,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { DuplicateDialogueIdError, UnknownDialogueNodeError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Dialogue pack: authored branching graphs, choices, flags and endings
 * (Category-C Wave 3). Definitions come from validated
 * `content/dialogue.json`. No Phaser, no wall clock, no RNG, no portraits.
 *
 * Deliberately not folded into `sw2d.narrative`: that pack is a lightweight
 * flag/node/seen store. This one owns the graph loader and advance/choose
 * loop that visual-novel and point-and-click share.
 */

interface LiveConversation {
  readonly def: DialogueConversationDef;
  readonly nodes: Map<string, DialogueNodeDef>;
}

class DialogueServiceImpl implements DialogueService {
  readonly #mode: DialogueMode;
  readonly #startConversationId: string | null;
  readonly #conversations = new Map<string, LiveConversation>();
  readonly #hotspots: DialogueHotspotDef[];
  readonly #events: EventBus;
  readonly #speakers = new Map<string, DialogueSpeakerDef>();
  readonly #scenes = new Map<string, DialogueSceneDef>();
  #conversationId: string | null = null;
  #nodeId: string | null = null;
  #flags = new Set<string>();
  #branch: string | null = null;
  #ending: string | null = null;
  #outcome: DialogueOutcome = 'playing';
  #selected = 0;
  #step = 0;
  #lastResult: string | null = null;

  constructor(events: EventBus, catalog: DialogueCatalog | undefined) {
    this.#events = events;
    this.#mode = catalog?.mode ?? 'novel';
    this.#hotspots = [...(catalog?.hotspots ?? [])];
    for (const speaker of catalog?.speakers ?? []) this.#speakers.set(speaker.id, speaker);
    for (const scene of catalog?.scenes ?? []) this.#scenes.set(scene.id, scene);
    for (const conversation of catalog?.conversations ?? []) {
      if (this.#conversations.has(conversation.id)) throw new DuplicateDialogueIdError(conversation.id);
      const nodes = new Map<string, DialogueNodeDef>();
      for (const node of conversation.nodes) {
        if (nodes.has(node.id)) throw new DuplicateDialogueIdError(node.id);
        nodes.set(node.id, node);
        if (node.kind === 'choice') {
          const seen = new Set<string>();
          for (const choice of node.choices ?? []) {
            if (seen.has(choice.id)) throw new DuplicateDialogueIdError(choice.id);
            seen.add(choice.id);
          }
        }
      }
      if (conversation.nodes.length > 0 && !nodes.has(conversation.startNodeId)) {
        throw new UnknownDialogueNodeError(conversation.startNodeId);
      }
      for (const node of conversation.nodes) {
        if (node.kind === 'line' && node.next) {
          if (!nodes.has(node.next)) throw new UnknownDialogueNodeError(node.next);
        }
        if (node.kind === 'choice') {
          for (const choice of node.choices ?? []) {
            if (!nodes.has(choice.next)) throw new UnknownDialogueNodeError(choice.next);
          }
        }
      }
      this.#conversations.set(conversation.id, { def: conversation, nodes });
    }
    for (const hotspot of this.#hotspots) {
      if (!this.#conversations.has(hotspot.conversationId)) {
        throw new UnknownDialogueNodeError(hotspot.conversationId);
      }
    }
    this.#startConversationId = catalog?.startConversationId ?? this.#conversations.keys().next().value ?? null;
    this.#boot();
  }

  mode(): DialogueMode {
    return this.#mode;
  }

  active(): boolean {
    return this.#conversations.size > 0;
  }

  conversationId(): string | null {
    return this.#conversationId;
  }

  nodeId(): string | null {
    return this.#nodeId;
  }

  kind(): DialogueNodeKind {
    return this.#current()?.kind ?? 'idle';
  }

  speaker(): string {
    return this.#current()?.speaker ?? '';
  }

  text(): string {
    return this.#current()?.text ?? '';
  }

  choices(): readonly DialogueChoiceState[] {
    return this.#visibleChoices().map((c) => ({ id: c.id, text: c.text }));
  }

  selectedIndex(): number {
    return this.#selected;
  }

  selectByDelta(delta: number): number {
    const len = this.#visibleChoices().length;
    if (len === 0) {
      this.#selected = 0;
      return 0;
    }
    this.#selected = ((this.#selected + delta) % len + len) % len;
    return this.#selected;
  }

  advance(): DialogueActResult {
    if (this.#outcome !== 'playing') {
      this.#lastResult = 'not-playing';
      return { ok: false, reason: 'not-playing' };
    }
    const node = this.#current();
    if (!node) {
      this.#lastResult = 'idle';
      return { ok: false, reason: 'idle' };
    }
    if (node.kind === 'choice') {
      this.#lastResult = 'not-line';
      return { ok: false, reason: 'not-line', nodeId: node.id };
    }
    this.#step += 1;
    if (node.kind === 'end') {
      if (node.ending) {
        this.#ending = node.ending;
        this.#outcome = 'complete';
        this.#lastResult = 'completed';
        this.#events.emit('dialogue:ended', { ending: node.ending, conversationId: this.#conversationId ?? '' });
        return { ok: true, reason: 'completed', nodeId: node.id, ...(this.#conversationId ? { conversationId: this.#conversationId } : {}) };
      }
      this.#conversationId = null;
      this.#nodeId = null;
      this.#lastResult = 'ended';
      this.#events.emit('dialogue:nodeChanged', { nodeId: null, conversationId: null });
      return { ok: true, reason: 'ended', nodeId: node.id };
    }
    const next = node.next ?? null;
    if (!next) {
      this.#conversationId = null;
      this.#nodeId = null;
      this.#lastResult = 'ended';
      this.#events.emit('dialogue:nodeChanged', { nodeId: null, conversationId: null });
      return { ok: true, reason: 'ended', nodeId: node.id };
    }
    this.#enter(next);
    this.#lastResult = 'advanced';
    return { ok: true, reason: 'advanced', nodeId: next, ...(this.#conversationId ? { conversationId: this.#conversationId } : {}) };
  }

  choose(choiceId?: string): DialogueActResult {
    if (this.#outcome !== 'playing') {
      this.#lastResult = 'not-playing';
      return { ok: false, reason: 'not-playing', ...(choiceId ? { choiceId } : {}) };
    }
    const node = this.#current();
    if (!node || node.kind !== 'choice') {
      this.#lastResult = 'not-choice';
      return { ok: false, reason: 'not-choice', ...(choiceId ? { choiceId } : {}) };
    }
    const visible = this.#visibleChoices();
    const choice = choiceId ? visible.find((c) => c.id === choiceId) : visible[this.#selected];
    if (!choice) {
      this.#lastResult = choiceId ? 'unknown-choice' : 'no-choice';
      return {
        ok: false,
        reason: choiceId ? 'unknown-choice' : 'no-choice',
        ...(choiceId ? { choiceId } : {}),
        nodeId: node.id,
      };
    }
    if (choice.setFlag) this.#flags.add(choice.setFlag);
    if (choice.branchId) this.#branch = choice.branchId;
    this.#step += 1;
    this.#enter(choice.next);
    this.#lastResult = 'chose';
    return {
      ok: true,
      reason: 'chose',
      choiceId: choice.id,
      nodeId: choice.next,
      ...(this.#conversationId ? { conversationId: this.#conversationId } : {}),
    };
  }

  chooseByIndex(index: number): DialogueActResult {
    const visible = this.#visibleChoices();
    const choice = visible[index];
    if (!choice) {
      this.#lastResult = 'unknown-choice';
      return { ok: false, reason: 'unknown-choice' };
    }
    this.#selected = index;
    return this.choose(choice.id);
  }

  start(conversationId: string): DialogueActResult {
    if (this.#outcome !== 'playing') {
      this.#lastResult = 'not-playing';
      return { ok: false, reason: 'not-playing', conversationId };
    }
    const live = this.#conversations.get(conversationId);
    if (!live) {
      this.#lastResult = 'unknown-conversation';
      return { ok: false, reason: 'unknown-conversation', conversationId };
    }
    const hotspot = this.#hotspots.find((h) => h.conversationId === conversationId);
    if (hotspot?.requireFlags?.some((flag) => !this.#flags.has(flag))) {
      this.#lastResult = 'locked';
      return { ok: false, reason: 'locked', conversationId };
    }
    this.#conversationId = conversationId;
    this.#enter(live.def.startNodeId);
    this.#lastResult = 'advanced';
    return { ok: true, reason: 'advanced', nodeId: live.def.startNodeId, conversationId };
  }

  flags(): readonly string[] {
    return [...this.#flags].sort();
  }

  hasFlag(flag: string): boolean {
    return this.#flags.has(flag);
  }

  branch(): string | null {
    return this.#branch;
  }

  ending(): string | null {
    return this.#ending;
  }

  outcome(): DialogueOutcome {
    return this.#outcome;
  }

  step(): number {
    return this.#step;
  }

  lastResult(): string | null {
    return this.#lastResult;
  }

  hotspots(): readonly DialogueHotspotState[] {
    return this.#hotspots.map((h) => ({
      id: h.id,
      conversationId: h.conversationId,
      x: h.x,
      y: h.y,
      locked: (h.requireFlags ?? []).some((flag) => !this.#flags.has(flag)),
    }));
  }

  presentation(): { readonly scene: DialogueSceneDef | null; readonly speaker: DialogueSpeakerDef | null } {
    const node = this.#current();
    const speakerId = node?.speakerId ?? node?.speaker;
    return {
      scene: node?.sceneId ? this.#scenes.get(node.sceneId) ?? null : null,
      speaker: speakerId ? this.#speakers.get(speakerId) ?? null : null,
    };
  }

  reset(): void {
    this.#flags = new Set();
    this.#branch = null;
    this.#ending = null;
    this.#outcome = 'playing';
    this.#selected = 0;
    this.#step = 0;
    this.#lastResult = null;
    this.#conversationId = null;
    this.#nodeId = null;
    this.#boot();
  }

  #boot(): void {
    if (this.#mode === 'novel' && this.#startConversationId && this.#conversations.has(this.#startConversationId)) {
      this.#conversationId = this.#startConversationId;
      this.#enter(this.#conversations.get(this.#startConversationId)!.def.startNodeId);
    }
  }

  #current(): DialogueNodeDef | null {
    if (!this.#conversationId || !this.#nodeId) return null;
    return this.#conversations.get(this.#conversationId)?.nodes.get(this.#nodeId) ?? null;
  }

  #visibleChoices(): readonly DialogueChoiceDef[] {
    const node = this.#current();
    if (!node || node.kind !== 'choice') return [];
    return (node.choices ?? []).filter((c) => !c.requireFlag || this.#flags.has(c.requireFlag));
  }

  #enter(nodeId: string): void {
    const live = this.#conversationId ? this.#conversations.get(this.#conversationId) : undefined;
    const node = live?.nodes.get(nodeId);
    if (!node) throw new UnknownDialogueNodeError(nodeId);
    this.#nodeId = nodeId;
    this.#selected = 0;
    if (node.setFlag) this.#flags.add(node.setFlag);
    this.#events.emit('dialogue:nodeChanged', { nodeId, conversationId: this.#conversationId });
  }
}

export const dialoguePack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.dialogue,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.dialogue],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['dialogue']?.value as DialogueCatalog | undefined;
    const service = new DialogueServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.dialogue, service);
    return {
      id: PACK_IDS.dialogue,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { DialogueService };
