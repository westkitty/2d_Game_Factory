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

1. Start; `sw2d.camera` + `sw2d.combat` installed; mode `rail`; `foesAlive 2`.
2. PRIMARY with nothing near -> `foesAlive 2`.
3. Loop: PRIMARY when `nearId` is set -> first kill (`foesAlive 1`, still `playing`), then `cleared`, `complete`, `foesAlive 0`.
4. Restart: `foesAlive 2`, `playing`.

## Acceptance

- Weapons on the rail (projectiles) stay a limitation; the look kill is instantaneous.
- Zero console errors, zero external requests.
