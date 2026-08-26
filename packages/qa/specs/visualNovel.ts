import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly currentNode: string | null;
  readonly choiceIndex: number;
  readonly seenEntries: readonly string[];
  readonly chosenChoices: readonly string[];
  readonly ended: boolean;
  readonly domSpeaker: string | null;
  readonly domText: string | null;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.ui-simulation-shell');
}

function domChoiceLabels(harness: Harness): Promise<string[]> {
  return harness.evaluate(() => Array.from(document.querySelectorAll('#vn-choices li')).map((li) => li.textContent ?? ''));
}

/**
 * Smoke contract: visible dialogue/speaker, one choice, branch/flag change,
 * one ending.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(5);

  const spawnShell = await state(harness);
  const visibleDialogueProven = spawnShell.currentNode === 'start' && spawnShell.domSpeaker === 'Narrator' && (spawnShell.domText ?? '').length > 0;

  // Advance the linear intro node to the choice node.
  await harness.keyTap('Space');
  const afterAdvance = await state(harness);
  const choiceLabelsAtQuestion = await domChoiceLabels(harness);
  const choiceVisibleProven = afterAdvance.currentNode === 'question' && choiceLabelsAtQuestion.length === 2;

  // Move selection down (index 0 -> 1: "walk away") - proves real
  // navigation input, not just committing the default option.
  await harness.keyTap('ArrowDown');
  const afterNavigate = await state(harness);
  const selectionMovesProven = afterNavigate.choiceIndex === 1;

  // Commit the selected (non-default) choice.
  await harness.keyTap('Space');
  const afterChoice = await state(harness);
  const branchProven = afterChoice.chosenChoices.includes('cautious') && afterChoice.currentNode === 'cautious-ending';

  const endingProven = afterChoice.ended === true && (afterChoice.domText ?? '').length > 0 && afterChoice.domSpeaker === 'Narrator';

  return {
    passed: visibleDialogueProven && choiceVisibleProven && selectionMovesProven && branchProven && endingProven,
    details: {
      spawnShell,
      afterAdvance,
      choiceLabelsAtQuestion,
      afterNavigate,
      afterChoice,
      visibleDialogueProven,
      choiceVisibleProven,
      selectionMovesProven,
      branchProven,
      endingProven,
    },
  };
}
