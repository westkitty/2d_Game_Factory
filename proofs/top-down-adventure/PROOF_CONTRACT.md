# Proof Contract — top-down-adventure

Frozen before implementation. Phase 2 of the capability-completion program (data-driven items / effects / pickups, ADR-0019). The **cross-family** consumer that proves `sw2d.items` reuse across a different preset, controller shell and effect set.

## Preset

`top-down-adventure` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.world`, `sw2d.world-entities`, optional `sw2d.narrative`, `sw2d.progression`. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-top-down-adventure --preset top-down-adventure`, moved into `proofs/top-down-adventure/`. The preset itself is unchanged; the proof enables `sw2d.items` and `sw2d.progression` through a `content/game.json` overlay (a sanctioned `content/` edit) and adds `content/items.json` + level Collectibles, plus a debug-read and one INTERACT branch in the copied `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- The same `sw2d.items` service and the same `bindCollectiblePickups` runtime helper as `collectathon-platformer`, here on the **top-down** shell.
- Different effect kinds: `world.flag` (a map key), `progression.currency` (gold), and `progression.xp` applied through a real **`consume()`** (rations, `consumable: true`, `quantityPerGrant` 2).
- On-pickup effects fire for the non-consumable items (map key, gold); the ration's effect fires only on `consume()`, not on pickup.

## Content

- `content/game.json` overlay: `systemPacks` adds `sw2d.progression` and `sw2d.items`.
- `content/items.json`: `map-key` (`world.flag` `hasMapKey` true), `gold-pouch` (`progression.currency` +10), `ration` (consumable, `quantityPerGrant` 2, `maxCount` 5, `progression.xp` +3).
- `content/levels/main.json`: player spawn plus four Collectibles on the spawn row — `map-key`, `gold-pouch` ×2, `ration`.

## Terminal success/failure oracle

- **Success surface:** shell debug `game.top-down-shell` reads `hasMapKey === true`, `currency === 20`, `items` includes `ration: 2` after the sweep; after two `consume()` calls `xp === 6` and no `ration` remains.
- **Failure surface:** `items`, `pickupsRemaining`, `hasMapKey`, `currency`, `xp`, `canEatRation`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); scene `sw2d.play`; `sw2d.items` installed; `hasMapKey === false`, `currency === 0`, `pickupsRemaining === 4`.
2. Hold `ArrowRight`; sweep all four pickups.
3. After `pickupsRemaining === 0`: `hasMapKey === true` (world.flag effect), `currency === 20` (two gold pouches × `progression.currency` 10), `items.ration === 2` (its `progression.xp` effect has **not** fired yet — it is consumable), `items['gold-pouch'] === 2`, `items['map-key'] === 1`, `canEatRation === true`.
4. Press `INTERACT` (`KeyE`) twice: each call `consume('ration', 1)` — `ration` goes 2 → 1 → gone, `xp` goes 0 → 3 → 6, `canEatRation` becomes false.
5. Restart (pause, then `SECONDARY_ACTION`): everything resets — `hasMapKey` false, `currency`/`xp` 0, `pickupsRemaining === 4`, inventory cleared (config does not persist).

## Acceptance

- The same reusable item service proves out on a different preset / controller family with different effect kinds.
- A real `consume()` path removes a unit and applies the item's effect through the reusable service.
- On-pickup vs on-consume effect timing is correct (consumable effects do not fire on pickup).
- Restart genuinely reinstalls.
- Zero console errors, zero external requests.
