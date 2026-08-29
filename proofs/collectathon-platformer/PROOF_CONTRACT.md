# Proof Contract — collectathon-platformer

Frozen before implementation. Phase 2 of the capability-completion program (data-driven items / effects / pickups, ADR-0019).

## Preset

`collectathon-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.arcade`, **`sw2d.items`**, optional `sw2d.progression`. Content roles `tuning`, `levels`, `items`.

Generated via `npm run sw2d -- new proof-collectathon-platformer --preset collectathon-platformer`, moved from `games/` into `proofs/collectathon-platformer/`. Customized only in `content/` (a richer item catalog and level) and one debug-read addition to the copied `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- `sw2d.items` (`ItemsService`) — definitions come from validated `content/items.json` (schema `item-catalog`); the service owns the inventory (`grant`, `count`, `inventory`, `maxCount` clamp) and the bounded effect executor (`applyEffects`, deterministic order, reported skips).
- `bindCollectiblePickups` (`@sw2d/runtime/game-support`), called once by the **shared platform shell** — there is **no game-specific pickup code** in this proof. Every `Collectible` level object whose `itemId` names a catalog entry becomes a sensor sprite; a player overlap grants the item and applies its on-pickup effects.
- Effect kinds: `arcade.score`, and a `chain` of `arcade.score` + `world.flag` (the Power Star). Effects land in the real `sw2d.arcade` / `sw2d.world` services, read back through the shell's debug snapshot — not shell-local counters.
- Engine-level pause / restart.

## Content

- `content/items.json`: `coin-1` (`arcade.score` +5), `gem-1` (`arcade.score` +25, `maxCount` 2), `star-1` (`chain`: `arcade.score` +100, `world.flag` `gotStar` true).
- `content/levels/main.json`: a flat ground strip and five `Collectible` objects — `coin-1` ×2, `gem-1`, `star-1`, and one with `itemId: "not-in-catalog"` (must be skipped by the binder, no sprite created).

## Terminal success/failure oracle

- **Success surface:** after the automated sweep, the shell debug section `game.platform-shell` reads `items = { "coin-1": 2, "gem-1": 1, "star-1": 1 }`, `score === 135`, `gotStar === true`, `pickupsRemaining === 0`.
- **Failure surface (all observable):** `items`, `pickupsRemaining`, `score`, `gotStar`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start the run (`Space`); scene reaches `sw2d.play`; installed packs include `sw2d.items`; `score === 0`, `gotStar === false`, `pickupsRemaining === 4` (the unknown-itemId Collectible was skipped).
2. Hold `ArrowRight`; the player walks the ground and overlaps each pickup in turn.
3. Once `pickupsRemaining === 0`: `items` is `{coin-1:2, gem-1:1, star-1:1}` (the unknown id never entered the inventory); `score === 5+5+25+100 === 135`; `gotStar === true` (the star's chain effect set the world flag).
4. Restart (pause, then `SECONDARY_ACTION`): the play scene reinstalls — `score` back to 0, `gotStar` false, `pickupsRemaining === 4`, inventory cleared (this preset's `sw2d.items` config does not persist).

## Acceptance

- Multiple canonical item definitions, counted by their catalog ids.
- Collection uses the reusable service through the shared shell — no bespoke pickup or item code in this proof.
- Item effects (score, and a chained world-flag) execute in the real services in definition order.
- An unknown `itemId` is skipped, not an error.
- Restart genuinely reinstalls (fresh services, pickups back, inventory cleared).
- Zero console errors, zero external requests.
