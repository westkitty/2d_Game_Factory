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

Final Product Completion Wave 2 (matrix L04): three fodder foes converge on the player; each falls to a three-hit chain on whichever foe the targeting reticle names.

1. Start; mode `arena`; `foesAlive 3`.
2. Hold ground facing right; whenever `targetId` names a foe, strike ×3 (past the cooldown) -> chains that reach `hit-3`; repeat until `foesAlive 0`, `complete`, health > 0, `bestCombo 3`.
3. Strike -> unchanged.
4. Restart: `foesAlive 3`, `playing`, `bestCombo 0`, `playerHealth 5`.

## Acceptance

- Combo chains, directional strikes, foe pursuit and the targeting reticle are the reusable `sw2d.melee` grammar - no catalog limitation remains.
- Zero console errors, zero external requests.
