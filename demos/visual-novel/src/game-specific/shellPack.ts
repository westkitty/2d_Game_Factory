import type { InstalledSystemPack } from '@sw2d/contracts';
import { uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type NarrativeService } from '@sw2d/packs';

/**
 * Visual Novel demo (Phase 8 representative demo 12/12).
 *
 * Smoke contract: visible dialogue/speaker, one choice, branch/flag change,
 * one ending. Presented via semantic DOM (a plain overlay appended next to
 * the game canvas, the same pattern index.html's own #touch-controls
 * buttons already use), not a canvas text framework - `sw2d.narrative`
 * itself is deliberately just state (current node, flags, choices, seen
 * entries; MASTER_PROJECT.md §9), with no scripting language, renderer, or
 * dialogue graph loader - so the tree and its presentation are game-
 * specific TypeScript, the same conclusion this preset's own
 * knownLimitations already states.
 *
 * Selection input stays on the one semantic ActionInput path
 * (uiSimulationController) - no second, parallel DOM-click input owner.
 */

interface Choice {
  readonly id: string;
  readonly label: string;
  readonly next: string;
}

interface DialogueNode {
  readonly id: string;
  readonly speaker: string;
  readonly text: string;
  readonly next?: string;
  readonly choices?: readonly Choice[];
  readonly isEnding?: boolean;
}

const NODES: Record<string, DialogueNode> = {
  start: {
    id: 'start',
    speaker: 'Narrator',
    text: 'A noise echoes from the old workshop down the street.',
    next: 'question',
  },
  question: {
    id: 'question',
    speaker: 'Stranger',
    text: 'Do you go investigate, or walk away?',
    choices: [
      { id: 'brave', label: 'Investigate the noise', next: 'brave-ending' },
      { id: 'cautious', label: 'Walk away', next: 'cautious-ending' },
    ],
  },
  'brave-ending': {
    id: 'brave-ending',
    speaker: 'Narrator',
    text: 'Inside, you find nothing but a stray cat knocking over tools. End.',
    isEnding: true,
  },
  'cautious-ending': {
    id: 'cautious-ending',
    speaker: 'Narrator',
    text: 'You keep walking. Whatever it was, it is not your problem tonight. End.',
    isEnding: true,
  },
};

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.ui-simulation-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.narrative],

  install(context: SceneContext): InstalledSystemPack {
    const narrative = context.capabilities.require<NarrativeService>(CAPABILITY_IDS.narrative);

    const host = document.getElementById('app') ?? document.body;
    const overlay = document.createElement('div');
    overlay.id = 'vn-dialogue';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Dialogue');

    const speakerEl = document.createElement('div');
    speakerEl.id = 'vn-speaker';
    const textEl = document.createElement('div');
    textEl.id = 'vn-text';
    const choicesEl = document.createElement('ul');
    choicesEl.id = 'vn-choices';

    overlay.append(speakerEl, textEl, choicesEl);
    host.appendChild(overlay);

    let choiceIndex = 0;

    function currentNode(): DialogueNode {
      return NODES[narrative.currentNode()!]!;
    }

    function render(): void {
      const node = currentNode();
      speakerEl.textContent = node.speaker;
      textEl.textContent = node.text;
      choicesEl.innerHTML = '';
      if (node.choices) {
        node.choices.forEach((choice, index) => {
          const li = document.createElement('li');
          li.textContent = choice.label;
          li.dataset.selected = String(index === choiceIndex);
          if (index === choiceIndex) li.setAttribute('aria-current', 'true');
          choicesEl.appendChild(li);
        });
      }
    }

    function enterNode(nodeId: string): void {
      narrative.goTo(nodeId);
      narrative.markSeen(nodeId);
      choiceIndex = 0;
      if (NODES[nodeId]!.isEnding) narrative.setFlag('ended', true);
      render();
    }

    enterNode('start');

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({
      currentNode: narrative.currentNode(),
      choiceIndex,
      seenEntries: narrative.seenEntries(),
      chosenChoices: narrative.chosenChoices(),
      ended: narrative.hasFlag('ended'),
      domSpeaker: speakerEl.textContent,
      domText: textEl.textContent,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const node = currentNode();
        const intent = uiSimulationController.read(context.input);

        if (node.choices) {
          if (intent.navigateDownPressed) choiceIndex = (choiceIndex + 1) % node.choices.length;
          else if (intent.navigateUpPressed) choiceIndex = (choiceIndex - 1 + node.choices.length) % node.choices.length;
          if (intent.navigateDownPressed || intent.navigateUpPressed) render();

          if (intent.confirmPressed) {
            const choice = node.choices[choiceIndex]!;
            narrative.choose(choice.id, choice.next);
            enterNode(choice.next);
          }
          return;
        }

        if (intent.confirmPressed && node.next) enterNode(node.next);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          overlay.remove();
        } catch {
          /* already removed */
        }
      },
    };
  },
};
