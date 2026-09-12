# Proof Contract — falling-block-puzzle

Frozen before implementation. Category-C Wave 9 (existing `sw2d.puzzle-rules` falling-block kind, ADR-0036) on the grid shell.

## Preset

`falling-block-puzzle` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `grid (+ ui-simulation)`, required packs **`sw2d.puzzle-rules`** (kind `falling-block`). Content roles tuning.

Generated via `npm run sw2d -- new proof-falling-block-puzzle --preset falling-block-puzzle` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.puzzle-rules` falling-block engine: piece, gravity tick, move/rotate/hard-drop ops, line-clear and top-out are content; the shell issues ops from ARROWS / CONFIRM / SECONDARY.

## Terminal success/failure oracle

- **Success surface:** three column shifts and a hard-drop park a piece without a line; the next hard-drop completes the authored line (`lines >= 1`, `solved`, not topped out); restart reinstalls (`lines 0`; `moves <= 1` because a gravity tick is a move).
- **Failure surface:** `puzzleBoard.{solved,moves,lines,toppedOut,objective,progress}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; kind `falling-block`; `lines 0`.
2. ArrowRight ×3 -> `moves >= 3`; SECONDARY -> parked, `lines 0`.
3. SECONDARY -> `lines >= 1`, `solved`, `progress 1`.
4. Restart: not solved, `lines 0`, `moves <= 1`.

## Acceptance

- Wall-kicks stay out (catalog limitation).
- Zero console errors, zero external requests.
