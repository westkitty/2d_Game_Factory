# Proof Contract — sokoban

Frozen before implementation. **Revised for capability program Phase 6 (ADR-0023):** the
Sokoban ruleset moved from ADR-0017's `configSource: 'code'` seam to the data-driven
`sw2d.puzzle-rules` capability. The acceptance bar is unchanged and strictly stronger — the
board is now serialized content, and `shellPack.ts` holds even less state than before.

## Preset

`sokoban` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `grid`,
required pack `sw2d.puzzle-rules` (only pack), content roles `tuning` and `puzzles`. Maturity
`proof-validated`.

Generated via `npm run sw2d -- new proof-sokoban --preset sokoban`, moved into this committed
`proofs/sokoban/` tree.

**History this proof closes:** `docs/demos/DEMO_MATRIX.md` records that the Phase 8
`demos/sokoban/` smoke-validated the *mechanic* by reimplementing push/undo/reset directly in
`shellPack.ts`. The Phase 10 proof then moved that state into `PuzzleService` via a code seam
(`packConfig.ts`) — real, but the rules were still game-specific TypeScript. This revision
removes the last of that: the entire ruleset is now the validated `content/puzzles.json`
document.

## Reusable capabilities exercised

- `sw2d.puzzle-rules` (`PuzzleRulesService`) — `load()` (auto-loaded on install), `apply(op)`,
  `undo()`, `reset()`, `isSolved()`, `snapshot()` are the **only** source of truth for board
  state. `shellPack.ts` reads `puzzle.snapshot()` every frame to render and calls
  `puzzle.apply({ kind: 'move', dir })` for every step; it holds no parallel `player`/`box`
  variables and no undo stack.
- The `sokoban` engine inside the pack owns legal-move / legal-push / solved resolution — the
  shell never re-derives "can the player step here" or "is the box on the goal".
- `gridController.read()` — one discrete `step` per press. `CANCEL` (`Backspace`) → `undo()`,
  `SECONDARY_ACTION` (`KeyK`) → `reset()`, read directly off `context.input` (the same pattern
  the tower-defense proof's upgrade trigger uses).

## Content

- `content/puzzles.json` — one `sokoban` definition (`id: "proof"`): `width`/`height` 5, the
  16 border wall cells, `boxes: [[2,2]]`, `goals: [[3,3]]`, `player: [1,1]`. Schema
  `puzzle-rules` (`urn:sw2d:schema:content-puzzle-rules:v1`), validated in `src/content.ts`
  before the `ContentBundle` is produced.
- `content/tuning.json` — generator default, validated, unused by grid-only gameplay.
- No `levels` role beyond the generator's default proof level (unused by this shell).

## Game-specific code (`src/game-specific/shellPack.ts`)

- **No rule code.** No walls table, no move resolver, no solved check — all of that is the
  pack engine driven by `content/puzzles.json`.
- Rendering only: one player sprite, one box sprite per `snapshot().boxes` entry, one
  half-alpha goal sprite per `snapshot().goals` entry, all positioned from the snapshot.
- `rejectedMoves` counter: incremented when a `move` op leaves `snapshot().moves` unchanged
  (the engine rejected an illegal move/push and pushed no history entry).
- `src/game-specific/packConfig.ts` — `PACK_CONFIG = {}` (this proof selects no
  code-configured pack).

## Terminal success/failure oracle

- **Success:** `puzzle.isSolved()` (via the debug snapshot's `solved`) is `true` and
  `snapshot().boxesOnGoals === snapshot().goalCount`.
- **Failure surface (all observable):** `snapshot` (`kind`, `moves`, `playerCol`, `playerRow`,
  `boxes`, `goals`, `boxesOnGoals`, `goalCount`), `solved`, `rejectedMoves`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Board (`#` wall, `G` goal, `P` player start, `B` box start), `(x,y)` from `(0,0)` top-left:
```
#####
#P..#
#.B.#
#..G#
#####
```

1. Start.
2. Move — `RIGHT` (player to (2,1), directly above the box; `moves` = 1).
3. Legal push — `DOWN` (box (2,2)→(2,3), player follows to (2,2)).
4. Invalid push — `DOWN` again (box's next cell (2,4) is the bottom wall) → rejected:
   `snapshot()` board is unchanged, `moves` is unchanged, `rejectedMoves` increments.
5. Reposition — `LEFT` to (1,2), `DOWN` to (1,3); then `RIGHT` pushes the box (2,3)→(3,3)
   onto the goal. `solved` is now `true`, but the journey continues.
6. Undo — `CANCEL` restores the exact state from immediately before step 5's push.
7. Reset — `SECONDARY_ACTION` restores the exact initial state, regardless of undo history
   (`moves` back to 0).
8. Solve — replay `RIGHT`, `DOWN`, `LEFT`, `DOWN`, `RIGHT` from the reset state.
9. `isSolved()` is `true` and `boxesOnGoals === goalCount`.

## Acceptance

- Single canonical state: `puzzle.snapshot()` is the only board state; `shellPack.ts` holds
  none.
- Ruleset is content: walls, box, goal and dimensions are `content/puzzles.json`, not code.
- Exact invalid-push behavior: a rejected push leaves the snapshot unchanged and pushes no
  history entry (`moves` does not advance).
- Exact undo/reset: both restore precisely the promised state (previous entry / initial
  state).
- Solved detection: `isSolved()` and `boxesOnGoals === goalCount` agree.
- Real `sw2d.puzzle-rules` capability installed and exercised — not bypassed.
- No puzzle DSL: `content/puzzles.json` is a bounded discriminated union of built-in kinds.
