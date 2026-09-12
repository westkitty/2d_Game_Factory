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

Final Product Completion Wave 2 (matrix L04): the elite foe pursues the player; strikes chain through `content/melee.json`'s combo steps inside the window; strikes are directional (facing arc); a contact hit stuns the player and resets the chain.

1. Start; `sw2d.melee` installed; mode `skirmish`; `foesAlive 1`; `playerHealth 5`; no target in range.
2. Strike -> `miss`, chain 0.
3. Wait until the foe walks into range (`targetId 'foe-0'`); strike ×3 (each past the 120 ms cooldown) -> `hit-1`, `hit-2`, `hit-3`, `bestCombo 3`, `foesAlive 0`, `complete`.
4. Restart: `foesAlive 1`, `bestCombo 0`. Wait for the foe; hold AIM_LEFT (Numpad4) and strike -> `miss`, no target (facing away); hold AIM_RIGHT (Numpad6) and strike -> `hit-1`.
5. Wait 50 frames -> chain 0 (window closed); strike -> `hit-1` again.
6. Wait until the foe lands a contact hit -> health < 5, `stunned`; strike -> `stunned`, chain 0.

## Acceptance

- Combo chains, directional (facing-arc) strikes, foe pursuit, hit-stun interruption and the targeting reticle are the reusable `sw2d.melee` grammar - no catalog limitation remains.
- Zero console errors, zero external requests.
