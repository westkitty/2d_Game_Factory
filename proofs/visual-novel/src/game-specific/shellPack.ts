import {
  DIALOGUE_CAPABILITY_ID,
  type ChoiceOption,
  type DialogueHistory,
  type DialogueSaveState,
  type DialogueService,
  type DialogueView,
  type InstalledSystemPack,
  type ItemsService,
  type VersionedRecord,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, type NarrativeService, type ProgressionService, type WorldService } from '@sw2d/packs';
import { createDialogueOverlay, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 20 proof - visual novel.
 *
 * The conversation is the capability; the shell is a keyboard wire and a place
 * to put the overlay. It holds no cursor, no history and no branch state, and
 * it decides nothing about which choices are available - every one of those is
 * read back out of `narrative.dialogue`.
 *
 * The overlay is the runtime's `createDialogueOverlay`, not a bespoke one, so
 * what the proof asserts about the accessibility tree is asserted about the
 * thing every generated game would get.
 */

export const NOVEL_SHELL_CAPABILITY_ID = 'game.novel-shell';

const SAVE_SLOT = 'visual-novel-dialogue';
const SAVE_VERSION = 1;

interface DialogueSaveRecord extends VersionedRecord {
  readonly dialogue: DialogueSaveState;
}

export interface NovelShellState {
  readonly view: DialogueView;
  readonly choices: readonly ChoiceOption[];
  readonly history: DialogueHistory;
  /** What the DOM actually holds, read straight back out of the overlay. */
  readonly dom: {
    readonly visible: boolean;
    readonly revealing: boolean;
    readonly speaker: string;
    /** The complete text node, regardless of how much is painted. */
    readonly text: string;
    readonly portraitVisible: boolean;
    /** Choice buttons present in document order, as ids. */
    readonly buttons: readonly string[];
    /** Whether any element inside the overlay currently holds focus. */
    readonly holdsFocus: boolean;
  };
  readonly flags: { readonly trusted: boolean; readonly confided: boolean; readonly lied: boolean };
  /** The live accessibility setting the overlay is honouring. */
  readonly reducedMotion: boolean;
  readonly seenChapter1: boolean;
  readonly letters: number;
  readonly currency: number;
  readonly unlockedChapter2: boolean;
  readonly loadOutcome: string;
  readonly restoredFrom: DialogueSaveState | null;
}

export interface NovelShellService {
  state(): NovelShellState;
  start(nodeId?: string): void;
  /** What Space does: finish the reveal if one is running, else move on. */
  advance(): void;
  /** Move the conversation on regardless of the reveal - for walking the script. */
  advanceLine(): void;
  /** Click a choice button by id, through the DOM - not through the service. */
  clickChoice(choiceId: string): boolean;
  /** Take a choice through the service, bypassing the DOM. */
  choose(choiceId: string): void;
  grantLetter(): void;
  save(): void;
  /** Reload the dialogue from storage into a *fresh* service. */
  restore(): boolean;
  reset(): void;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: NOVEL_SHELL_CAPABILITY_ID,
  version: '0.1.0',
  provides: [NOVEL_SHELL_CAPABILITY_ID],
  dependencies: [DIALOGUE_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const dialogue = context.capabilities.require<DialogueService>(DIALOGUE_CAPABILITY_ID);
    const narrative = context.capabilities.require<NarrativeService>(CAPABILITY_IDS.narrative);
    const world = context.capabilities.get<WorldService>(CAPABILITY_IDS.world);
    const items = context.capabilities.require<ItemsService>(CAPABILITY_IDS.items);
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);

    const host = context.scene.game.canvas.parentElement ?? document.body;
    const overlay = createDialogueOverlay(host, dialogue, {
      resolvePortrait: (assetRole) => {
        // Portraits resolve through the theme like every other asset - the
        // dialogue document names a role, never a file.
        //
        // `assets.resolve` takes the canonical asset-role union, which has no
        // portrait-specific role today, so this document names existing roles
        // (`player`, `enemy`, `pickup`). A role outside the union resolves to
        // no art rather than throwing; the honest limitation is recorded rather
        // than papered over by widening the theme vocabulary from here.
        try {
          const key = context.assets.resolve(assetRole as Parameters<typeof context.assets.resolve>[0]);
          return context.scene.textures.getBase64(key);
        } catch {
          return null;
        }
      },
      reducedMotion: () => context.accessibility.reducedMotion,
      revealMsPerCharacter: 20,
    });

    let restoredFrom: DialogueSaveState | null = null;
    let loadOutcome = 'default';

    function domState(): NovelShellState['dom'] {
      const root = overlay.root;
      const query = (selector: string): HTMLElement | null => root.querySelector(selector);
      const active = root.ownerDocument.activeElement;
      return {
        visible: overlay.isVisible,
        revealing: overlay.isRevealing,
        speaker: query('[data-sw2d-dialogue="speaker"]')?.textContent ?? '',
        // Deliberately `textContent`, not what is painted: the whole point is
        // that the accessibility tree holds the full line from the first frame.
        text: query('[data-sw2d-dialogue="text"]')?.textContent ?? '',
        portraitVisible: query('[data-sw2d-dialogue="portrait"]')?.hidden === false,
        buttons: [...root.querySelectorAll('[data-sw2d-choice]')].map(
          (node) => (node as HTMLElement).dataset['sw2dChoice'] ?? '',
        ),
        holdsFocus: active instanceof Node && root.contains(active),
      };
    }

    function state(): NovelShellState {
      return {
        view: dialogue.view(),
        choices: dialogue.availableChoices(),
        history: dialogue.history(),
        dom: domState(),
        reducedMotion: context.accessibility.reducedMotion,
        flags: {
          trusted: narrative.hasFlag('trusted'),
          confided: narrative.hasFlag('confided'),
          lied: world?.hasFlag('lied-to-mara') ?? false,
        },
        seenChapter1: narrative.hasSeen('chapter-1'),
        letters: items.count('letter'),
        currency: progression.currency(),
        unlockedChapter2: progression.isUnlocked('chapter-2'),
        loadOutcome,
        restoredFrom,
      };
    }

    const shellService: NovelShellService = {
      state,
      start(nodeId) {
        dialogue.start(nodeId);
        overlay.refresh();
      },
      advance: () => overlay.advance(),
      advanceLine() {
        dialogue.advance();
        overlay.refresh();
      },
      clickChoice(choiceId) {
        const button = overlay.root.querySelector<HTMLButtonElement>(`[data-sw2d-choice="${choiceId}"]`);
        if (!button) return false;
        button.click();
        return true;
      },
      choose(choiceId) {
        dialogue.choose(choiceId);
        overlay.refresh();
      },
      grantLetter: () => {
        items.grant('letter');
        // The choice list is derived from world state, so the overlay has to be
        // told the world changed. Nothing polls.
        overlay.refresh();
      },
      save() {
        context.saves.save<DialogueSaveRecord>(SAVE_SLOT, {
          schemaVersion: SAVE_VERSION,
          dialogue: dialogue.save(),
        });
      },
      restore() {
        const loaded = context.saves.load<DialogueSaveRecord>(SAVE_SLOT, {
          currentVersion: SAVE_VERSION,
          createDefault: () => ({
            schemaVersion: SAVE_VERSION,
            dialogue: {
              nodeId: null,
              lineIndex: 0,
              status: 'idle',
              history: { nodeVisits: {}, lineViews: {}, choiceCounts: {}, spentChoices: [] },
            },
          }),
        });
        loadOutcome = loaded.outcome;
        if (loaded.outcome !== 'loaded') return false;
        restoredFrom = loaded.value.dialogue;
        // Restore into the live service: the same one the overlay is bound to,
        // so what the DOM shows afterwards is what the record actually held.
        dialogue.restore(loaded.value.dialogue);
        overlay.refresh();
        return true;
      },
      reset() {
        dialogue.reset();
        narrative.setFlag('trusted', false);
        narrative.setFlag('confided', false);
        world?.setFlag('lied-to-mara', false);
        items.remove('letter', items.count('letter'));
        restoredFrom = null;
        loadOutcome = 'default';
        overlay.refresh();
      },
    };

    const serviceHandle = context.capabilities.provide(NOVEL_SHELL_CAPABILITY_ID, shellService);
    const debugHandle = context.debug.contribute(NOVEL_SHELL_CAPABILITY_ID, state);

    let disposed = false;
    return {
      id: NOVEL_SHELL_CAPABILITY_ID,

      update(deltaMs: number): void {
        if (disposed) return;
        // The reveal runs on simulation time, so it pauses when the game does.
        // This advances the *animation* only - the conversation itself moves
        // exactly when the player asks it to.
        overlay.tick(deltaMs);
        const intent = uiSimulationController.read(context.input);
        if (intent.confirmPressed) overlay.advance();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        serviceHandle.dispose();
        overlay.dispose();
      },
    };
  },
};
