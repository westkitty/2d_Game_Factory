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

1. Start; mode `vertical`; fire axis (0, -1).
2. 10 frames -> `offset` increased.
3. Hold Right 20 frames -> `playerX` +8.
4. PRIMARY -> `projectilesSpawned >= 1`.
5. Pause/resume -> offset advanced < 40 across the pause.
6. Wait -> `complete`, `progress >= 1`, `offset >= 720`.
7. Restart: `playing`, `offset < 200`.

## Acceptance

- Zero console errors, zero external requests.
