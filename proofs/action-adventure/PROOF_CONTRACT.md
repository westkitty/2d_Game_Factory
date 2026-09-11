# Proof Contract — action-adventure

Frozen before implementation. Category-C Wave 6 (`sw2d.melee`, ADR-0033) - the skirmish consumer.

## Preset

`action-adventure` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.combat`, `sw2d.weapons`, **`sw2d.melee`** (mode `skirmish`). Content roles tuning, levels, melee.

Generated via `npm run sw2d -- new proof-action-adventure --preset action-adventure` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.melee` (`combat.melee`) from `content/melee.json`: strike reach, knockback, hit-stun, contact damage; one foe. `bindStarterMelee` (shared top-down shell): PRIMARY strikes.

## Terminal success/failure oracle

- **Success surface:** a swing with no foe in reach is not a `hit`; after closing distance the first strike is a `hit` that leaves the foe alive; two more strikes kill it and clear the room (`foesAlive 0`, `complete`, player health > 0); restart reinstalls (one foe, start x).
- **Failure surface:** `melee.{playerHealth,foesAlive,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.melee` installed; mode `skirmish`; `foesAlive 1`; `playerHealth 5`.
2. Strike -> not `hit`, `foesAlive 1`.
3. Hold Right to x >= 350; strike -> `hit`, `foesAlive 1`, `playing`.
4. Strike ×2 -> `foesAlive 0`, `hit`, `complete`, health > 0.
5. Restart: `foesAlive 1`, `playing`, x back to start.

## Acceptance

- Combo strings, directional attacks and targeting UI are not this pack (catalog limitation).
- Zero console errors, zero external requests.
