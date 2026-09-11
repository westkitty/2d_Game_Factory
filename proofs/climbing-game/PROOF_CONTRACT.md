# Proof Contract — climbing-game

Frozen before implementation. Category-C Wave 27 + Wave 30 (parkour ledges + `sw2d.wall` slide, ADR-0054 / ADR-0057) on the platform shell.

## Preset

`climbing-game` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.wall`** (mode `slide`). Content roles tuning, levels, wall.

Generated via `npm run sw2d -- new proof-climbing-game --preset climbing-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterParkour` (`PARKOUR_STARTER 'climb'`): three rising ledges and a summit flag; `sw2d.wall` slide contact between them.

## Terminal success/failure oracle

- **Success surface:** walking into the first ledge without jumping gains no height; two jumps up the ledges reach the summit (`summit`, `complete`, y <= 410, x >= 400, `jumps >= 2`); restart reinstalls at the bottom.
- **Failure surface:** `parkour.{jumps,lastResult,outcome}`, `wall.{sliding,wallId}`, player `x`/`y`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `climb`; y > 400.
2. Hold Right 40 frames -> y > 400, `jumps 0`.
3. Hold Right; JUMP once per ledge band while on the ground -> `summit`, `complete`, y <= 410, x >= 400.
4. Restart: y > 400, `jumps 0`, `playing`.

## Acceptance

- Zero console errors, zero external requests.
