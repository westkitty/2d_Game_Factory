# Proof Contract — visual-novel

Frozen before implementation. Post-ten program Phase 20 (narrative dialogue, choices & portraits, ADR-0034).

## Preset

`visual-novel` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family
`ui-simulation`, required packs `sw2d.narrative`, **`sw2d.dialogue`**. Content roles
`tuning`, **`dialogue`**.

## Reusable capability exercised

`narrative.dialogue` (`DialogueService`), driven entirely by the validated
`content/dialogue.json` (`urn:sw2d:schema:content-dialogue:v1`): characters with portraits
by expression, nodes and lines, choices with conditions and effects, `once` choices,
branching and reconvergence, history, and save/restore — plus the runtime's
`createDialogueOverlay`, which is the presentation every generated game would get rather
than one written for this proof.

Conditions and effects are closed unions. Every effect writes through the capability that
owns the state it touches: narrative flags to `narrative.state`, world flags to
`world.state`, items to `items.state`, currency and unlocks to `progression.state`.

## What is deliberately game-specific

Presentation placement and one input wire. The shell holds no cursor, no history and no
branch state, and decides nothing about which choices are available. There is no `update()`
on the service or the pack — a conversation moves when the player asks it to; the only
thing the frame drives is the reveal animation.

## Terminal success/failure oracle

- **Success surface:** the service's full view (status, node, line, speaker, portrait role,
  expression, choices with availability and blocking reason), the complete history, the
  live accessibility setting, and **what the DOM actually holds** — the text node's
  `textContent`, whether the portrait is shown, the choice buttons present in document
  order, and whether anything inside the overlay holds focus.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 18-step verification)

1. Boot: `sw2d.dialogue` installed, dialogue idle, nothing showing. Installing a
   conversation does not start one.
2. Start: the first authored line, the speaker's display name, and the portrait resolved
   from the character's authored default expression.
3. **The accessibility bar.** Advance a line and read the DOM *immediately*, before a single
   frame of reveal has run: the complete line is already there and equals what the service
   reports. A typewriter that appends characters fails this. The second half asserts reduced
   motion — a reveal runs exactly when motion is allowed and is skipped outright when it is
   not — written to hold in either environment rather than to assume one.
4. **No focus trap:** nothing inside the overlay holds focus when a line appears.
5. A line naming a different expression moves the portrait role with it.
6. A line with no speaker shows no name and no portrait. Narration is first-class, not a
   character with a blank name.
7. At the end of the node the choices appear as **real buttons**, and the conditional one is
   absent, reporting `blockedBy: 'conditions'`.
8. Advancing cannot skip past a pending decision.
9. Supplying the world fact makes the gated choice appear as a button, not merely as an
   available option in the model.
10. Clicking a choice **button** — through the DOM, the way a player's click goes — takes the
    branch and applies its effect through `narrative.state`.
11. A line effect grants an item through `items.state`, and the node's `next` reconverges.
12. **The consequence persists:** at the jetty, only the branch actually taken offers its
    reflection.
13. The other branch reaches the same node with the *opposite* consequence — which is what
    proves step 12 measured the branch rather than the node.
14. A choice effect reaches `progression.state`: currency and an unlock both land.
15. Save and restore continue the conversation exactly where it was, and the record contains
    ids rather than text — asserted by checking the line's words are absent from it.
16. Restoring does not re-run the restored line's effects. Deliberately saved while standing
    on a line that *has* an effect; restoring onto an effect-free line would let this pass
    against an implementation that re-runs everything.
17. A spent `once` choice survives the round trip. A reload cannot refund a decision.
18. Looping back proves it: the same node offers that choice no button at all, reporting
    `blockedBy: 'spent'`, while the repeatable one is still there.

## Negative controls

| Sabotage | Expected |
| --- | --- |
| The typewriter appends characters instead of clipping | step 3 FAILS |
| A spent `once` choice is offered again | step 18 FAILS |
| Restoring re-shows the line, re-running its effects | step 16 FAILS |
| Choice conditions are ignored | steps 7, 12, 13 FAIL |
| Advancing steps past a pending decision | steps 7-11 FAIL |
| An effect skips its capability owner | steps 13-15 FAIL |

The restore control is the one worth reading: it initially **passed**, because step 16
restored onto a line with no effects. The step was rewritten to save while standing on a
line that grants an item, and the control then failed as it should.
