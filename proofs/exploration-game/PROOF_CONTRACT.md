# Proof Contract — exploration-game

Capability program Phase 8 (world graph / rooms / transitions / map, ADR-0025) - the simpler looped-areas consumer. Written retroactively by the Category-C convergence program from the committed spec (`packages/qa/proof-specs/explorationGame.ts`) and the PROOF_MATRIX row; the proof game itself is frozen and unchanged.

## Preset

`exploration-game` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `top-down`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.world-graph`**. Content roles tuning, levels.

## Reusable capability exercised

- `sw2d.world-graph`: three areas in a loop, no gating; discovery / visited state; the map; a persistent `world.state` flag; the room transition bridge. Top-down movement; door INTERACT -> transition; SECONDARY_ACTION toggles the map.

## Terminal success/failure oracle

- **Success surface:** start in Plaza (`town-visited` set); the full loop plaza→garden→library→garden→plaza twice; all 3 discovered + visited; the flag survives every transition; `roomDoorSprites` never exceeds 2; the map shows 3 areas + ≥2 known routes; restart -> back to Plaza (no persistence configured).
- **Failure surface:** `worldGraph.{current,discovered,visited,transitions}`, door sprite count, the `town-visited` flag.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start in Plaza (`town-visited` set).
2. Walk the loop plaza→garden→library→garden→plaza and repeat.
3. All 3 discovered + visited; flag still set; `roomDoorSprites` <= 2.
4. Map: 3 areas, >= 2 known routes.
5. Restart -> Plaza.

## Acceptance

- Zero console errors, zero external requests.
