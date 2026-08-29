# Proof Contract — twin-stick-shooter

Frozen before implementation.

## Preset

`twin-stick-shooter` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required pack `sw2d.combat`, optional packs `sw2d.world`, `sw2d.world-entities`, `sw2d.arcade`. Content roles `tuning`, `levels`. Currently `smoke-validated`.

Generated via `npm run sw2d -- new proof-twin-stick-shooter --preset twin-stick-shooter`, moved from `games/proof-twin-stick-shooter/` into this committed `proofs/twin-stick-shooter/` tree.

## Reusable capabilities exercised

- `topDownController.read()` — `moveX`/`moveY` (movement) and `aimX`/`aimY`/`aimMagnitude` (independent digital aim, ADR-0016) read simultaneously from the same intent. Aim is never derived from movement or last-move-direction.
- **Phase 3:** `sw2d.weapons` (`WeaponsService`) + `createProjectileRuntime` (`@sw2d/runtime/game-support`) replace the former raw `ProjectilePool` + hand-wired overlap. The `blaster` weapon comes from validated `content/weapons.json`; projectile-vs-enemy damage is resolved through `combat.health`, and enemy death is a `combat:entityDied` reaction.
- `sw2d.combat` (`CombatService`) — player and every enemy registered with finite health; damage/heal/invulnerability drive both projectile-vs-enemy and enemy-vs-player contact damage.
- `sw2d.world-entities` (`EntityRegistry`) — enemies are declared as `Enemy` Tiled objects in `content/levels/main.json` and dispatched through the existing Tiled pipeline, the same pattern Proof A uses. No new Tiled class families beyond this one.
- `sw2d.arcade` (`ArcadeService`) — `addScore` on each enemy kill.
- `content/tuning.json` (`player.moveSpeed`) — read live (generator already wires this for the top-down shell).
- Engine-level pause (`PAUSE`/`CONFIRM` while paused) and restart (`SECONDARY_ACTION` while paused, `SceneRouter.restartRun()`) — no game-specific pause/restart code; both are shared runtime behavior already exercised by Proof A's pause test and by existing Phase 8 demos' restart-adjacent smokes.

## Game-specific mechanics (`src/game-specific/shellPack.ts`)

- Two enemy waves, declared as content (`Enemy` objects with `wave`, `enemyId`, `health` properties) — wave count and roster are data, not hard-coded arrays, so retuning waves is a content edit.
- Wave 1 enemies (2) are active (visible, collidable, lethal) from scene start. Wave 2 enemies (3) are dispatched at install but held dormant (invisible, body disabled) until wave 1 is fully cleared, at which point they activate. This is bounded game-specific wave-sequencing policy — no reusable "wave" system exists yet, matching this preset's documented known limitation.
- Enemies are stationary (turret-archetype) contact hazards, not a pathfinding/chase AI — `sw2d.ai` is not a pack this preset declares, and building one would be exactly the kind of speculative shared-capability creation Phase 9 forbids. Contact damage to the player is a real, deterministic mechanic; it does not require enemy movement to be real.
- Player and each enemy are independent `CombatService` registrations; a 500ms invulnerability window after any hit (player or enemy) prevents multi-hit-per-frame double counting, mirroring Proof A's hazard-fix pattern (invulnerability is only re-armed when a hit actually lands, not on every rejected overlap tick).
- Score via `sw2d.arcade`; wave/kill/score state is exposed through the debug snapshot, not inferred.

## Content roles used

- `tuning` — `content/tuning.json`, unchanged schema, `player.moveSpeed` read live.
- `levels` — `content/levels/main.json`: one `PlayerSpawn` and five `Enemy` objects, using the existing closed object-class catalog's `Enemy` class (`packages/content-pipeline/src/tiled/objectClasses.ts`, required `enemyType: string`) plus passthrough custom properties (`wave` int, `enemyId` string, `health` int) the catalog already permits alongside a class's declared properties. No catalog or schema change.

## Terminal success/failure oracle

- **Success surface:** `wave1Cleared === true` (all wave-1 enemies' `CombatService` health reached 0) after the automated journey fires on them; this is the "reach at least one wave completion" bar the acceptance criteria set.
- **Failure surface (all observable):** `playerHealth` (`{current,max}`), `enemies` (per-id `{alive, health}`), `wave` (`1 | 2`), `wave1Cleared` / `wave2Cleared`, `score`, `projectilesLive` / `projectilesSpawned` / `projectilesExpired`, `paused` is not tracked locally (engine-level; read via the shared debug snapshot's own `paused` field, not duplicated here).

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start the run (`Space`), scene reaches `sw2d.play`.
1b. (Phase 1, ADR-0018) With no digital `AIM_*` held, move the mouse up and to the right of the player. `pointerAimActive` becomes true and `lastAimX > 0`, `lastAimY < 0` — the pointer position is an *optional* aim source, resolved through `aimFromPointer`, and it does not fire or touch the digital axis.
2. Move (hold `MOVE_DOWN` then back `MOVE_UP`) while independently aiming right (`AIM_RIGHT`/`Numpad6` held throughout, unaffected by the movement keys) — proves aim independence by construction, matching the existing smoke spec's proven pattern.
3. Fire (`PRIMARY_ACTION`) at a wave-1 enemy positioned in the aim direction; projectile spawns and travels.
4. Projectile hits the enemy; enemy health drops. Fire again (after the projectile lifetime/travel) to land a second hit and kill it (enemy health 20, projectile damage 10 — two hits required, a real multi-hit kill, not a one-shot).
5. Repeat for the second wave-1 enemy.
6. `wave1Cleared === true` once both wave-1 enemies are dead — at least one wave completion reached.
7. Player deliberately walks into a wave-2 enemy (now activated) to take real contact damage; `playerHealth.current < playerHealth.max` afterward.
8. Pause (`PAUSE`); sample score/projectile-live-count/player-position twice across a stepped interval — both samples equal (frozen).
9. Resume (`CONFIRM`); a further sample shows state can advance again (e.g. score or projectile position changes after firing once more, or simply that the scene is interactive again via a successful subsequent action).
10. Restart (pause again, then `SECONDARY_ACTION`): the whole play scene stops and reinstalls. Score returns to 0, player health returns to full, wave returns to 1, `projectilesSpawned`/`projectilesLive`/`projectilesExpired` all return to 0 (a fresh `ProjectilePool` instance, not a reset flag).

## Acceptance

- Aim is not derived from movement (proven by construction: independent simultaneous inputs).
- Projectile lifecycle is leak-free: `expiredTotal` accounts for every spawned projectile that isn't currently live (hit-removals count via `pool.remove`, same as the reference demo).
- Real wave completion (wave 1) is reached, driven by real per-enemy `CombatService` health, not a hard-coded flag.
- Start / take-or-deal-damage / complete-a-wave / pause / restart journey passes.
- Restart genuinely reinstalls the scene (verified via zeroed projectile pool counters, not just a score reset).
- Digital `AIM_*` remains the authoritative, independent aim axis (ADR-0016): a purely-aimed shot is still proven by holding perpendicular movement and aim keys simultaneously. Phase 1 adds *only* an optional fallback — when no digital aim is pressed, the spatial pointer (ADR-0018) supplies an aim vector via `aimFromPointer`. Step 1b proves the fallback engages; steps 2–5 prove digital aim still overrides it and is unaffected.
