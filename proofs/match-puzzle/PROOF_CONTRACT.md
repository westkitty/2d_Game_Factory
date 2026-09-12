# Proof Contract — match-puzzle

Frozen before implementation. Category-C Wave 9 (existing `sw2d.puzzle-rules` match kind, ADR-0036) on the grid shell.

## Preset

`match-puzzle` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `grid`, required packs **`sw2d.puzzle-rules`** (kind `match` from `content/puzzles.json`). Content roles tuning.

Generated via `npm run sw2d -- new proof-match-puzzle --preset match-puzzle` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.puzzle-rules` match engine: the entire board, adjacency, swap legality, match detection, cascade and the clear objective are content; `bindStarterPuzzle` only moves a cursor and issues `swap` ops.

## Terminal success/failure oracle

- **Success surface:** the cursor moves; CONFIRM selects; CONFIRM on the adjacent cell swaps and the engine clears (`moves >= 1`, `clears >= 1`) until the objective is met (`solved`, `progress >= 1`); restart reinstalls; a non-adjacent confirm is not a swap (`moves 0`).
- **Failure surface:** `puzzleBoard.{solved,moves,cursorCol,cursorRow,selectedCol,selectedRow,clears,objective,progress}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.puzzle-rules` installed; kind `match`; `clears 0`.
2. ArrowDown -> cursor (0,1); CONFIRM -> selected (0,1); ArrowRight -> cursor (1,1).
3. CONFIRM -> swap: `moves >= 1`, `clears >= 1`; wait -> `solved`, `progress >= 1`.
4. Restart: not solved, `clears 0`, `moves 0`.
5. CONFIRM, ArrowRight ×2, CONFIRM -> `moves 0`, `clears 0`.

## Acceptance

- Pointer drag-swap stays out (catalog limitation).
- Zero console errors, zero external requests.
