# Proof Contract — sokoban

Frozen before implementation.

## Preset

`sokoban` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `grid`, required pack `sw2d.puzzle` (only pack), content role `tuning` only (no `levels` — this preset has none). Currently `smoke-validated`.

Generated via `npm run sw2d -- new proof-sokoban --preset sokoban`, moved into this committed `proofs/sokoban/` tree.

**This is the proof the Phase 9 architecture doc flags explicitly:** `docs/demos/DEMO_MATRIX.md` records that the Phase 8 `demos/sokoban/` smoke-validated the *mechanic* by reimplementing push/undo/reset directly in `shellPack.ts`, parallel to `sw2d.puzzle`, never actually installing or exercising the real pack. This proof does not repeat that gap — the game state lives in `PuzzleService` via `src/game-specific/packConfig.ts` (ADR-0017's `configSource: 'code'` seam), and `shellPack.ts` never maintains a second canonical state or undo stack of its own.

## Reusable capabilities exercised

- `sw2d.puzzle` (`PuzzleService<SokobanState>`) — `current()`, `apply(operation)`, `undo()`, `reset()`, `isSolved()` are the **only** source of truth for board state. `shellPack.ts` reads `puzzle.current()` every frame to render and calls `puzzle.apply(...)` for every legal move/push; it holds no parallel `player`/`box` variables of its own.
- `gridController.read()` — one discrete `step` per press, `confirmPressed`/`cancelPressed` used for reset/undo (see below).
- ADR-0017's code-config seam: `src/game-specific/packConfig.ts` supplies real `createInitialState`/`isSolved` functions, replacing the generated placeholder (`PlaceholderPuzzleState`/`SOLVED_AT_MOVES`) entirely.

## Game-specific mechanics (`src/game-specific/shellPack.ts` + `packConfig.ts`)

- Board layout (walls, the single goal cell) is a small hand-authored constant table in `packConfig.ts`, closed over by both `createInitialState` and `isSolved` — this is the bounded game-specific "puzzle's own rules are TypeScript, not content" the preset's own documented limitation already describes; no universal puzzle DSL is introduced.
- `SokobanState = { player: {x,y}, box: {x,y} }` — the entire opaque `TState` the pack's generic `PuzzleService<TState>` operates on.
- Move resolution (in `shellPack.ts`, translating a `gridController` step into a state transition) follows the standard Sokoban rule: stepping into an empty cell moves the player; stepping into the box's cell pushes the box one further cell in the same direction **only if** that farther cell is empty (not a wall, not off-board) — otherwise the entire action is rejected and `puzzle.apply()` is not called at all, so no history entry is created for a no-op.
- `CANCEL` (bound to `Backspace`) triggers `puzzle.undo()`. `SECONDARY_ACTION` (`KeyK`/`KeyC`) triggers `puzzle.reset()`. Both are read directly off `context.input`, the same pattern the tower-defense proof's upgrade trigger uses for an action outside the controller's own intent shape.
- Visible "solved" feedback (a debug-observable `solved` boolean, computed by calling `puzzle.isSolved()` after every action) must agree with `PuzzleService.isSolved()` — the acceptance bar is that these two reads of the same call never disagree, not that a second solved-tracking mechanism exists.

## Content roles used

- `tuning` — generator-default `content/tuning.json`, validated, unused by grid-only gameplay (no numeric field this genre needs).
- No `levels` role — this preset declares none; the board is code, per ADR-0017.

## Terminal success/failure oracle

- **Success:** `puzzle.isSolved()` (read via the debug snapshot's `solved` field) is `true` and the shell's own independently-computed `visibleComplete` (from the same `puzzle.current()` read) agrees.
- **Failure surface (all observable):** `state` (`{player:{x,y}, box:{x,y}}`, i.e. `puzzle.current()`), `solved`, `visibleComplete`, `rejectedMoves` (count).

## Defining journey (automated, real-browser, deterministic frame stepping)

Board (walls `#`, goal `G`, player `P` start, box `B` start), coordinates `(x,y)` with `(0,0)` top-left:
```
#####
#P..#
#.B.#
#..G#
#####
```
`P`=(1,1), `B`=(2,2), `G`=(3,3).

1. Start.
2. Move — `RIGHT` (ordinary move, player to (2,1), directly above the box).
3. Legal push — `DOWN` (player pushes the box from (2,2) to (2,3); player follows to (2,2)).
4. Invalid push — `DOWN` again (the box's next cell, (2,4), is the board's bottom wall) → rejected: `puzzle.current()` is byte-for-byte the same value as before the attempt, `rejectedMoves` increments.
5. Additional move/push — `LEFT` to (1,2), `DOWN` to (1,3) (two ordinary moves repositioning the player), then `RIGHT` (pushes the box from (2,3) onto the goal cell (3,3) — this state is already solved, but the journey continues to exercise undo/reset before claiming it).
6. Undo — `CANCEL`/`Backspace` restores the exact state from immediately before step 5's push (player and box both revert).
7. Reset — `SECONDARY_ACTION` restores the exact initial state (player and box both back to their start cells), regardless of how much undo history existed.
8. Solve — replay the same five actions from step 2–5 (`RIGHT`, `DOWN`, `LEFT`, `DOWN`, `RIGHT`) from the freshly reset state.
9. `PuzzleService.isSolved()` and the shell's own visible-completion read agree (`true`).

## Acceptance

- Deterministic canonical state: `puzzle.current()` is the single source of truth throughout; no parallel state exists in `shellPack.ts`.
- Exact invalid-push behavior: a rejected push leaves state byte-for-byte unchanged and does not push a history entry.
- Exact undo/reset: both restore precisely the state the mechanic promises (previous entry / initial state), not an approximation.
- Solved detection: `isSolved()` and the visible completion signal agree.
- Real `sw2d.puzzle` capability installed and exercised through `packConfig.ts` — not bypassed the way the Phase 8 demo bypassed it.
- No puzzle DSL — the board/rules stay bounded game-specific TypeScript.
