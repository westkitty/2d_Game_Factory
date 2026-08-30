import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 1 proof - point-and-click (see proofs/point-and-click/PROOF_CONTRACT.md).
 *
 * Real generated game, real mouse events: hover enter/leave tracks the cursor,
 * a click pulls a lever, and a key is dragged onto a chest drop-zone - all
 * through the reusable interaction service.
 */

interface ShellSnap {
  readonly leverHovered: boolean;
  readonly leverPulled: boolean;
  readonly keyInChest: boolean;
  readonly hoveredId: string | null;
  readonly draggingId: string | null;
  readonly keyX: number;
  readonly keyY: number;
  // Post-ten Phase 20 surface.
  readonly dialogue: { readonly status: string; readonly nodeId: string | null; readonly lineId: string | null };
  readonly dialogueButtons: readonly string[];
  readonly dialogueText: string;
  readonly dialogueRevealing: boolean;
  readonly reducedMotion: boolean;
  readonly chestBlessed: boolean;
  readonly blessedOnDrop: boolean | null;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.pointer-shell');
}

async function pointerAt(harness: Harness, type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number): Promise<void> {
  await harness.page.evaluate((p: { type: string; x: number; y: number }) => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + (p.x / canvas.width) * r.width;
    const clientY = r.top + (p.y / canvas.height) * r.height;
    canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
  }, { type, x, y });
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk = started.scene === 'sw2d.play' && !initial.leverPulled && !initial.keyInChest;

  // Hover enter / leave.
  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(3);
  const onLever = await state(harness);
  await pointerAt(harness, 'pointermove', 480, 120);
  await harness.stepFrames(3);
  const offLever = await state(harness);
  evidence.onLever = onLever;
  evidence.offLever = offLever;
  const hoverOk = onLever.hoveredId === 'lever' && onLever.leverHovered && !offLever.leverHovered && offLever.hoveredId === null;

  // Click the lever.
  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 200, 270);
  await harness.stepFrames(2);
  const afterLever = await state(harness);
  evidence.afterLever = afterLever;
  const clickOk = afterLever.leverPulled === true && afterLever.keyInChest === false;

  // Drag the key onto the chest.
  await pointerAt(harness, 'pointermove', 480, 400);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 480, 400);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 600, 335);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 760, 270);
  await harness.stepFrames(2);
  const midDrag = await state(harness);
  await pointerAt(harness, 'pointerup', 760, 270);
  await harness.stepFrames(3);
  const afterDrop = await state(harness);
  evidence.midDrag = midDrag;
  evidence.afterDrop = afterDrop;
  const dragOk =
    midDrag.draggingId === 'key' &&
    Math.abs(midDrag.keyX - 760) <= 4 &&
    afterDrop.keyInChest === true &&
    afterDrop.draggingId === null &&
    Math.abs(afterDrop.keyX - 760) <= 4 &&
    Math.abs(afterDrop.keyY - 270) <= 4;

  // Restart genuinely reinstalls.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    !afterRestart.leverPulled &&
    !afterRestart.keyInChest &&
    Math.abs(afterRestart.keyX - 480) <= 4 &&
    Math.abs(afterRestart.keyY - 400) <= 4;

  // --- Post-ten Phase 20: world click -> dialogue -> choice -> consequence ---
  // The five steps above are the certified Phase-1 journey and are unchanged.

  // 6. Clicking a world object opens a real conversation. Nothing was showing
  //    before the click - installing a dialogue does not start one.
  const beforeClick = await state(harness);
  await pointerAt(harness, 'pointermove', 480, 180);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 480, 180);
  await pointerAt(harness, 'pointerup', 480, 180);
  await harness.stepFrames(4);
  const opened = await state(harness);
  evidence.dialogueOpened = { before: beforeClick.dialogue, after: opened.dialogue, text: opened.dialogueText };
  const worldClickOpensDialogueOk =
    beforeClick.dialogue.status === 'idle' &&
    opened.dialogue.status === 'lines' &&
    opened.dialogue.nodeId === 'warden-greets' &&
    // The full line is in the DOM immediately - the same accessibility bar the
    // visual-novel proof holds the overlay to.
    opened.dialogueText === 'That chest has been shut since the flood.';

  // 7. Advancing presents the choices as real buttons - and proves the reveal's
  //    two-press rule on the way. While a reveal is painting, CONFIRM completes
  //    it rather than skipping the line; only the next press moves on. A player
  //    who reads faster than the animation must never lose a line to an eager
  //    keypress. With reduced motion there is no reveal to complete, so one
  //    press is enough; this asserts whichever is correct here.
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  const afterFirstPress = await state(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  const atChoices = await state(harness);
  evidence.dialogueChoices = {
    reducedMotion: afterFirstPress.reducedMotion,
    afterFirstPress: { status: afterFirstPress.dialogue.status, revealing: afterFirstPress.dialogueRevealing },
    status: atChoices.dialogue.status,
    buttons: atChoices.dialogueButtons,
  };
  const twoPressRuleOk = afterFirstPress.reducedMotion
    ? afterFirstPress.dialogue.status === 'choices' // nothing to complete
    : afterFirstPress.dialogue.status === 'lines' && afterFirstPress.dialogueRevealing === false;
  const dialogueChoicesOk =
    twoPressRuleOk &&
    atChoices.dialogue.status === 'choices' &&
    atChoices.dialogueButtons.join(',') === 'bless,demur';

  // 8. Taking the choice through its button applies the effect: a world flag,
  //    written through world.state rather than kept inside the dialogue.
  await harness.page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-sw2d-choice="bless"]')?.click();
  });
  await harness.stepFrames(4);
  const afterChoice = await state(harness);
  evidence.afterChoice = { node: afterChoice.dialogue.nodeId, blessed: afterChoice.chestBlessed };
  const dialogueChoiceEffectOk =
    afterChoice.dialogue.nodeId === 'warden-relents' &&
    afterChoice.chestBlessed === true &&
    beforeClick.chestBlessed === false;

  // 9. The conversation ends and the overlay goes away, leaving the world alone.
  //    Two presses again: the first completes the last line's reveal.
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  const ended = await state(harness);
  evidence.ended = { status: ended.dialogue.status, buttons: ended.dialogueButtons };
  const dialogueEndsOk = ended.dialogue.status === 'ended' && ended.dialogueButtons.length === 0;

  // 10. **The consequence.** An ordinary world interaction some time later - the
  //     same drag-and-drop the Phase-1 journey already proved - observes what
  //     was decided in the conversation. This is the thing a fake dialogue
  //     cannot produce.
  await pointerAt(harness, 'pointermove', 480, 400);
  await pointerAt(harness, 'pointerdown', 480, 400);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 760, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 760, 270);
  await harness.stepFrames(4);
  const afterConsequence = await state(harness);
  evidence.consequence = {
    keyInChest: afterConsequence.keyInChest,
    blessedOnDrop: afterConsequence.blessedOnDrop,
  };
  const laterInteractionObservesConsequenceOk =
    afterConsequence.keyInChest === true && afterConsequence.blessedOnDrop === true;

  const passed =
    startedOk &&
    hoverOk &&
    clickOk &&
    dragOk &&
    restartOk &&
    worldClickOpensDialogueOk &&
    dialogueChoicesOk &&
    dialogueChoiceEffectOk &&
    dialogueEndsOk &&
    laterInteractionObservesConsequenceOk;
  return {
    passed,
    details: {
      ...evidence,
      startedOk,
      hoverOk,
      clickOk,
      dragOk,
      restartOk,
      worldClickOpensDialogueOk,
      dialogueChoicesOk,
      dialogueChoiceEffectOk,
      dialogueEndsOk,
      laterInteractionObservesConsequenceOk,
    },
  };
}
