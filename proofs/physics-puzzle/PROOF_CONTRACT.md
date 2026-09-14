# Proof Contract — physics-puzzle

Final Product Completion Wave 4 L25 — Matter ball-in-goal on the pointer shell, rules in `content/puzzles.json`.

## Preset

`physics-puzzle` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `pointer`, required packs **`sw2d.puzzle-rules`** (`physics-goal` from `content/puzzles.json`). Content roles tuning, puzzles.

Generated via `npm run sw2d -- new proof-physics-puzzle --preset physics-puzzle` (the canonical factory, unmodified).

## Reusable capability exercised

- `sw2d.puzzle-rules` `physics-goal` kind: authored goal zone + launch limit; the pointer shell owns a Matter ball (`createAdvancedPhysics`) and reports its position via `report-entity` / `launch`.

## Terminal success/failure oracle

- **Success surface:** left alone the ball settles left of x 400 and is never solved; one nudge (PRIMARY / click) sends it into the goal (`solved`, `inGoal`, ball x >= 740); restart reinstalls (fresh ball, `nudges 0`).
- **Failure surface:** `puzzle.{kind,solved,inGoal,ball}`, `nudges`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.puzzle-rules` installed; kind `physics-goal`; ball x < 400.
2. 60 frames idle -> not solved, `nudges 0`.
3. PRIMARY -> `nudges 1`; wait -> `solved`, `inGoal`, ball x >= 740.
4. Restart: not solved, ball x < 400, `nudges 0`.

## Acceptance

- The puzzle's own rules are content (`content/puzzles.json`); no TypeScript placeholder.
- Zero console errors, zero external requests.
