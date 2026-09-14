# Proof Contract — action-roguelite

Frozen before implementation. Category-C Wave 17 (existing `sw2d.progression`, ADR-0044) - the relic run consumer, over `sw2d.generation`.

## Preset

`action-roguelite` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.combat`, **`sw2d.progression`**, `sw2d.generation`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-action-roguelite --preset action-roguelite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.progression` (`PROGRESSION_STARTER 'run'`): walk to two relics, PRIMARY takes one (item + currency), the second clears the run (XP, `run-cleared` unlock). `sw2d.generation` provides the room graph underneath.

## Terminal success/failure oracle

- **Success surface:** taking with no relic in reach is `too-far`; the core relic is `taken` (item, currency 1, still `playing`); taking it again does not double-credit; the spark relic clears the run (currency 2, xp 10, `run-cleared`, `complete`); restart reinstalls (no items, start x).
- **Failure surface:** `progression.{xp,currency,items,unlocked,nearId,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Final Product Completion Wave 2 (matrix L08): the seeded room graph is one run on `sw2d.runs` (`bindStarterDungeon` in rogue mode).

1. Start; `sw2d.runs` + `sw2d.ai` installed; mode `rogue`; run index 1, `loadOutcome 'default'`, max health 5; enemies from the room graph.
2. Walk to the first enemy room and strike its foes down -> `roomsCleared 1`, `currency 1` (a cleared room drops coin), `kills >= 1`.
3. Walk into the next room and stand among its foes without striking -> `failed`, run phase `ended`, cause `death`, `metaEarned >= 3`, next unlock `vigor`.
4. SECONDARY (K) -> `bought vigor`.
5. Restart: run index 2, `loadOutcome 'loaded'`, loadout `maxHealthBonus 2`, max health 7, all enemies back, `roomsCleared 0`.
6. Clear every room, walk to the exit -> `complete`, cause `cleared`, `metaEarned >= 10`, phase `ended`.

## Acceptance

- Permadeath, banked meta, between-run unlocks and the loadout are the reusable `sw2d.runs` capability; the dungeon's enemies are `sw2d.ai` agents - no catalog limitation remains.
- Zero console errors, zero external requests.
