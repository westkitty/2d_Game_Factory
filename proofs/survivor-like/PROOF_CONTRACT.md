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

Final Product Completion Wave 2 (matrix L06): the encounter loops as escalating waves (`content/encounters.json` `escalation`) and the scene is one permadeath run on `sw2d.runs` (`content/runs.json`).

1. Start; `sw2d.progression` + `sw2d.encounters` + `sw2d.runs` installed; mode `survive`; `xp 0`; run index 1, `loadOutcome 'default'`, max health 100, wave 0; at least one enemy alive.
2. 62 frames -> `1 <= xp < 6`, `playing`.
3. Pause/resume -> `xp` unchanged.
4. Kite (pointer aim at the nearest grunt, PRIMARY held, back away from close ones) until `kills >= 1`; keep kiting -> `complete`, `surge` unlocked, `xp >= 6`.
5. Keep kiting until `wavesCleared 1` -> `battle.wave 1`, `enemySpeed > 60` (escalated), `progression.wave 1`.
6. Stop and wait -> the swarm closes in: `runOver`, `battle.outcome 'failed'`, `playerDeaths 1`, run phase `ended`, cause `death`, `metaEarned >= 4`, next unlock `sturdy`.
7. SECONDARY (K) -> `bought sturdy`.
8. Restart: run index 2, `loadOutcome 'loaded'`, loadout `maxHealthBonus 40`, max health 140, wave 0, `xp 0`, `kills 0`, `playing`.

## Acceptance

- Endless escalation (`sw2d.encounters` escalation), permadeath, banked meta currency, between-run unlocks and the loadout are reusable systems (`sw2d.runs`) - no catalog limitation remains.
- Zero console errors, zero external requests.
