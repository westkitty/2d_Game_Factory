# Proof Contract — vertical-shmup

Frozen before implementation. Category-C Wave 8 (`sw2d.stage-scroll`, ADR-0035) - the vertical stage consumer.

## Preset

`vertical-shmup` (`packages/presets/src/catalog/shooter.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.weapons`, `sw2d.encounters`, **`sw2d.stage-scroll`** (mode `vertical`). Content roles tuning.

Generated via `npm run sw2d -- new proof-vertical-shmup --preset vertical-shmup` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.stage-scroll` vertical mode: the same service with a -Y fire axis and a horizontal band. Materially different from `horizontal-shmup` in the axis contract the shell must respect.

## Terminal success/failure oracle

- **Success surface:** as `horizontal-shmup`, with fire axis (0, -1) and Right moving `playerX` within the band.
- **Failure surface:** `stageScroll.{offset,progress,playerX,fireX,fireY,outcome}`, `battle.projectilesSpawned`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Category-C Wave 8 scrolling stage plus the Final Product Completion program's authoring (matrix L11): three parallax `layers` and a three-leg `rail` in `content/stage-scroll.json`; `sw2d.encounters` `formation` spawns of `drift` raiders sweep the stage (escaping off the far edge, never bouncing); bullets are pooled (L12).

1. Start; `sw2d.stage-scroll` + `sw2d.encounters` installed; mode `vertical`; `playing`.
2. 10 frames -> offset increased; move within the band; PRIMARY -> a projectile spawned.
3. Pause/resume -> the offset advanced < 40 across the pause.
4. A formation of at least 3 `raider`s is alive; three layers report offsets ordered by speed factor (far < near).
5. The rail's leg 2 (`currentSpeed 120`) and leg 3 (`currentSpeed 220`) engage in order; the cross offset is non-zero on leg 3.
6. Stage clear -> `complete`, `progress 1`; escaped + killed formation members >= 3.
7. Restart: `playing`, offset < 200.

## Acceptance

- Parallax authoring, the rail path and enemy formations are reusable (`sw2d.stage-scroll`, `sw2d.encounters`); pooling is the projectile runtime's - no catalog limitation remains.
- Zero console errors, zero external requests.
