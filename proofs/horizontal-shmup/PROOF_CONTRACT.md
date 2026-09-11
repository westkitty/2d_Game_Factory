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

1. Start; `sw2d.stage-scroll` + `sw2d.encounters` installed; mode `horizontal`; fire axis (1, 0).
2. 10 frames -> `offset` increased.
3. Hold Down 20 frames -> `playerY` +8.
4. PRIMARY -> `projectilesSpawned >= 1`.
5. Pause/resume -> offset advanced < 40 across the pause.
6. Wait -> `complete`, `progress >= 1`, `offset >= 720`.
7. Restart: `playing`, `offset < 200`.

## Acceptance

- Rail-path cameras, parallax authoring and bullet-hell pooling are not this pack (catalog limitation).
- Zero console errors, zero external requests.
