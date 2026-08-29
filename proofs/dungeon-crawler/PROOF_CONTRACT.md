# Proof Contract — dungeon-crawler

Frozen before implementation. Capability program Phase 7 (ADR-0024) proof consumer B.

## Preset

`dungeon-crawler` (`packages/presets/src/catalog/topDownAction.ts`) — controller family
`top-down`, required packs `sw2d.world` + `sw2d.world-entities` + `sw2d.combat` +
`sw2d.generation`, content roles `tuning`, `levels`, `generation`. Maturity `recipe`.

Generated via `npm run sw2d -- new proof-dungeon-crawler --preset dungeon-crawler`, moved into
this committed tree. Only `src/game-specific/shellPack.ts` is customized.

## Reusable capability exercised

- `sw2d.generation` (`GenerationService`) — the `main` generator is a `room-graph` config in
  `content/generation.json` (start-room / hall / chamber / exit-room templates). The shell calls
  `generate('main')` once and renders `result.output` (a `NormalizedLevel`): walls from `solids`
  (each room's four walls, split around a doorway where connected), player at the start room's
  `PlayerSpawn`, `Enemy` sprites at the scattered `Enemy` objects, an `Exit` object in the exit
  room. **The room graph is not a bespoke dungeon algorithm — it is the shared capability.**
- `result.manifest.graph` (`nodes`, `edges` with `viaDoor`) is the inspectable graph.

## Game-specific code (`src/game-specific/shellPack.ts`)

- Renders the generated dungeon; `topDownController`-driven movement with wall collision.
- Computes start→exit reachability by BFS over `manifest.graph` and checks every edge endpoint is
  a placed node.
- `INTERACT` → re-run `generate('main', { seed: <initial> })` and record `regenMatchesInitial`
  (node list + edge list + template order byte-identical).
- `SECONDARY_ACTION` → re-run a different seed and record `altDiffers` + `altValid`.

## Terminal success / failure oracle (debug snapshot `game.top-down-shell`)

- `valid` — generation passed its own graph-connectivity / start-exit / placement validation.
- `hasStartNode` — `manifest.graph.nodes` contains `r0`.
- `hasExitObject` — an `Exit` object was materialized.
- `edgesValid` — every edge references a placed node.
- `startToExitReachable` — BFS from `r0` covers every node and an Exit exists.
- `roomCount`, `enemyCount` — materialization sanity.
- `travelled` — player displacement from spawn.
- `regenMatchesInitial`, `altDiffers`, `altValid`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start. `valid === true`, `hasStartNode === true`, `hasExitObject === true`,
   `edgesValid === true`, `startToExitReachable === true`, `roomCount >= 4`.
2. Record `roomCount` and the graph as the reference.
3. Move (`ArrowRight` / `ArrowDown` stretches) → `travelled` grows past 40 (the player moves
   through the generated rooms, colliding with generated walls rather than passing through
   nothing).
4. `INTERACT` → `regenMatchesInitial === true`.
5. `SECONDARY_ACTION` → `altDiffers === true`, `altValid === true`.
6. Restart the scene (`KeyP`, `KeyK`). Snapshot again: `roomCount` and
   `startToExitReachable` unchanged, and `regenMatchesInitial` re-checks `true` — the graph is
   deterministic across a real reinstall.

## Acceptance

- The room graph comes from the shared `sw2d.generation` `room-graph` generator, run through the
  normal generated composition.
- A start node and an exit exist; a valid start→exit route exists; every connection references a
  valid room.
- Same seed → identical graph (in-run and across restart). Different seed → different valid graph.
- The generated game enters play and the player traverses generated rooms.
- No dungeon-only generator; no generator DSL.
