# Proof Contract — puzzle-platformer

Capability program Phase 6 (data-driven puzzle rules, ADR-0023) - the `switch-sequence` consumer. Written retroactively by the Category-C convergence program from the committed spec (`packages/qa/proof-specs/puzzlePlatformer.ts`) and the PROOF_MATRIX row; the proof game itself is frozen and unchanged.

## Preset

`puzzle-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform (+ grid)`, required packs **`sw2d.puzzle-rules`**, `sw2d.world`, `sw2d.world-entities`. Content roles tuning, levels.

## Reusable capability exercised

- `sw2d.puzzle-rules` `switch-sequence` kind: the switch set, the `a`→`d` link and the "press order must end `a,b,c`" completion rule are all `content/puzzles.json`; the platform shell only toggles the overlapped switch on INTERACT, undoes on CANCEL and resets on SECONDARY_ACTION.

## Terminal success/failure oracle

- **Success surface:** B out of order is not solved; A also switches on the linked decoy D; B then C ends the press order `a,b,c` -> solved; undo un-solves; reset clears the press order and on-set; re-solving in order works.
- **Failure surface:** the service snapshot's switch on-set, press order and `solved`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start.
2. Press B (out of order) -> not solved.
3. Press A -> D switches on via the link -> not solved.
4. Press B then C -> press order ends `a,b,c` -> solved.
5. Undo -> not solved. Reset -> press order and on-set cleared.
6. Re-solve in order.

## Acceptance

- No completion logic in the shell.
- Zero console errors, zero external requests.
