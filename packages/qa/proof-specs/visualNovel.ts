import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { NovelShellState } from '../../proofs/visual-novel/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.novel-shell';

const state = (h: Harness): Promise<NovelShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

/** Advance until the reveal finishes and the line settles. */
async function settle(harness: Harness): Promise<NovelShellState> {
  let current = await state(harness);
  let guard = 0;
  while (current.dom.revealing && guard < 60) {
    await harness.stepFrames(4);
    guard += 4;
    current = await state(harness);
  }
  return current;
}

/**
 * Walk to the end of the current node's lines, into its choices.
 *
 * Deliberately `advanceLine()` rather than the overlay's `advance()`: the latter
 * spends its first press completing an in-progress reveal, which is correct UX
 * and useless for walking a script. The two-press behaviour has its own step.
 */
async function toChoices(harness: Harness, budget = 12): Promise<NovelShellState> {
  let current = await state(harness);
  let steps = 0;
  while (current.view.status === 'lines' && steps < budget) {
    await evalShell(harness, `(s) => s.advanceLine()`);
    current = await settle(harness);
    steps += 1;
  }
  return current;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);

  // 1. Boot: the pack is installed and the dialogue is idle until started -
  //    installing a conversation does not start one.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { view: s1.view, dom: s1.dom };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.dialogue') &&
    s1.view.status === 'idle' &&
    s1.dom.visible === false;

  // 2. Start: the first authored line, its speaker's display name, and the
  //    portrait resolved from the character's default expression.
  await evalShell(harness, `(s) => s.start()`);
  const s2 = await settle(harness);
  evidence.start = { view: s2.view, dom: s2.dom };
  const step2_start =
    s2.view.status === 'lines' &&
    s2.view.nodeId === 'arrival' &&
    s2.view.lineId === 'arr-1' &&
    s2.view.speakerName === 'Mara' &&
    s2.view.expression === 'calm' && // the character's authored default
    s2.dom.visible === true &&
    s2.dom.speaker === 'Mara' &&
    s2.dom.portraitVisible === true;

  // 3. **The accessibility bar.** Advance to the next line and read the DOM
  //    *immediately*, before a single frame of reveal has run. The complete line
  //    is already there. A typewriter that appends characters would fail this,
  //    and would make a screen reader announce a growing fragment over and over.
  //
  //    The second half asserts reduced motion: a reveal is running exactly when
  //    motion is allowed, and is skipped outright when it is not. Written to
  //    hold in either environment rather than to assume one.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const revealing = await state(harness);
  evidence.accessibility = {
    reducedMotion: revealing.reducedMotion,
    revealing: revealing.dom.revealing,
    text: revealing.dom.text,
    viewText: revealing.view.text,
  };
  const step3_fullTextImmediately =
    revealing.view.lineId === 'arr-2' &&
    revealing.dom.text === 'The tide went out an hour ago.' &&
    revealing.dom.text === revealing.view.text &&
    revealing.dom.revealing === (revealing.reducedMotion === false);

  // 4. No focus trap: nothing in the overlay grabs focus when a line appears.
  //    A player who tabs away must be able to leave and come back.
  const s4 = await settle(harness);
  evidence.focus = { holdsFocus: s4.dom.holdsFocus };
  const step4_noFocusTrap = s4.dom.holdsFocus === false;

  // 5. Expression change: this line names a different expression from the one
  //    before it, and the portrait role moves with it.
  const s5 = s4;
  evidence.expression = { first: s2.view.portraitRole, second: s5.view.portraitRole, view: s5.view };
  const step5_expressionChanges =
    s5.view.lineId === 'arr-2' && s5.view.expression === 'angry' && s5.view.portraitRole !== s2.view.portraitRole;

  // 6. A line with no speaker shows no name and no portrait - narration is a
  //    first-class thing, not a character with a blank name.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s6 = await settle(harness);
  evidence.narration = { view: s6.view, dom: s6.dom };
  const step6_narration =
    s6.view.lineId === 'arr-3' &&
    s6.view.speakerName === null &&
    s6.view.portraitRole === null &&
    s6.dom.speaker === '' &&
    s6.dom.portraitVisible === false;

  // 7. At the end of the node the choices appear as real buttons, and the
  //    conditional one is absent because its condition does not hold.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s7 = await state(harness);
  evidence.choices = { status: s7.view.status, options: s7.choices, buttons: s7.dom.buttons };
  const step7_choicesAppear =
    s7.view.status === 'choices' &&
    s7.dom.buttons.join(',') === 'apologise,deflect' && // `confide` is gated on the letter
    s7.choices.find((choice) => choice.id === 'confide')!.available === false &&
    s7.choices.find((choice) => choice.id === 'confide')!.blockedBy === 'conditions';

  // 8. Advancing cannot skip past a pending decision.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s8 = await state(harness);
  evidence.noSkip = { status: s8.view.status, nodeId: s8.view.nodeId };
  const step8_cannotSkipDecision = s8.view.status === 'choices' && s8.view.nodeId === 'arrival';

  // 9. Supplying the world fact makes the gated choice appear - as a real
  //    button, not merely as an available option in the model.
  await evalShell(harness, `(s) => s.grantLetter()`);
  const s9 = await state(harness);
  evidence.gated = { letters: s9.letters, buttons: s9.dom.buttons };
  const step9_conditionalChoice =
    s9.letters === 1 &&
    s9.dom.buttons.includes('confide') &&
    s9.choices.find((choice) => choice.id === 'confide')!.available === true;

  // 10. Clicking a choice **button** takes the branch and applies its effects.
  //     The click goes through the DOM, the way a player's would.
  const clicked = await evalShell<boolean>(harness, `(s) => s.clickChoice('apologise')`);
  const s10 = await settle(harness);
  evidence.branch = { clicked, view: s10.view, flags: s10.flags, history: s10.history };
  const step10_branchByClick =
    clicked === true &&
    s10.view.nodeId === 'forgiven' &&
    s10.flags.trusted === true && // the choice's effect wrote through narrative.state
    s10.history.choiceCounts['apologise'] === 1;

  // 11. A line effect grants an item through the items capability, and the
  //     node's `next` reconverges both branches onto the same jetty scene.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const afterGrant = await settle(harness);
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s11 = await settle(harness);
  evidence.reconverge = { letters: afterGrant.letters, view: s11.view, seen: s11.seenChapter1 };
  const step11_effectsAndReconvergence =
    afterGrant.letters === 2 && // the granted letter, on top of the one we gave
    s11.view.nodeId === 'jetty' &&
    s11.view.lineId === 'jet-1' &&
    s11.seenChapter1 === true; // the mark-seen effect wrote narrative.state's codex

  // 12. The consequence persists: at the jetty only the branch actually taken
  //     offers its reflection. This is the whole point of a branch.
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s12 = await state(harness);
  evidence.consequence = { buttons: s12.dom.buttons, options: s12.choices };
  const step12_persistentConsequence =
    s12.view.status === 'choices' &&
    s12.dom.buttons.includes('reflect') && // gated on `trusted`, which we set
    s12.dom.buttons.includes('regret') === false && // gated on the lie we did not tell
    s12.dom.buttons.includes('board') === true;

  // 13. The other branch reaches the same node with the opposite consequence -
  //     proving step 12 measured the branch and not merely the node.
  await evalShell(harness, `(s) => { s.reset(); s.start(); }`);
  await settle(harness);
  await toChoices(harness);
  await evalShell(harness, `(s) => s.clickChoice('deflect')`);
  await settle(harness);
  // `doubted` has two lines, then `next` reconverges on the jetty.
  await evalShell(harness, `(s) => s.advanceLine()`);
  await settle(harness);
  await evalShell(harness, `(s) => s.advanceLine()`);
  const atJetty = await settle(harness);
  await evalShell(harness, `(s) => s.advanceLine()`);
  const s13 = await state(harness);
  evidence.otherBranch = { jetty: atJetty.view.nodeId, flags: s13.flags, buttons: s13.dom.buttons };
  const step13_oppositeConsequence =
    atJetty.view.nodeId === 'jetty' &&
    s13.flags.lied === true &&
    s13.flags.trusted === false &&
    s13.dom.buttons.includes('regret') === true &&
    s13.dom.buttons.includes('reflect') === false;

  // 14. A choice effect reaches progression, and its currency and unlock land.
  await evalShell(harness, `(s) => s.clickChoice('regret')`);
  const s14 = await settle(harness);
  evidence.progression = { currency: s14.currency, unlocked: s14.unlockedChapter2, node: s14.view.nodeId };
  const step14_progressionEffect =
    s14.currency === 5 && s14.unlockedChapter2 === true && s14.view.nodeId === 'reflection';

  // 15. Save and restore continue the conversation exactly where it was, and the
  //     record holds ids rather than text - so proofreading cannot break a save.
  const saved = await evalShell<{ nodeId: string | null; lineIndex: number }>(
    harness,
    `(s) => { s.save(); return s.state().view; }`,
  );
  await evalShell(harness, `(s) => { s.reset(); }`);
  const wiped = await state(harness);
  const restored = await evalShell<boolean>(harness, `(s) => s.restore()`);
  const s15 = await settle(harness);
  evidence.persistence = {
    savedNode: saved.nodeId,
    wiped: wiped.view.status,
    restored,
    view: s15.view,
    record: s15.restoredFrom,
  };
  const step15_saveRestore =
    wiped.view.status === 'idle' && // genuinely cleared before restoring
    restored === true &&
    s15.loadOutcome === 'loaded' &&
    s15.view.nodeId === 'reflection' &&
    s15.view.lineId === 'ref-1' &&
    JSON.stringify(s15.restoredFrom).includes('It will matter later') === false;

  // 16. Restoring does not re-run the restored line's effects. A reload must not
  //     pay out every consequence a second time.
  //
  //     Deliberately saved while standing on a line that *has* an effect
  //     (`for-2` grants the letter). Restoring onto an effect-free line would
  //     make this step pass against an implementation that re-runs everything.
  await evalShell(harness, `(s) => { s.reset(); s.start(); }`);
  await settle(harness);
  await toChoices(harness);
  await evalShell(harness, `(s) => s.clickChoice('apologise')`);
  await settle(harness);
  await evalShell(harness, `(s) => s.advanceLine()`); // for-1 -> for-2, grants the letter
  const onEffectLine = await settle(harness);
  await evalShell(harness, `(s) => s.save()`);
  await evalShell(harness, `(s) => s.restore()`);
  const s16 = await state(harness);
  evidence.noDoubleEffects = {
    line: onEffectLine.view.lineId,
    before: { letters: onEffectLine.letters, currency: onEffectLine.currency },
    after: { letters: s16.letters, currency: s16.currency },
  };
  const step16_restoreDoesNotReapply =
    onEffectLine.view.lineId === 'for-2' &&
    onEffectLine.letters === 1 && // the line's grant fired exactly once
    s16.view.lineId === 'for-2' &&
    s16.letters === 1 && // and did not fire again on restore
    s16.currency === onEffectLine.currency;

  // 17. History survives the round trip: a spent `once` choice stays spent, so a
  //     reload cannot refund a decision.
  await evalShell(harness, `(s) => { s.reset(); s.start(); }`);
  await settle(harness);
  await toChoices(harness);
  await evalShell(harness, `(s) => s.clickChoice('apologise')`);
  await settle(harness);
  await evalShell(harness, `(s) => s.save()`);
  await evalShell(harness, `(s) => { s.reset(); s.restore(); }`);
  const s17 = await state(harness);
  evidence.onceSurvives = { spent: s17.history.spentChoices, counts: s17.history.choiceCounts };
  const step17_onceSurvivesReload =
    s17.history.spentChoices.includes('apologise') && s17.history.choiceCounts['apologise'] === 1;

  // 18. Looping back proves the once-choice is genuinely spent: the same node
  //     now offers it no button at all.
  await evalShell(harness, `(s) => s.start('arrival')`);
  await settle(harness);
  const looped = await toChoices(harness);
  evidence.spent = { buttons: looped.dom.buttons, options: looped.choices };
  const step18_spentChoiceGone =
    looped.view.status === 'choices' &&
    looped.dom.buttons.includes('apologise') === false &&
    looped.choices.find((choice) => choice.id === 'apologise')!.blockedBy === 'spent' &&
    looped.dom.buttons.includes('deflect') === true; // the repeatable one is still there

  const passed =
    step1_boot &&
    step2_start &&
    step3_fullTextImmediately &&
    step4_noFocusTrap &&
    step5_expressionChanges &&
    step6_narration &&
    step7_choicesAppear &&
    step8_cannotSkipDecision &&
    step9_conditionalChoice &&
    step10_branchByClick &&
    step11_effectsAndReconvergence &&
    step12_persistentConsequence &&
    step13_oppositeConsequence &&
    step14_progressionEffect &&
    step15_saveRestore &&
    step16_restoreDoesNotReapply &&
    step17_onceSurvivesReload &&
    step18_spentChoiceGone;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_start,
      step3_fullTextImmediately,
      step4_noFocusTrap,
      step5_expressionChanges,
      step6_narration,
      step7_choicesAppear,
      step8_cannotSkipDecision,
      step9_conditionalChoice,
      step10_branchByClick,
      step11_effectsAndReconvergence,
      step12_persistentConsequence,
      step13_oppositeConsequence,
      step14_progressionEffect,
      step15_saveRestore,
      step16_restoreDoesNotReapply,
      step17_onceSurvivesReload,
      step18_spentChoiceGone,
    },
  };
}
