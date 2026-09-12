# Proof Contract — arena-combat

Frozen before implementation. Category-C Wave 6 (`sw2d.melee`, ADR-0033) - the arena-clear consumer.

## Preset

`arena-combat` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.weapons`, `sw2d.encounters`, **`sw2d.melee`** (mode `arena`). Content roles tuning, levels, melee.

Generated via `npm run sw2d -- new proof-arena-combat --preset arena-combat` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.melee` arena mode: three foes placed around the arena, each dies to two strikes at close range; clearing all three completes. Materially different from `action-adventure` (one foe, room).

## Terminal success/failure oracle

- **Success surface:** foes fall 3 -> 2 -> 1 -> 0 as the player closes and strikes; `complete` with health > 0; striking after the clear is inert; restart reinstalls three foes.
- **Failure surface:** `melee.{playerHealth,foesAlive,outcome}`, player `x`/`y`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `arena`; `foesAlive 3`.
2. Up to y <= 175, Right to x >= 330, strike ×2 -> `foesAlive 2`.
3. Down to y >= 265, Right to x >= 455, strike ×2 -> `foesAlive 1`; strike ×2 -> `foesAlive 0`, `complete`, health > 0.
4. Strike -> unchanged.
5. Restart: `foesAlive 3`, `playing`.

## Acceptance

- Zero console errors, zero external requests.
