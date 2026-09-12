/**
 * Branching dialogue / narrative presentation
 * (Category-C capability program, Wave 3).
 *
 * Renderer-neutral graph + flag state. One reusable service covers the
 * common visual-novel / point-and-click loop: authored nodes, choices,
 * flags, and endings. Portraits, scene composition, parser IF and
 * evidence-board deduction remain content / game-specific.
 *
 * Two bounded modes (not two engines):
 *   - `novel`      — auto-starts the start conversation; confirm advances;
 *                    arrows pick a choice.
 *   - `adventure`  — idle until `start(conversationId)` (a hotspot); the
 *                    same advance/choose loop, plus gated hotspots.
 */

export const DIALOGUE_CAPABILITY_ID = 'narrative.dialogue';

export type DialogueMode = 'novel' | 'adventure';
export type DialogueOutcome = 'playing' | 'complete';
export type DialogueNodeKind = 'line' | 'choice' | 'end' | 'idle';

export interface DialogueChoiceDef {
  readonly id: string;
  readonly text: string;
  readonly next: string;
  /** Set this flag when the choice is taken. */
  readonly setFlag?: string;
  /** Recorded as `branch()` when this choice is taken (VN endings). */
  readonly branchId?: string;
  /** Hidden unless the flag is set. */
  readonly requireFlag?: string;
}

export interface DialogueNodeDef {
  readonly id: string;
  readonly kind: 'line' | 'choice' | 'end';
  readonly speaker: string;
  readonly text: string;
  /** Line: next node id, or null to return to idle. */
  readonly next?: string | null;
  /** End node: if set, advancing this node completes the game. */
  readonly ending?: string;
  /** Applied when the node is entered. */
  readonly setFlag?: string;
  readonly choices?: readonly DialogueChoiceDef[];
  readonly sceneId?: string;
  readonly speakerId?: string;
}

export interface DialogueSpeakerDef {
  readonly id: string;
  readonly displayName: string;
  readonly portrait: string;
  readonly position: 'left' | 'center' | 'right';
  readonly color?: string;
}

export interface DialogueSceneDef {
  readonly id: string;
  readonly title: string;
  readonly background: string;
  readonly backgroundImage?: string;
}

export interface NarrativeParserObjectDef {
  readonly id: string;
  readonly nouns: readonly string[];
  readonly aliases?: readonly string[];
}

export interface NarrativeParserCommandDef {
  readonly id: string;
  readonly verb: string;
  readonly aliases?: readonly string[];
  readonly objectId?: string;
  readonly indirectObjectId?: string;
  readonly requireFlags?: readonly string[];
  readonly forbidFlags?: readonly string[];
  readonly setFlags?: readonly string[];
  readonly clearFlags?: readonly string[];
  readonly nodeId: string;
  readonly text: string;
  readonly ending?: string;
}

export interface NarrativeParserDef {
  readonly startNodeId: string;
  readonly prompt: string;
  readonly objects: readonly NarrativeParserObjectDef[];
  readonly commands: readonly NarrativeParserCommandDef[];
  readonly unknownVerb: string;
  readonly unknownObject: string;
  readonly blocked: string;
}

export interface DialogueConversationDef {
  readonly id: string;
  readonly startNodeId: string;
  readonly nodes: readonly DialogueNodeDef[];
}

export interface DialogueHotspotDef {
  readonly id: string;
  readonly conversationId: string;
  readonly x: number;
  readonly y: number;
  /** All listed flags must be set before `start` succeeds. */
  readonly requireFlags?: readonly string[];
}

/** The validated `content/dialogue.json` document. */
export interface DialogueCatalog {
  readonly schemaVersion: number;
  readonly mode: DialogueMode;
  readonly startConversationId?: string;
  readonly conversations: readonly DialogueConversationDef[];
  readonly hotspots?: readonly DialogueHotspotDef[];
  readonly speakers?: readonly DialogueSpeakerDef[];
  readonly scenes?: readonly DialogueSceneDef[];
  /** Optional content-authored command grammar consumed by sw2d.narrative. */
  readonly parser?: NarrativeParserDef;
}

export interface DialogueChoiceState {
  readonly id: string;
  readonly text: string;
}

export interface DialogueHotspotState {
  readonly id: string;
  readonly conversationId: string;
  readonly x: number;
  readonly y: number;
  readonly locked: boolean;
}

export type DialogueAdvanceReason =
  | 'advanced'
  | 'chose'
  | 'ended'
  | 'completed'
  | 'idle'
  | 'locked'
  | 'unknown-conversation'
  | 'unknown-choice'
  | 'no-choice'
  | 'not-playing'
  | 'not-choice'
  | 'not-line';

export interface DialogueActResult {
  readonly ok: boolean;
  readonly reason: DialogueAdvanceReason;
  readonly nodeId?: string;
  readonly choiceId?: string;
  readonly conversationId?: string;
}

export interface DialogueService {
  mode(): DialogueMode;
  /** False when the catalog has no conversations (inert empty document). */
  active(): boolean;
  conversationId(): string | null;
  nodeId(): string | null;
  kind(): DialogueNodeKind;
  speaker(): string;
  text(): string;
  choices(): readonly DialogueChoiceState[];
  selectedIndex(): number;
  selectByDelta(delta: number): number;
  /** Advance a line or dismiss an end node. */
  advance(): DialogueActResult;
  /** Take `choiceId`, or the currently selected visible choice. */
  choose(choiceId?: string): DialogueActResult;
  chooseByIndex(index: number): DialogueActResult;
  /** Adventure: begin a conversation. Novel: no-op if already running. */
  start(conversationId: string): DialogueActResult;
  flags(): readonly string[];
  hasFlag(flag: string): boolean;
  branch(): string | null;
  ending(): string | null;
  outcome(): DialogueOutcome;
  /** Successful advances + choices since reset (overlay step mapping). */
  step(): number;
  lastResult(): string | null;
  hotspots(): readonly DialogueHotspotState[];
  presentation(): { readonly scene: DialogueSceneDef | null; readonly speaker: DialogueSpeakerDef | null };
  /** Restore catalog initials (a new reading). */
  reset(): void;
}

export class DuplicateDialogueIdError extends Error {
  constructor(id: string) {
    super(`Duplicate dialogue id "${id}" in content/dialogue.json.`);
    this.name = 'DuplicateDialogueIdError';
  }
}

export class UnknownDialogueNodeError extends Error {
  constructor(id: string) {
    super(`No dialogue node defined with id "${id}" in content/dialogue.json.`);
    this.name = 'UnknownDialogueNodeError';
  }
}

export class UnknownDialogueConversationError extends Error {
  constructor(id: string) {
    super(`No dialogue conversation defined with id "${id}" in content/dialogue.json.`);
    this.name = 'UnknownDialogueConversationError';
  }
}
