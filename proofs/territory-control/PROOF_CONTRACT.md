# Proof Contract — territory-control

Frozen before implementation. Category-C Wave 25 + Wave 30 (`sw2d.territory` stand/occupy, ADR-0052 / ADR-0057) - the capture-zone consumer.

## Preset

`territory-control` (`packages/presets/src/catalog/strategyDefense.ts`) — controller family `top-down`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.strategy`, `sw2d.combat`, **`sw2d.territory`** (mode `stand`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-territory-control --preset territory-control` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.territory` (`strategy.zones`) from `content/territory.json`: two zones captured by standing in them for the catalog's hold time; captured zones stay owned when left. `bindStarterCommand` (`COMMAND_STARTER 'zone'`).

## Terminal success/failure oracle

- **Success surface:** passing through zone A does not capture it; standing 30 frames does (`owned 1`); leaving keeps it; zone B completes (`owned 2`, `owned`, `complete`); restart reinstalls (`owned 0`, start x).
- **Failure surface:** `command.{owned,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.territory` installed; mode `zone`; `owned 0`.
2. Hold Right to x >= 270 -> `owned 0` on arrival; 30 frames -> `owned 1`, `playing`.
3. Hold Right to x >= 480 -> `owned 1` (kept).
4. Hold Right to x >= 690; 30 frames -> `owned 2`, `owned`, `complete`.
5. Restart: `owned 0`, `playing`, x back to start.

## Acceptance

- Contested capture between two teams is not this presentation (catalog limitation).
- Zero console errors, zero external requests.
