# Proof Contract — precision-platformer

Frozen before implementation. Category-C Wave 27 + Wave 30 (parkour gap course + `sw2d.wall`, ADR-0054 / ADR-0057) on the platform shell.

## Preset

`precision-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.wall`** (mode `leap`). Content roles tuning, levels, wall.

Generated via `npm run sw2d -- new proof-precision-platformer --preset precision-platformer` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterParkour` (`PARKOUR_STARTER 'precision'`): two platforms with a gap, a flag at x 820, a fall-fail below the platform row. `sw2d.wall` supplies the leap wall catalog. The convergence program lowered the fail line: it sat below the Arcade world-bounds floor, so a fallen player was stuck `playing` in the pit forever.

## Terminal success/failure oracle

- **Success surface:** running without jumping falls into the gap and the course is `failed` with `jumps 0`; after restart, one jump timed at x 210-270 clears the gap and reaches the flag (`finished`, `complete`, `jumps 1`, x >= 820).
- **Failure surface:** `parkour.{jumps,lastResult,outcome}`, `wall`, player `x`/`y`/`onGround`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.wall` installed; mode `precision`; x < 200.
2. Hold Right, never jump -> `failed`, `jumps 0`.
3. Restart: `playing`, x < 200.
4. Hold Right, JUMP once between x 210 and 270 while on the ground -> `finished`, `complete`, `jumps 1`, x >= 820.

## Acceptance

- Ledge-grab and a full parkour grammar stay out (catalog limitation).
- Zero console errors, zero external requests.
