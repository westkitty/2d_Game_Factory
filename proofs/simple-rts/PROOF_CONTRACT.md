# Proof Contract — simple-rts

Frozen before implementation. Category-C Wave 25 + Wave 30 + Wave 31 (one-unit command, `sw2d.territory` occupy catalog, two-unit box-select on ADR-0018 drag; ADR-0052 / 0057 / 0058).

## Preset

`simple-rts` (`packages/presets/src/catalog/strategyDefense.ts`) — controller family `top-down`, required packs **`sw2d.strategy`**, `sw2d.combat`, **`sw2d.territory`** (mode `occupy`). Content roles tuning.

Generated via `npm run sw2d -- new proof-simple-rts --preset simple-rts` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterCommand` (`COMMAND_STARTER 'rts'`): PRIMARY selects unit A; a spatial-pointer drag (ADR-0018) box-selects both units; ARROWS order the selection; the objective is seized when the units reach it. `sw2d.territory` supplies the occupy catalog (not ticked - the flag path crosses both zones).

## Terminal success/failure oracle

- **Success surface:** with nothing selected, movement orders move no unit; PRIMARY selects one unit and orders move only that unit; after restart, a pointer drag boxes both units (`boxed`, `selectedCount 2`) and marching them right seizes the objective with both units past x 780 (`complete`).
- **Failure surface:** `command.{selected,selectedCount,unitX,unit2X,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.strategy` + `sw2d.territory` installed; mode `rts`; nothing selected.
2. Hold Right 12 frames -> both units unmoved.
3. PRIMARY -> `selected`, count 1; hold Right -> `unitX` up, `unit2X` unchanged.
4. Restart: nothing selected, unit A back at its start.
5. Drag (160,230)->(250,430) -> `boxed`, count 2; hold Right until `complete` -> `seized`, both x >= 780.

## Acceptance

- A command queue, fog-of-war and unit production are not this presentation (catalog limitation).
- Zero console errors, zero external requests.
