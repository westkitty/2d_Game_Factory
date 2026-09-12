# Proof Contract — climbing-game

Frozen before implementation. Category-C Wave 27 + Wave 30 (parkour ledges + `sw2d.wall` slide, ADR-0054 / ADR-0057) on the platform shell.

## Preset

`climbing-game` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.wall`** (mode `slide`). Content roles tuning, levels, wall.

Generated via `npm run sw2d -- new proof-climbing-game --preset climbing-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterParkour` (`PARKOUR_STARTER 'climb'`): three rising steps (tops at y 480 / 360 / 240 - each taller than a plain jump) and a summit flag. `sw2d.wall` supplies the cliff face (a real slide while airborne and holding into it, wall-jump kicks away) **and the ledge grammar** (Final Product Completion Wave 1, matrix L03): `step-ledge` and `summit-ledge` are authored corners; grab, UP climb, DOWN drop and JUMP hang-jump are one state machine in the service, presented by the shared platform shell.

## Terminal success/failure oracle

- **Success surface:** walking right without jumping gains no height; jump + grab `step-ledge` + UP climbs onto the middle platform; a jump into the cliff while holding right is `sliding` on `cliff` and JUMP wall-jumps (`climb`); falling back through `summit-ledge` hangs, UP climbs, the flag is `summit` / `complete`; after restart, DOWN from a hang drops (`drops 1`) and JUMP from a hang launches straight up (`hang-jump`) and regrabs on the way down.
- **Failure surface:** `parkour.{jumps,lastResult,outcome}`, `wall.{sliding,wallId,state,ledgeId,ledges,lastResult}`, player `x`/`y`/`onGround`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `climb`; y > 400; wall state `grounded`.
2. Hold Right 20 frames -> y > 400, `jumps 0`, `grabs 0`.
3. From the start, hold Right + JUMP -> `ledge-hang` on `step-ledge`; UP -> `climbs 1`, standing on the middle platform.
4. Hold Right to x >= 248, JUMP -> `sliding` on `cliff`; JUMP again -> `climb` (wall-jump); falling back -> `ledge-hang` on `summit-ledge`; UP -> `climbs 2`; hold Right -> `summit`, `complete`, y <= 300, x >= 400.
5. Restart: `grabs 0`, `grounded`. Grab `step-ledge`; DOWN -> `drops 1`, lands on the floor. Grab again; JUMP -> `hang-jump`, `airborne`; regrab -> `grabs 3`.

## Acceptance

- Ledge grab / climb / drop / hang-jump and the slide/wall-jump/ledge state machine are the reusable `sw2d.wall` grammar - no catalog limitation remains.
- Zero console errors, zero external requests.
