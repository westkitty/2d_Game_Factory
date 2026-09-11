# Proof Contract — base-defense

Frozen before implementation. Category-C Wave 21 (existing `sw2d.combat`, ADR-0048) - the hold-the-base consumer.

## Preset

`base-defense` (`packages/presets/src/catalog/strategyDefense.ts`) — controller family `top-down`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.combat`**. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-base-defense --preset base-defense` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.combat` health/damage through `bindStarterCombat` (`COMBAT_STARTER 'hold'`): two raiders march on the base; the player intercepts and strikes; the base has 3 health and must not be breached.

## Terminal success/failure oracle

- **Success surface:** a swing with no raider in reach is a `miss`; each raider dies to two strikes once intercepted (`foesAlive` 2 -> 1 -> 0); `complete` with `baseHealth 3`; restart reinstalls (two raiders, base 3, start x).
- **Failure surface:** `combat.{playerHealth,baseHealth,foesAlive,nearId,lastResult,outcome}`, player `x`/`y`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.combat` installed; mode `hold`; `foesAlive 2`; `baseHealth 3`; x 480.
2. PRIMARY -> `miss`.
3. Hold Left until a raider is near; PRIMARY ×2 -> `foesAlive 1`, `playing`.
4. Hold Down/Up (toward the other raider) until it is near; PRIMARY ×2 -> `foesAlive 0`, `complete`, `baseHealth 3`.
5. Restart: `foesAlive 2`, `baseHealth 3`, `playing`, x 480.

## Acceptance

- Target-priority AI and generated Enemy objects are not this presentation (catalog limitation).
- Zero console errors, zero external requests.
