# Proof Contract — physics-puzzle

Frozen before implementation. Category-C Wave 12 (existing `sw2d.puzzle` code seam, ADR-0039) - Matter ball-in-goal on the pointer shell.

## Preset

`physics-puzzle` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `pointer`, required packs **`sw2d.puzzle`** (`configSource: 'code'`, `physics-goal` from `src/game-specific/packConfig.ts`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-physics-puzzle --preset physics-puzzle` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.puzzle` code seam: `createInitialState` / `isSolved` for a `physics-goal` puzzle; the pointer shell owns a Matter ball (`createAdvancedPhysics`) and marks the puzzle solved when the ball rests in the goal pocket.

## Terminal success/failure oracle

- **Success surface:** left alone the ball settles left of x 400 and is never solved; one nudge (PRIMARY / click) sends it into the goal (`solved`, `inGoal`, ball x >= 740); restart reinstalls (fresh ball, `nudges 0`).
- **Failure surface:** `puzzle.{kind,solved,inGoal,ball}`, `nudges`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.puzzle` installed; kind `physics-goal`; ball x < 400.
2. 60 frames idle -> not solved, `nudges 0`.
3. PRIMARY -> `nudges 1`; wait -> `solved`, `inGoal`, ball x >= 740.
4. Restart: not solved, ball x < 400, `nudges 0`.

## Acceptance

- The puzzle's own rules stay TypeScript in the code seam, not content (catalog limitation).
- Zero console errors, zero external requests.
