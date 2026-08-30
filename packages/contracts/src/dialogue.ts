/**
 * Narrative dialogue, choices & portraits (post-ten program Phase 20).
 *
 * A dialogue is an authored graph of nodes; a node is a run of lines and,
 * optionally, a set of choices. The service walks that graph and reports where
 * it is. It renders nothing.
 *
 * ## No expression evaluator
 *
 * Conditions and effects are closed, declarative unions - seven condition kinds
 * and six effect kinds. There is deliberately no `"flags.trust > 3 && !seen.x"`
 * string to parse, because the moment a condition can be arbitrary code the
 * document stops being data: the Workbench cannot show it, validation cannot
 * check the references in it, and a save file becomes a script.
 *
 * ## The dialogue owns the graph, not the state
 *
 * Narrative flags belong to `narrative.state`, world flags to `world.state`,
 * item counts to `items.state`, unlocks to `progression.state`. Every effect
 * that touches one of those writes through its owner. What the dialogue owns is
 * the part nobody else has: where the cursor is, which nodes have been visited
 * how many times, and which `once` choices are spent.
 *
 * The one subtlety worth stating: `seen-node` / `seen-line` read the dialogue's
 * **own** history, because they are about the shape of this conversation, while
 * the `mark-seen` *effect* writes a codex entry into `narrative.state`, because
 * that is a fact about the game rather than about the dialogue. They are two
 * different questions that happen to share a word.
 *
 * ## Ids are not text
 *
 * Every line and choice carries a stable id distinct from its text. Text is the
 * thing that gets translated, rewritten and proofread; an id that *is* the text
 * makes a save file break when a typo is fixed.
 *
 * Renderer-neutral and pure: nothing here touches the DOM, a canvas, a clock or
 * `Math.random`. Portrait art is referenced by *asset role*, resolved through
 * the theme like every other asset, and is entirely optional - a dialogue with
 * no portraits is a valid dialogue.
 */

export const DIALOGUE_CAPABILITY_ID = 'narrative.dialogue';

// --- Characters ----------------------------------------------------------

export interface CharacterDefinition {
  readonly id: string;
  readonly displayName: string;
  /** Expression used when a line names none. Defaults to the first portrait key. */
  readonly defaultExpression?: string;
  /**
   * `expression -> asset role`. Resolved through the theme, never a file path.
   * Omit entirely for a character with no art; a zero-art game stays valid.
   */
  readonly portraits?: Readonly<Record<string, string>>;
}

// --- Conditions ----------------------------------------------------------

export type NumericComparison = 'at-least' | 'at-most' | 'equals';

/**
 * The complete set. Adding an eighth kind is a deliberate act in this union and
 * in the schema together - which is the point of it being closed.
 */
export type DialogueCondition =
  | { readonly kind: 'narrative-flag'; readonly flag: string; readonly value?: boolean }
  | { readonly kind: 'world-flag'; readonly flag: string; readonly value?: boolean }
  | { readonly kind: 'progression-unlock'; readonly flag: string; readonly value?: boolean }
  | { readonly kind: 'seen-node'; readonly nodeId: string; readonly value?: boolean }
  | { readonly kind: 'seen-line'; readonly lineId: string; readonly value?: boolean }
  | {
      readonly kind: 'choice-count';
      readonly choiceId: string;
      readonly comparison: NumericComparison;
      readonly count: number;
    }
  | {
      readonly kind: 'item-count';
      readonly itemId: string;
      readonly comparison: NumericComparison;
      readonly count: number;
    };

/** What a condition may ask about. The service supplies this; conditions are pure. */
export interface DialogueWorldView {
  readonly narrativeFlag: (flag: string) => boolean;
  readonly worldFlag: (flag: string) => boolean;
  readonly progressionUnlock: (flag: string) => boolean;
  readonly seenNode: (nodeId: string) => boolean;
  readonly seenLine: (lineId: string) => boolean;
  readonly choiceCount: (choiceId: string) => number;
  readonly itemCount: (itemId: string) => number;
}

export function compareNumeric(actual: number, comparison: NumericComparison, expected: number): boolean {
  switch (comparison) {
    case 'at-least':
      return actual >= expected;
    case 'at-most':
      return actual <= expected;
    case 'equals':
      return actual === expected;
  }
}

export function evaluateCondition(condition: DialogueCondition, world: DialogueWorldView): boolean {
  // A boolean condition defaults to `value: true`, so `{ kind: 'world-flag',
  // flag: 'x' }` reads as "x is set" rather than as an unanswerable question.
  const wanted = (condition as { readonly value?: boolean }).value ?? true;
  switch (condition.kind) {
    case 'narrative-flag':
      return world.narrativeFlag(condition.flag) === wanted;
    case 'world-flag':
      return world.worldFlag(condition.flag) === wanted;
    case 'progression-unlock':
      return world.progressionUnlock(condition.flag) === wanted;
    case 'seen-node':
      return world.seenNode(condition.nodeId) === wanted;
    case 'seen-line':
      return world.seenLine(condition.lineId) === wanted;
    case 'choice-count':
      return compareNumeric(world.choiceCount(condition.choiceId), condition.comparison, condition.count);
    case 'item-count':
      return compareNumeric(world.itemCount(condition.itemId), condition.comparison, condition.count);
  }
}

/** Every condition must hold. An absent or empty list is always satisfied. */
export function evaluateConditions(
  conditions: readonly DialogueCondition[] | undefined,
  world: DialogueWorldView,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, world));
}

// --- Effects -------------------------------------------------------------

/**
 * Deliberately **not** the item-effect union from `items.ts`. That one carries
 * `combat.heal` and `combat.invulnerable`, which a line of dialogue has no
 * business reaching; this one carries `mark-seen` and `world-transition`, which
 * an item has no business reaching. The one genuine overlap - a world flag -
 * routes to the same `world.state` owner in both.
 */
export type DialogueEffect =
  | { readonly kind: 'set-narrative-flag'; readonly flag: string; readonly value: boolean }
  | { readonly kind: 'set-world-flag'; readonly flag: string; readonly value: boolean }
  | { readonly kind: 'grant-item'; readonly itemId: string; readonly quantity?: number }
  | { readonly kind: 'remove-item'; readonly itemId: string; readonly quantity?: number }
  | {
      readonly kind: 'progression';
      readonly currency?: number;
      readonly xp?: number;
      readonly unlock?: string;
    }
  | { readonly kind: 'mark-seen'; readonly entryId: string }
  | { readonly kind: 'world-transition'; readonly nodeId: string };

export type DialogueEffectKind = DialogueEffect['kind'];

/** Named reason an effect did nothing, so a silent no-op is never invisible. */
export interface SkippedDialogueEffect {
  readonly kind: DialogueEffectKind;
  readonly reason: 'missing-capability';
  readonly capability: string;
}

/** Which capability each effect needs. A missing one skips, loudly. */
export const DIALOGUE_EFFECT_CAPABILITY: Readonly<Record<DialogueEffectKind, string | null>> = {
  'set-narrative-flag': 'narrative.state',
  'set-world-flag': 'world.state',
  'grant-item': 'items.state',
  'remove-item': 'items.state',
  progression: 'progression.state',
  'mark-seen': 'narrative.state',
  // Handled by the dialogue service itself.
  'world-transition': null,
};

export interface AppliedEffects {
  readonly applied: readonly DialogueEffectKind[];
  readonly skipped: readonly SkippedDialogueEffect[];
}

// --- Lines, choices and nodes -------------------------------------------

export interface DialogueLine {
  /** Stable, and never the text. Text gets translated; ids must not. */
  readonly id: string;
  /** Character id, or omitted for narration with no speaker. */
  readonly speaker?: string;
  readonly text: string;
  /** Expression key into the speaker's portraits. Falls back to their default. */
  readonly expression?: string;
  readonly effects?: readonly DialogueEffect[];
}

export interface DialogueChoice {
  readonly id: string;
  readonly text: string;
  readonly conditions?: readonly DialogueCondition[];
  /** Node to enter when taken. Omit to end the dialogue. */
  readonly target?: string;
  readonly effects?: readonly DialogueEffect[];
  /** Selectable at most once per dialogue lifetime. */
  readonly once?: boolean;
}

export interface DialogueNode {
  readonly id: string;
  readonly lines: readonly DialogueLine[];
  readonly choices?: readonly DialogueChoice[];
  /** Node to enter when the lines run out and there are no choices. */
  readonly next?: string;
}

export interface DialogueDocument {
  readonly schemaVersion: number;
  readonly characters?: readonly CharacterDefinition[];
  readonly nodes: readonly DialogueNode[];
  /** Node `start()` enters when given no id. Defaults to the first node. */
  readonly startNode?: string;
}

// --- History and state ---------------------------------------------------

export interface DialogueHistory {
  /** `nodeId -> times entered`. */
  readonly nodeVisits: Readonly<Record<string, number>>;
  /** `lineId -> times shown`. */
  readonly lineViews: Readonly<Record<string, number>>;
  /** `choiceId -> times taken`. */
  readonly choiceCounts: Readonly<Record<string, number>>;
  /** Ids of `once` choices already spent. */
  readonly spentChoices: readonly string[];
}

export const EMPTY_DIALOGUE_HISTORY: DialogueHistory = {
  nodeVisits: {},
  lineViews: {},
  choiceCounts: {},
  spentChoices: [],
};

export type DialogueStatus = 'idle' | 'lines' | 'choices' | 'ended';

/** A choice as the presentation layer needs it: text plus why it is unavailable. */
export interface ChoiceOption {
  readonly id: string;
  readonly text: string;
  readonly available: boolean;
  readonly blockedBy: 'conditions' | 'spent' | null;
}

/** Everything a renderer needs for one frame of dialogue, and nothing more. */
export interface DialogueView {
  readonly status: DialogueStatus;
  readonly nodeId: string | null;
  readonly lineId: string | null;
  readonly speakerId: string | null;
  readonly speakerName: string | null;
  readonly text: string;
  /** Asset role for the current portrait, or null for none / no art authored. */
  readonly portraitRole: string | null;
  readonly expression: string | null;
  /** Whether `advance()` would move to another line rather than end or branch. */
  readonly hasMoreLines: boolean;
  readonly choices: readonly ChoiceOption[];
}

export const IDLE_DIALOGUE_VIEW: DialogueView = {
  status: 'idle',
  nodeId: null,
  lineId: null,
  speakerId: null,
  speakerName: null,
  text: '',
  portraitRole: null,
  expression: null,
  hasMoreLines: false,
  choices: [],
};

/** The portrait asset role for a character's expression, or null. */
export function portraitRoleFor(
  character: CharacterDefinition | undefined,
  expression: string | undefined,
): { readonly role: string | null; readonly expression: string | null } {
  if (!character?.portraits) return { role: null, expression: expression ?? null };
  const keys = Object.keys(character.portraits);
  if (keys.length === 0) return { role: null, expression: expression ?? null };
  const wanted = expression ?? character.defaultExpression ?? keys[0]!;
  // An unknown expression falls back rather than showing nothing: a typo in one
  // line should not blank the character for the rest of the scene.
  const resolved = character.portraits[wanted] ? wanted : (character.defaultExpression ?? keys[0]!);
  return { role: character.portraits[resolved] ?? null, expression: resolved };
}

// --- Validation ----------------------------------------------------------

export class InvalidDialogueDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDialogueDocumentError';
  }
}

/**
 * The semantic gate: every reference in the graph resolves, every id is unique,
 * and the start node exists. A dangling `target` is the single most common
 * dialogue bug and the one a JSON schema structurally cannot catch.
 */
export function validateDialogueDocument(document: DialogueDocument): void {
  const fail = (message: string): never => {
    throw new InvalidDialogueDocumentError(message);
  };

  if (document.nodes.length === 0) fail('A dialogue document must define at least one node.');

  const characterIds = new Set<string>();
  for (const character of document.characters ?? []) {
    if (characterIds.has(character.id)) fail(`Character "${character.id}" is defined more than once.`);
    characterIds.add(character.id);
    const portraits = character.portraits ?? {};
    if (character.defaultExpression && !portraits[character.defaultExpression]) {
      fail(
        `Character "${character.id}" defaults to expression "${character.defaultExpression}", ` +
          'which it has no portrait for.',
      );
    }
  }

  const nodeIds = new Set<string>();
  const lineIds = new Set<string>();
  const choiceIds = new Set<string>();
  for (const node of document.nodes) {
    if (nodeIds.has(node.id)) fail(`Node "${node.id}" is defined more than once.`);
    nodeIds.add(node.id);
    if (node.lines.length === 0 && (node.choices?.length ?? 0) === 0) {
      fail(`Node "${node.id}" has neither lines nor choices, so entering it would do nothing.`);
    }
    for (const line of node.lines) {
      if (lineIds.has(line.id)) fail(`Line "${line.id}" is defined more than once.`);
      lineIds.add(line.id);
      if (line.speaker && !characterIds.has(line.speaker)) {
        fail(`Line "${line.id}" is spoken by "${line.speaker}", who is not a defined character.`);
      }
      if (line.expression && line.speaker) {
        const character = (document.characters ?? []).find((entry) => entry.id === line.speaker);
        if (character?.portraits && !character.portraits[line.expression]) {
          fail(
            `Line "${line.id}" asks for expression "${line.expression}", ` +
              `which "${line.speaker}" has no portrait for.`,
          );
        }
      }
    }
    for (const choice of node.choices ?? []) {
      if (choiceIds.has(choice.id)) fail(`Choice "${choice.id}" is defined more than once.`);
      choiceIds.add(choice.id);
    }
  }

  // Every graph edge must land somewhere. Checked after collecting ids so a
  // forward reference to a later node is legal.
  const requireNode = (nodeId: string, where: string): void => {
    if (!nodeIds.has(nodeId)) fail(`${where} points at node "${nodeId}", which does not exist.`);
  };
  for (const node of document.nodes) {
    if (node.next) requireNode(node.next, `Node "${node.id}"`);
    for (const choice of node.choices ?? []) {
      if (choice.target) requireNode(choice.target, `Choice "${choice.id}"`);
      for (const effect of choice.effects ?? []) {
        if (effect.kind === 'world-transition') requireNode(effect.nodeId, `Choice "${choice.id}"`);
      }
    }
    for (const line of node.lines) {
      for (const effect of line.effects ?? []) {
        if (effect.kind === 'world-transition') requireNode(effect.nodeId, `Line "${line.id}"`);
      }
    }
    for (const choice of node.choices ?? []) {
      for (const condition of choice.conditions ?? []) {
        if (condition.kind === 'seen-node') requireNode(condition.nodeId, `Choice "${choice.id}"`);
        if (condition.kind === 'seen-line' && !lineIds.has(condition.lineId)) {
          fail(`Choice "${choice.id}" is gated on line "${condition.lineId}", which does not exist.`);
        }
        if (condition.kind === 'choice-count' && !choiceIds.has(condition.choiceId)) {
          fail(`Choice "${choice.id}" is gated on choice "${condition.choiceId}", which does not exist.`);
        }
      }
    }
  }

  if (document.startNode) requireNode(document.startNode, 'startNode');
}

// --- Events --------------------------------------------------------------

export type DialogueEvent =
  | { readonly kind: 'started'; readonly nodeId: string }
  | { readonly kind: 'node-entered'; readonly nodeId: string; readonly visit: number }
  | { readonly kind: 'line-shown'; readonly lineId: string; readonly speakerId: string | null }
  | { readonly kind: 'choice-taken'; readonly choiceId: string; readonly target: string | null }
  | { readonly kind: 'effects-applied'; readonly result: AppliedEffects }
  | { readonly kind: 'ended'; readonly nodeId: string | null };

// --- Save record ---------------------------------------------------------

/**
 * What has to survive a reload for a conversation to continue where it was.
 * Ids only - never text - so a proofreading pass cannot invalidate a save.
 */
export interface DialogueSaveState {
  readonly nodeId: string | null;
  readonly lineIndex: number;
  readonly status: DialogueStatus;
  readonly history: DialogueHistory;
}

// --- Service -------------------------------------------------------------

/**
 * Advancing is caller-driven (`advance()` on a keypress), not frame-driven, so
 * there is no `update()` here and nothing for a shell and a pack to both step.
 */
export interface DialogueService {
  characters(): readonly CharacterDefinition[];
  character(characterId: string): CharacterDefinition | undefined;
  nodes(): readonly DialogueNode[];

  /** Enter `nodeId`, or the document's start node. Throws for an unknown id. */
  start(nodeId?: string): DialogueView;
  view(): DialogueView;
  /**
   * Move to the next line; at the end of a node, present its choices, follow
   * its `next`, or end. A no-op when choices are pending - a caller must not be
   * able to skip past a decision.
   */
  advance(): DialogueView;
  availableChoices(): readonly ChoiceOption[];
  /** Take a choice. Refused (and reported) when unavailable. */
  choose(choiceId: string): DialogueView;
  history(): DialogueHistory;
  end(): DialogueView;

  /** Serialise / restore the cursor and history. Ids only. */
  save(): DialogueSaveState;
  restore(state: DialogueSaveState): DialogueView;
  /** Back to idle with empty history - a new playthrough, not a reload. */
  reset(): void;
  drainEvents(): readonly DialogueEvent[];
}
