# Proof Contract — rail-shooter

Frozen before implementation. Category-C Wave 26 + Wave 30 (look targets + `sw2d.camera` rail, ADR-0053 / ADR-0057) on the pointer shell.

## Preset

`rail-shooter` (`packages/presets/src/catalog/shooter.ts`) — controller family `pointer`, required packs `sw2d.combat`, **`sw2d.camera`** (mode `rail`). Content roles tuning.

Generated via `npm run sw2d -- new proof-rail-shooter --preset rail-shooter` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.camera` (`world.camera`, rail mode) advances the rail on its own, bringing targets into the reticle; `bindStarterLook` (`LOOK_STARTER 'rail'`) kills the near target on PRIMARY and owns the clear-win (the rail does not freeze the game at t=1).

## Terminal success/failure oracle

- **Success surface:** firing with no target near is not a kill; firing only when a target is near kills them one at a time (`foesAlive 2 -> 1 -> 0`), `cleared` / `complete`, at least two shots; restart reinstalls two foes.
- **Failure surface:** `look.{foesAlive,nearId,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Final Product Completion Wave 3 (matrix L17): the gun rides the `sw2d.camera` rail and fires the `sw2d.weapons` catalog weapon at `sw2d.encounters` `approach` drones (two legs in a `sequence`), scored through `sw2d.arcade` (`bindStarterGallery` in rail mode).

1. Start; `sw2d.camera` + `sw2d.weapons` + `sw2d.encounters` installed; mode `rail`; weapon `sidearm`; a drone alive; `sequenceLength 2`.
2. Hold PRIMARY while the pointer leads the nearest drone -> the camera scroll and the gun advance by more than 150 px; drones die (`kills >= 9`, `score >= 45`, `hits >= 9`); both legs clear -> `complete`, `bossesDefeated 2`.
3. Restart: progress near 0, `score 0`, `playing`.

## Acceptance

- Rail movement, weapons, target generation, hit resolution, scoring, progression and completion are the reusable capabilities the generated pointer shell composes - no catalog limitation remains.
- Zero console errors, zero external requests.
