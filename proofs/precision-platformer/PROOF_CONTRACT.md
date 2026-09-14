# Proof Contract — precision-platformer

Frozen before implementation. Category-C Wave 27 + Wave 30 (parkour gap course + `sw2d.wall`, ADR-0054 / ADR-0057) on the platform shell.

## Preset

`precision-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.wall`** (mode `leap`). Content roles tuning, levels, wall.

Generated via `npm run sw2d -- new proof-precision-platformer --preset precision-platformer` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterParkour` (`PARKOUR_STARTER 'precision'`): two platforms with a gap, a flag at x 820, a fall-fail below the platform row. `sw2d.wall` supplies the leap wall catalog **and the ledge grammar** (Final Product Completion Wave 1, matrix L03): the far side of the gap is an authored ledge (`gap-ledge`); the shared platform shell pins the body while the service reports `ledge-hang` / `climbing`, and hands it back to Arcade physics on climb, drop or hang-jump.

## Terminal success/failure oracle

- **Success surface:** running off the edge without jumping grabs the far ledge (`ledge-hang`, `grabs 1`) and the hang is stable; DOWN drops into the gap (`drops 1`, `failed`, `fell`); after restart, grab + UP climbs onto the platform (`climbs 1`, `climbed`) and the course finishes (`complete`, x >= 820); after another restart a single precise jump at x 210-270 clears the gap with no grab (`jumps 1`, `grabs 0`).
- **Failure surface:** `parkour.{jumps,lastResult,outcome}`, `wall.{state,ledgeId,ledges,lastResult}`, player `x`/`y`/`onGround`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.wall` installed; mode `precision`; x < 200; wall state `grounded`.
2. Hold Right, never jump -> `ledge-hang` on `gap-ledge`, `grabs 1`; 20 frames later the body has not moved.
3. DOWN -> `drops 1`, then `failed` / `fell`.
4. Restart; hold Right into the grab; UP -> `climbs 1`, `climbed`, standing on the far platform; hold Right -> `complete`, `finished`, x >= 820.
5. Restart; hold Right, JUMP once between x 210 and 270 -> `complete`, `jumps 1`, `grabs 0`, x >= 820.

## Acceptance

- Ledge grab / climb / drop / hang-jump are the reusable `sw2d.wall` grammar, authored in `content/wall.json` - no catalog limitation remains.
- Zero console errors, zero external requests.
