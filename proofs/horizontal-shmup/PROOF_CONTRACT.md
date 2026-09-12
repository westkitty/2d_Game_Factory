# Proof Contract — horizontal-shmup

Frozen before implementation. Category-C Wave 8 (`sw2d.stage-scroll`, ADR-0035) - the horizontal stage consumer.

## Preset

`horizontal-shmup` (`packages/presets/src/catalog/shooter.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.weapons`, `sw2d.encounters`, **`sw2d.stage-scroll`** (mode `horizontal`). Content roles tuning.

Generated via `npm run sw2d -- new proof-horizontal-shmup --preset horizontal-shmup` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.stage-scroll` (`world.scroll`) from `content/stage-scroll.json`: the stage streams past on its own, the ship is clamped to a band, fire axis is +X, streaming hazards, stage-clear at the end. `bindStarterStageScroll` (shared top-down shell); `sw2d.weapons` + `sw2d.encounters` fire underneath.

## Terminal success/failure oracle

- **Success surface:** the offset advances with no input; the ship moves within its band; firing spawns projectiles; pause freezes the scroll; the stage completes (`progress >= 1`, `offset >= 720`); restart reinstalls near offset 0.
- **Failure surface:** `stageScroll.{offset,progress,playerX,playerY,fireX,fireY,outcome}`, `battle.projectilesSpawned`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Category-C Wave 8 scrolling stage plus the Final Product Completion program's authoring (matrix L11): three parallax `layers` and a three-leg `rail` in `content/stage-scroll.json`; `sw2d.encounters` `formation` spawns of `drift` raiders sweep the stage (escaping off the far edge, never bouncing); bullets are pooled (L12).

1. Start; `sw2d.stage-scroll` + `sw2d.encounters` installed; mode `horizontal`; `playing`.
2. 10 frames -> offset increased; move within the band; PRIMARY -> a projectile spawned.
3. Pause/resume -> the offset advanced < 40 across the pause.
4. A formation of at least 3 `raider`s is alive; three layers report offsets ordered by speed factor (far < near).
5. The rail's leg 2 (`currentSpeed 120`) and leg 3 (`currentSpeed 220`) engage in order; the cross offset is non-zero on leg 3.
6. Stage clear -> `complete`, `progress 1`; escaped + killed formation members >= 3.
7. Restart: `playing`, offset < 200.

## Acceptance

- Parallax authoring, the rail path and enemy formations are reusable (`sw2d.stage-scroll`, `sw2d.encounters`); pooling is the projectile runtime's - no catalog limitation remains.
- Zero console errors, zero external requests.
