# Proof Matrix

Phase 10's five deep, end-to-end proof games - the tier above Phase 8's smoke bar - plus the
capability-completion program's per-phase proof consumers. Each row is backed by a frozen
`proofs/<id>/PROOF_CONTRACT.md`, a real generated composition, and a committed real-browser proof
spec run through `npm run qa:proof`. Mechanically, `npm run qa:proof` is **14/14** as of this
revision.

## Capability program — Phase 1: reusable spatial pointer & interaction (ADR-0018)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/gallery-shooter/` | `gallery-shooter` | `SceneContext.spatialPointer` (world cursor), `SceneContext.interaction` (circle targets + priority), `hitTestPoint`, `sw2d.combat` | Three circular targets + one lowest-priority full-viewport background target; `onClick` kills the target under the cursor; a background click counts a miss | Start; hover selects `target-a`; click at its world point kills it; click empty space (miss, no target selected); click `target-c` (still resolved by world point); restart reinstalls | PASS |
| `proofs/point-and-click/` | `point-and-click` | `SceneContext.interaction` (hover enter/leave, click, drag→drop, pointer capture), `phaserBoundsShape` (live bounds), drop-zone resolution | A lever (hover state + click-to-pull) and a key dragged onto a chest drop-zone | Start; hover enter/leave on the lever; click pulls it; drag the key (captured while the pointer leaves its bounds) onto the chest; drop sets `keyInChest`; restart reinstalls | PASS |
| `proofs/twin-stick-shooter/` (upgraded) | `twin-stick-shooter` | `aimFromPointer` as an **optional** aim source | Existing wave/projectile proof + step 1b: with no digital `AIM_*` held, the mouse position yields `aimX>0, aimY<0` without firing; steps 2-5 prove digital aim still overrides and is independent | PASS |

The two new proof games' presets are left at `maturity: 'recipe'` for now — the frozen proofs
exist and pass `qa:proof`, but the formal `proof-validated` promotion (and its 5/7/62 catalog
count bookkeeping in `honesty.test.ts` / `OPERATIONAL_STATE.md`) is a dedicated catalog pass, not
folded into a capability phase.

## Capability program — Phase 2: data-driven items / effects / pickups (ADR-0019)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/collectathon-platformer/` | `collectathon-platformer` | `sw2d.items` (`ItemsService`) from validated `content/items.json`; `bindCollectiblePickups` (shared platform shell, **no game-specific pickup code**); `arcade.score` + `chain`(`arcade.score` + `world.flag`) effects | Enriched item catalog (coin/gem/star) and level (5 Collectibles, one with an unknown itemId); shell debug reads score + world flag back from the real services | Start (sw2d.items installed, 4 bound pickups); walk right collecting all; inventory `{coin-1:2, gem-1:1, star-1:1}`, score 135, `gotStar` flag set, unknown itemId skipped; restart reinstalls (fresh services, pickups back, inventory cleared) | PASS |
| `proofs/top-down-adventure/` | `top-down-adventure` | Same `sw2d.items` service, different preset/effects: `world.flag` (map key), `progression.currency` (gold), `progression.xp` via a real `consume()` (ration) | Content overlay enables `sw2d.items` + `sw2d.progression`; top-down shell binds pickups + consumes a ration on INTERACT | Start; sweep pickups → `hasMapKey`, currency 20, ration ×2; INTERACT twice → ration consumed, xp 3 → 6; restart clears (this preset's items config does not persist) | PASS |

## Capability program — Phase 3: weapons & projectiles (ADR-0020)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/twin-stick-shooter/` (upgraded) | `twin-stick-shooter` | `sw2d.weapons` (`WeaponsService`) from `content/weapons.json` + shared `createProjectileRuntime` replace the former raw `ProjectilePool` + hand-wired overlap; damage via `combat.health`; enemy death as a `combat:entityDied` reaction | Existing wave/aim/pause/restart journey, now fired through the reusable weapon model | Movement independent from aim; optional pointer aim (ADR-0018); two 10-damage hits per 20-hp enemy clear wave 1; projectile lifecycle `spawned = live + expired`; restart reinstalls a fresh weapon+runtime | PASS |
| `proofs/run-and-gun/` (new) | `run-and-gun` | Same weapon model + projectile runtime on a **platform** shell; two `Enemy` turret targets; per-projectile overlap → `combat.damage`; `hitsResolved` counter | Level ground row + two turrets; the platform shell's `bindStarterWeapon` swapped for a full `createProjectileRuntime` wired to the enemy group | Start (sw2d.weapons installed, `sidearm` equipped); close distance, face right, fire (220ms cooldown gates rate); both turrets die after 2 hits each (`hitsResolved >= 4`); pause freezes the field; restart reinstalls | PASS |

## Capability program — Phase 4: combat / encounter orchestration (ADR-0021)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/bullet-hell/` (new) | `bullet-hell` | `sw2d.encounters` (`EncounterService`) from `content/encounters.json` - a capped ring + spiral emitter and a spawn wave; `expandFirePattern`; `createEncounterRuntime` firing through Phase 3's projectile runtime; `combat.health` for both sides | Player auto-aims a sidearm at the nearest drone; enemy bullets damage the player, player bullets kill the drones | Start (`phaseId: spread`); hold fire ~2.5s; `bulletsFired === 144` exactly (deterministic), `projectilesLive` bounded, drones killed, player damaged; `encounterComplete` at elapsed 2600ms; restart resets the runtime | PASS |
| `proofs/boss-rush/` (new) | `boss-rush` | `sw2d.encounters` with `bossEntityId` - three phases with distinct emitter patterns (aimed → aimed fan → ring), `entity-health-below` transitions, `onEnterInvulnMs` windows, an `onEnterFlag`; `createEncounterRuntime` applies invuln + flag from the definition | Shell spawns the boss sprite + registers it in combat; player holds fire straight up | Start (`phase-1`, boss at 100%); fire; boss < 66% → `phase-2` + `bossInvulnerable` (health frozen during the window); < 33% → `phase-3` + `finalPhase` flag; < 3% → `encounterComplete`; restart returns to `phase-1` | PASS |

## Capability program — Phase 5: navigation & pathfinding (ADR-0022)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/turn-based-tactics/` (new) | `turn-based-tactics` | `sw2d.navigation` - `NavGrid.reachable(unitCell, budget)` for the deterministic movement range; `NavGrid.findPath` via `createRouteFollower` for the route | A 10×8 battlefield with wall cells; a selectable unit + a grid cursor | Start (`reachableCount === 28`, identical across reads); confirm a cell inside the reachable set -> unit follows the route (`lastPathCost 2`, `lastPathLen 3`); confirm a cell past the budget -> rejected; restart resets | PASS |
| `proofs/lane-defense/` (new) | `lane-defense` | `sw2d.navigation` - three enemies each with a `RouteFollower` to the base; `setWalkable` + re-request on blocker placement; a route-destroying placement is rolled back | 12×3 grid, grid cursor places blockers | Start (3 enemies routing); a mid-lane blocker re-paths all three (`enemiesRepathed >= 3`, none rejected); a placement that would fully wall the column is rejected; all three still reach the base; restart resets | PASS |

## Phase 10 deep proofs

See [`PHASE10_PROOF_HANDOFF.md`](../architecture/PHASE10_PROOF_HANDOFF.md) for the phase-level
narrative (shared-architecture repair, deferred triggers, known limitations) this matrix does not
repeat.

| Proof | Preset | Reusable capabilities exercised | Game-specific mechanics | Browser journey | Lifecycle evidence | Offline evidence | Maturity result | Status |
|---|---|---|---|---|---|---|---|---|
| A - `proofs/chase-platformer/` | `chase-platformer` | `platformController`, `sw2d.world` (checkpoints), `sw2d.world-entities` (Tiled dispatch), `sw2d.combat` (health/damage/invulnerability), `sw2d.arcade` (score), live `content/tuning.json` | Coyote time, jump buffer, double jump (bounded movement policy), content-derived collectible quota, chase pressure frozen during pause and post-respawn spawn-grace, hazard death, checkpoint respawn | Start, move/jump, buffered jump, coyote jump, double jump, collect quota, activate checkpoint, die to hazard, respawn at checkpoint, chase pressure advances during play and freezes during pause/grace, reach exit after quota | Checkpoint/death/restart does not duplicate listeners or entities (per-life state resets cleanly on respawn) | N/A (no network surface) | `proof-validated` | PASS |
| B - `proofs/twin-stick-shooter/` | `twin-stick-shooter` | `topDownController` (independent digital aim, ADR-0016), shared `ProjectilePool`, `sw2d.combat`, `sw2d.world-entities` (`Enemy`-classed Tiled objects), `sw2d.arcade` (score) | Two content-authored enemy waves (wave 2 dormant until wave 1 clears), stationary turret-archetype contact hazards, real closest-in-range targeting, engine-level pause/restart | Start, move+aim simultaneously in different directions, fire, damage/kill two wave-1 enemies (wave completes, wave 2 activates), take contact damage from a wave-2 enemy, pause (state frozen), resume, restart (scene reinstalls) | Projectile counts bounded; `spawnedTotal = liveCount + expiredTotal` at every sample; restart returns a **fresh** `ProjectilePool`'s counters to zero, proving a real scene reinstall, not a reset flag | N/A (no network surface) | `proof-validated` | PASS |
| C - `proofs/tower-defense/` | `tower-defense` | `gridController` (keyboard cursor - spatial pointer stays deferred), `sw2d.progression` (currency), `sw2d.combat`, shared `ProjectilePool` | Fixed route, placement-cell validation, real closest-in-range target selection, **tower upgrade** (`SECONDARY_ACTION` on the tower's own cell, doubles projectile damage) | Start with known currency, move cursor, invalid placement rejected (no spend), valid placement (currency deducted), wave advances automatically, tower damages first enemy (2 hits at base damage), upgrade (currency deducted, damage doubles), second enemy dies in 1 hit at upgraded damage, victory with zero breaches | Route is deterministic (fixed waypoints/spawn timings); currency changes are exact at every step | N/A (no network surface) | `proof-validated` | PASS |
| D - `proofs/sokoban/` | `sokoban` | Real `sw2d.puzzle` (`PuzzleService`) via `packConfig.ts`'s `configSource: 'code'` seam (ADR-0017) - the **only** board state; `gridController` | Standard push/block rules (bounded game-specific TypeScript, no puzzle DSL); `CANCEL`→undo, `SECONDARY_ACTION`→reset, both read directly off `PuzzleService` | Start, ordinary move, legal push, invalid push (byte-for-byte unchanged, rejection counted), two more moves, second push (solves), undo (exact prior state restored), reset (exact initial state restored), replay to solve again | No parallel state/undo stack in `shellPack.ts` to leak; `PuzzleService.isSolved()` and the shell's own visible-completion read agree at every sample | N/A (no network surface) | `proof-validated` | PASS |
| E - `proofs/idle-incremental/` | `idle-incremental` | `sw2d.simulation` (resource ledger + job queue), `sw2d.progression` (currency), `SaveStore` (`context.saves`), `uiSimulationController` | Deterministic passive production, one job (`gather`), one upgrade (doubles the rate, load-bearing for subsequent production), versioned save record | Start, two equal-length stepped intervals (equal gold delta, proving determinism), two job cycles (accumulate currency), upgrade (currency deducted, rate doubles, subsequent production measurably faster), save, **real browser reload** (`gotoAndWaitForRuntime` against the same URL, not an in-memory reset), restored state matches saved state, simulation continues after reload | No canvas movement anywhere in the loop; SaveStore round-trips through real storage across the reload, not JS state | Zero external requests (shared `runSmoke`/`runProofs` oracle) | `proof-validated` | PASS |

## Reading this table against the acceptance contract

Every "Browser journey" cell above is the automated sequence the committed
`packages/qa/proof-specs/<name>.ts` file actually drives against a real production build via
system Chrome (`npm run qa:proof`) - not a manual checklist and not inferred from source reading.
Each proof spec asserts against the same `context.debug.contribute(...)` snapshot surface the
shared `readShellState()` helper reads, the same mechanism every Phase 8 smoke spec already used;
none of the five reaches into private state a real player interaction couldn't also observe.

"Maturity result" reflects `packages/presets/src/catalog/*.ts`'s live `maturity` field, mechanically
checked against this claim by `packages/presets/test/honesty.test.ts` (exactly these five ids may
claim `proof-validated`; every other preset is `smoke-validated` or `recipe`, never overstated).
