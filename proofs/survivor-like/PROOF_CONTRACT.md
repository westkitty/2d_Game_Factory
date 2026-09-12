# Proof Contract — survivor-like

Frozen before implementation. Category-C Wave 17 (existing `sw2d.progression`, ADR-0044) over the Phase 4 encounter loop - survive and kill for XP.

## Preset

`survivor-like` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.combat`, `sw2d.ai`, **`sw2d.progression`**, `sw2d.weapons`, `sw2d.encounters`. Content roles tuning.

Generated via `npm run sw2d -- new proof-survivor-like --preset survivor-like` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.encounters` + `sw2d.weapons` + `sw2d.combat` (`bindStarterEncounters`): a swarm spawns at the top edge and chases; the player fires the catalog sidearm.
- `sw2d.progression` (`PROGRESSION_STARTER 'survive'`, `bindStarterProgression`): XP from staying alive (+1 / 1000 ms) and from kills (`combat:entityDied`, +2), `surge` unlocked at 6 XP. The convergence program replaced the Wave-17 values (tick 400 ms, target 2) that surged 0.8 s after install with no input.

## Terminal success/failure oracle

- **Success surface:** a second in, XP is between 1 and 5 and the run is still open; pause freezes the survival clock; aiming up and firing kills a chaser (`kills >= 1` on both the progression and the battle snapshot, `projectilesSpawned >= 1`); kills plus survival reach `surge` / `complete` at XP >= 6; restart reinstalls (XP 0, kills 0).
- **Failure surface:** `progression.{xp,kills,unlocked,lastResult,outcome}`, `battle.{projectilesSpawned,enemiesAlive,kills,playerHealth}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.progression` + `sw2d.encounters` installed; mode `survive`; `xp 0`; at least one enemy alive.
2. 62 frames -> `1 <= xp < 6`, `playing`.
3. Pause/resume -> `xp` unchanged.
4. Hold AIM_UP (Numpad8) + PRIMARY until `progression.kills >= 1` -> `battle.kills >= 1`.
5. Wait -> `complete`, `surge` unlocked, `surged`, `xp >= 6`.
6. Restart: `xp 0`, `kills 0`, `playing`.

## Acceptance

- Endless difficulty scaling and between-run meta-progression are not reusable systems (catalog limitation).
- Zero console errors, zero external requests.
