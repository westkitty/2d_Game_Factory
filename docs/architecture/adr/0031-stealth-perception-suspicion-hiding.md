# ADR-0031: Vision cones, suspicion, noise and hiding are one reusable perception capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 4

## Context

`stealth-game` and `heist-game` carried the limitation that AI state existed
but vision cones, awareness geometry, noise and hiding did not. Both recipes
need the same underlying machine (FOV, occlusion, suspicion, cover) with
different fail/alarm rules: infiltrate fails the moment a cone spots an
uncovered player; a heist treats loot as noise that sets alarm without
failing, and still requires the objective to escape. Folding that into
`sw2d.ai` would have turned a lightweight agent-state store into a genre
monolith. Patrol pathfinding and takedowns do not fit this contract.

## Decision

**One renderer-neutral perception capability with two bounded modes. Not two
engines, and not a stealth-AI DSL.**

- **`sw2d.perception` → `ai.perception`.** `PerceptionService` owns FOV
  cones (y-down degrees), AABB occlusion, cover/visibility, suspicion,
  alarm, auto-loot and auto-exit. No Phaser, no wall clock, no RNG.
- **Two modes of one machine:**
  - `infiltrate` — fully visible in a cone fails immediately; cover drops
    visibility so a hidden player is not failed.
  - `heist` — looting sets alarm; being seen raises alarm; neither fails
    the run; escape still requires the objective.
- **`content/perception.json`** (schema `perception-catalog`, document
  `perception`), always emitted. Empty/inert unless the preset installs the
  pack. The generator maps stealth-game → infiltrate, heist-game → heist.
- **The generated `topDownShellPack`** calls `bindStarterPerception` after
  encounters. When active it repositions the player to the catalog start,
  feeds `setPlayer` / `tick` each frame, and skips dummy firing.
- **Workbench:** `POST /api/perception/inspect` + a compact inspector
  (mode, observers, cover, loot). Read-only; editing is JSON work on the
  file.

## Consequences

- Consumers: `stealth-game` (infiltrate), `heist-game` (heist). Both
  require `sw2d.perception` and content role `perception`.
- `LIMITATIONS.stealthAi` names what is reusable and what is not.
  Twenty-three packs now have a preset consumer.
- Duplicate observer/cover/objective ids throw at install. A missing
  document yields an inert service, not a crash.
- `bindStarterPerception` resets the session on bind so a PlayScene
  restart is a new infiltration.
- Catalog maturity stays unchanged.

## Rejected

- **Folding this into `sw2d.ai`.** That pack is an agent-state store and
  explicitly is not vision geometry.
- **Patrol pathfinding / takedowns.** Navigation already exists as
  `sw2d.navigation`; takedowns are not shared across these two recipes.
- **A boolean `seen` flag.** Overlay QA still reads `guardSeesPlayer`, but
  the service computes real FOV + occlusion + cover, not a rectangle.
