# Proof Matrix

Phase 10's five deep, end-to-end proof games - the tier above Phase 8's smoke bar - plus the
capability-completion program's per-phase proof consumers and the Category-C convergence
program's 51 committed proofs. Each row is backed by a frozen `proofs/<id>/PROOF_CONTRACT.md`
(mechanically required for every `proofs/<id>/` by `packages/presets/test/proofEvidence.test.ts`),
a real generated composition, and a committed real-browser proof spec run through
`npm run qa:proof`. Mechanically, `npm run qa:proof` is **74/74** as of this revision - one proof
per preset. `npm run qa:adversarial` additionally attacks every built proof with hostile input
(73/74 on first run; the one leak it found is fixed) and `npm run qa:performance` records
real-time frame pacing for eight representative workloads.

## Capability program — Phase 1: reusable spatial pointer & interaction (ADR-0018)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/gallery-shooter/` | `gallery-shooter` | `SceneContext.spatialPointer` (world cursor), `SceneContext.interaction` (circle targets + priority), `hitTestPoint`, `sw2d.combat` | Three circular targets + one lowest-priority full-viewport background target; `onClick` kills the target under the cursor; a background click counts a miss | Start; hover selects `target-a`; click at its world point kills it; click empty space (miss, no target selected); click `target-c` (still resolved by world point); restart reinstalls | PASS |
| `proofs/point-and-click/` | `point-and-click` | `SceneContext.interaction` (hover enter/leave, click, drag→drop, pointer capture), `phaserBoundsShape` (live bounds), drop-zone resolution | A lever (hover state + click-to-pull) and a key dragged onto a chest drop-zone | Start; hover enter/leave on the lever; click pulls it; drag the key (captured while the pointer leaves its bounds) onto the chest; drop sets `keyInChest`; restart reinstalls | PASS |
| `proofs/twin-stick-shooter/` (upgraded) | `twin-stick-shooter` | `aimFromPointer` as an **optional** aim source | Existing wave/projectile proof + step 1b: with no digital `AIM_*` held, the mouse position yields `aimX>0, aimY<0` without firing; steps 2-5 prove digital aim still overrides and is independent | PASS |

The formal `proof-validated` promotion for every preset in this section landed in the Arena
finish program's catalog reconciliation (docs/architecture/ARENA_FACTORY_FINISH_STATE.md),
which took the catalog to 23 proof-validated / 3 smoke-validated / 48 recipe; the Category-C
convergence program then committed the other 51 proofs (74 / 0 / 0). The paragraph below
records why promotion was originally deferred during the capability program, not folded into
a capability phase.

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

## Capability program — Phase 6: data-driven puzzle rules (ADR-0023)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/sokoban/` (revised) | `sokoban` | `sw2d.puzzle-rules` (`PuzzleRulesService`) driven by a `sokoban` definition in validated `content/puzzles.json` - the **entire** ruleset (walls, box, goal, legal-move/legal-push resolution, solved-detection, undo history, reset); `gridController` | Rendering only: sprites positioned from `puzzle.snapshot()`; `rejectedMoves` counted when a `move` op leaves `moves` unchanged. No board table, no move resolver, no code-config seam (`packConfig.ts` is `{}`) | Start; ordinary move; legal push; invalid push (snapshot byte-for-byte unchanged, `moves` frozen, `rejectedMoves` up); reposition + second push onto the goal (solved); undo (exact prior state); reset (exact initial, `moves` 0); replay to solve again | PASS |
| `proofs/puzzle-platformer/` (new) | `puzzle-platformer` | Same `sw2d.puzzle-rules` service, `switch-sequence` kind: switch set, the `a`→`d` link, and the "press order must end `a,b,c`" completion rule all in `content/puzzles.json` | Platform shell walks the player; three `Interactable` level zones are the switches; INTERACT toggles the overlapped switch, CANCEL undoes, SECONDARY_ACTION resets. No completion logic in the shell | Start; press B (out of order, not solved); press A → decoy D also switches on via the link (not solved); press B then C → press order ends `a,b,c` → solved; undo (not solved); reset (press order + on-set cleared); re-solve in order | PASS |

## Capability program — Phase 7: deterministic procedural generation (ADR-0024)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/endless-runner/` (new) | `endless-runner` | `sw2d.generation` (`GenerationService`) `segment-chain` generator from `content/generation.json`; project-owned seeded PRNG; output is a `NormalizedLevel` rendered exactly like a Tiled level | Renders the generated ground; `INTERACT` re-runs the same seed and records `regenMatchesInitial`; `SECONDARY_ACTION` re-runs a different seed and records `altDiffers` + `altValid`. No generation logic in the shell | Start (`valid`, `spawnPlaced`, `segmentCount === 10`, first template `start-flat`); hold Right → `progressedX > 200`; `INTERACT` → `regenMatchesInitial === true`; `SECONDARY_ACTION` → `altDiffers === true` && `altValid === true`; restart → `chosenTemplates` byte-identical to the reference sequence | PASS |
| `proofs/dungeon-crawler/` (new) | `dungeon-crawler` | Same `sw2d.generation` service, `room-graph` generator: matched-door room graph with a start node, critical path, exit room, bounded branches; `manifest.graph` (nodes/edges) inspectable | Renders walls from `solids`, player at the start-room spawn, `Enemy` sprites; BFS over `manifest.graph` for start→exit reachability; `INTERACT` / `SECONDARY_ACTION` reproducibility checks | Start (`valid`, `hasStartNode`, `hasExitObject`, `edgesValid`, `startToExitReachable`, `roomCount >= 4`); move → `travelled > 40` (wall collision holds); `INTERACT` → `regenMatchesInitial === true`; `SECONDARY_ACTION` → `altDiffers` && `altValid`; restart → `roomCount` and reachability unchanged | PASS |

## Capability program — Phase 8: world graph / rooms / transitions / map (ADR-0025)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/metroidvania/` (new) | `metroidvania` | `sw2d.world-graph` (`WorldGraphService`) - three nodes each naming its own Tiled level; `createRoomTransitionRuntime` (tear down one room, build the next at the destination entrance); `createWorldMapOverlay`; a bounded `flag` traversal condition; opt-in persistence | Renders the current room's ground + door sprites; a door INTERACT is forwarded as `requestTransition`; a lever INTERACT sets `treasury-unlocked` on `world.state` | Start in Hub; Hub→East; locked East→Treasury rejected (`condition-failed`); pull the lever → flag set, `canTraverse` true; East→Treasury; return to East, flag still set; open map (3 areas, current marked); `roomDoorSprites` bounded (no leak); restart → persistence restores the graph (`currentNode`, discovered) | PASS |
| `proofs/exploration-game/` (new) | `exploration-game` | Same service, simpler: three areas in a loop, no gating; discovery / visited state; the map; a persistent `world.state` flag; the room transition bridge | Top-down movement; door INTERACT → transition; `SECONDARY_ACTION` toggles the map | Start in Plaza (`town-visited` flag set); walk the full loop plaza→garden→library→garden→plaza and repeat; end: all 3 discovered + visited, flag still set through every transition, `roomDoorSprites` never exceeds 2 (no accumulation); map shows 3 areas + ≥2 known routes; restart → back to Plaza (no persistence configured) | PASS |

## Capability program — Phase 9: optional advanced physics & constraints (ADR-0026)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/grappling-platformer/` (new) | `grappling-platformer` | `physicsProfile: 'matter'`; `createAdvancedPhysics` (Matter-backed `AdvancedPhysicsService`); `createGrappleService` (a near-rigid distance constraint player↔anchor); named collision categories | The player is a Matter body moved by impulses; SECONDARY_ACTION toggles the grapple; INTERACT/CANCEL reel the rope. No scripted swing | Start (`physicsEnabled`, `constraintCount 0`, 2 eligible anchors); move under an anchor; attach → `constraintCount 1`, `grappleAttached`; the anchor distance stays near the rope length while the player's position changes (a real pendulum, not free fall); detach → `constraintCount 0`; re-attach; reel in → rope shortens; restart → no constraint survives, body count back to a fresh service's | PASS |
| `proofs/physics-toy/` (new) | `physics-toy` | Same `AdvancedPhysicsService`; `createSpring`; Phase-1 `context.interaction` + `context.spatialPointer` | Three rigid balls + a box fall onto a static floor between two walls and a ceiling; a spring links two balls; a click on the centre target shakes every dynamic body | Start (`bodyCount ≥ 7`, `constraintCount 1`); the balls fall and settle above the floor (collision holds); the spring keeps the two linked balls within a bounded distance; a spatial-pointer click (`hoveredId === 'shaker'`) shakes them upward; they settle again bounded, spring intact; restart restores the fresh body/constraint counts and clears the shake count | PASS |

## Capability program — Phase 10: vehicle handling & racing (ADR-0027)

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/top-down-racer/` (new) | `top-down-racer` | `sw2d.vehicles` (`VehicleService`, `vehicle.motion`) - `VehicleIntent` in, car motion out; `sw2d.racing` (`RaceService`, `race.state`) - four ordered checkpoints, two laps, a countdown, simulation time | A tiny autopilot points the wheel at `expectedCheckpoint()` (produces intent only); CONFIRM starts the race; SECONDARY_ACTION fires the last checkpoint out of order | Start + CONFIRM → `phase 'countdown'`; countdown elapses → `'racing'`, `expectedCheckpoint 'cp-1'`; the car accelerates (`maxSpeed > 100`) and steers; a skipped-checkpoint shortcut → `lastShortcutCounted false`, lap unchanged; the autopilot runs two ordered laps → `finished`, `lapCount 2`, `phase 'finished'`; restart → fresh race (`finished false`, `lapCount 0`) | PASS |
| `proofs/time-trial-racer/` (new) | `time-trial-racer` | Same services in `time-trial` mode; best lap / total persisted through `context.saves` | Same autopilot; PRIMARY_ACTION restarts the attempt; holding INTERACT slows the autopilot for a deliberately slow first run | Start (INTERACT held, slow) + CONFIRM → countdown → `elapsedMs` climbs (a live timer); an out-of-order checkpoint is rejected; the slow lap finishes and sets `bestTotalMs`; PRIMARY_ACTION restarts (`phase 'idle'`, `elapsedMs 0`, best retained); a full-speed second lap finishes with `bestTotalMs` **less than** the first - a better valid run updates the best, and no invalid sequence is ever accepted as a run | PASS |

## Category-C convergence program — committed proofs (ADR-0028..0058)

The Category-C waves (`docs/architecture/CATEGORY_C_CAPABILITY_PROGRAM_STATE.md`) played every
one of these journeys against factory-generated games but deferred the committed proof. The
convergence program (`docs/architecture/CATEGORY_C_CONVERGENCE_MATRIX.md`) generated each proof
through the unmodified canonical factory (`npm run sw2d -- new proof-<id> --preset <id>` - no
`src/game-specific/` customization, because the Category-C shells consume the capability
directly), froze a `PROOF_CONTRACT.md`, and committed a real-browser spec under
`packages/qa/proof-specs/`. Every row below includes a genuine scene reinstall
(`restartRun`: `runIndex` advances, state returns to the install values).

### ui-simulation shell consumers

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/shopkeeper/` | `shopkeeper` | `sw2d.economy` (shop mode): demand queue, matching-good serve, restock cost, refusals | None beyond the generated shell (`bindStarterEconomy`) | Serve the wanted good; serve-spam refused (`no-customer`); restock then `cannot-afford`; second customer; pause/resume keeps cash; restart resets | PASS |
| `proofs/restaurant/` | `restaurant` | `sw2d.economy` (kitchen mode): time-gated cook job then serve | None | Serve before cooking refused; three cook→serve tickets (`served 3`, cash up); pause/resume; restart (`producing null`) | PASS |
| `proofs/tycoon-lite/` | `tycoon-lite` | `sw2d.economy` (factory mode, `autoSell`) | None | Production job is time-gated; auto-sells (`served 1`); spam while busy does not double-produce; `served 2`; pause/resume; restart | PASS |
| `proofs/pet-creature/` | `pet-creature` | `sw2d.needs` (creature mode): decay, feed/play, affinity, 1600 ms hold | None | Hunger decays; feed raises and clamps ≤100; play raises mood; hold → `complete`; pause/resume; restart (`affinity 0`) | PASS |
| `proofs/aquarium-terrarium/` | `aquarium-terrarium` | `sw2d.needs` (habitat mode): two meters, 7 s hold, fail floor | None | Feed + refresh water; still `playing` at 2 s of hold; `complete` at ≥7000 ms; restart | PASS |
| `proofs/virtual-pet/` | `virtual-pet` | `sw2d.needs` (companion mode): complete on threshold after two acts | None | One act still `playing`; second act `complete`; post-complete acts inert; restart | PASS |
| `proofs/visual-novel/` | `visual-novel` | `sw2d.dialogue` (novel mode): lines, a two-option choice, two branches, two endings | None | Choice at step 2; option 1 → `keep-the-secret` → `midnight-ending`; inert past the ending; restart; option 0 → `dawn-ending` | PASS |
| `proofs/local-party-game/` | `local-party-game` | `sw2d.local-play` (hotseat mode): seat ownership passes per act | None | Seat 0 scores then seat 1; six acts decide a winner; inert after; restart | PASS |
| `proofs/reaction-timing/` | `reaction-timing` | `sw2d.timing` (reaction mode): visual go-cue, hit window, latency | None | Early press not a hit; hit inside the window with numeric latency; second cue completes; restart | PASS |
| `proofs/rhythm-action/` | `rhythm-action` | `sw2d.timing` (rhythm mode): repeating beat windows | None | Three presses each inside an open window; `complete`; restart | PASS |
| `proofs/farming-lite/` | `farming-lite` | `sw2d.simulation` jobs as plots (`SIMULATION_STARTER 'farm'`) | Plot/crop presentation | Plant → `growing` (job queued); early harvest refused; ripe → harvest; three harvests `complete`; restart (all plots `empty`) | PASS |
| `proofs/colony-lite/` | `colony-lite` | `sw2d.simulation` jobs as workers + construction (`'colony'`) | Worker/build presentation | Build refused (`need-materials`); assign worker (busy, re-assign refused); gather ×2; build → `built`; restart | PASS |
| `proofs/interactive-fiction-hybrid/` | `interactive-fiction-hybrid` | `sw2d.narrative` flags/seen/choices (`NARRATIVE_STARTER 'fiction'`) | Menu verbs | TAKE `locked` before LOOK; LOOK sets flag + seen; TAKE ends `escaped`; restart | PASS |
| `proofs/fishing-game/` | `fishing-game` | `sw2d.arcade` score (`ARCADE_STARTER 'fishing'`) | Cast/bite/land presentation | Missed bite scores nothing; strike in the window lands; second fish `complete`; restart | PASS |
| `proofs/cooking-game/` | `cooking-game` | `sw2d.arcade` score (`'cooking'`) | Ordered recipe steps | Wrong ingredient counted, no advance; flour → egg → ready (`recipeStep 3`); restart | PASS |
| `proofs/microgame-collection/` | `microgame-collection` | `sw2d.arcade` score (`'micro'`) | Wait/go tap + mash rounds | Tap during `wait` ignored; tap at `go` scores; five-press mash `complete`; inert after; restart | PASS |
| `proofs/auto-battler/` | `auto-battler` | `sw2d.strategy` + `sw2d.targeting` (auto mode) - the pack is the one health owner (`health(id)`) | Lineup pick phase; CONFIRM locks and starts the fight | Idle 40 frames: nothing fights; pick changes fighter; CONFIRM `fight`, pick frozen, second CONFIRM `auto`; cpu health falls to 0 → `won`; restart restores full health | PASS |
| `proofs/pinball-lite/` | `pinball-lite` | `sw2d.pinball` (table mode): gravity, bumpers, flippers, drain-reset, win score | Flipper sprites and HUD score read from the same catalog | Hands off: ball drains and resets with `score 0`; flipping only when the ball is over a flipper hits bumpers to `score 3` / `complete`, `flips` == presses; restart | PASS |

### top-down shell consumers

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/stealth-game/` | `stealth-game` | `sw2d.perception` (infiltrate): vision cone, suspicion, seen/alarm, loot, exit | None beyond the generated shell | Walk into the cone → `seen`/`failed`; restart; sneak above the cone, take the loot unseen, exit → `complete`, no alarm | PASS |
| `proofs/heist-game/` | `heist-game` | `sw2d.perception` (heist): loot trips the alarm, escape under alarm | None | Exit before loot stays `playing`; loot → `alarm true`; exit → `complete` with alarm; restart | PASS |
| `proofs/breakout/` | `breakout` | `sw2d.ball-paddle` (breakout): rebound, 12 bricks, lives, score | None | Paddle moves; pause/resume mid-rally; track the ball → `paddleReturns ≥ 1`, all bricks cleared, `complete`; restart | PASS |
| `proofs/pong/` | `pong` | `sw2d.ball-paddle` (pong, first-to-3) + `sw2d.local-play` (versus seats: Arrow keys vs W/S) | None | Seat axes move their own paddle only; a real `player-return`; first-to-3 decides (`complete`/`failed`), no point after; restart | PASS |
| `proofs/action-adventure/` | `action-adventure` | `sw2d.melee` (skirmish): reach, knockback, hit-stun | None | Whiff at range; close in, `hit` leaves the foe alive; two more kill → `complete`; restart | PASS |
| `proofs/arena-combat/` | `arena-combat` | `sw2d.melee` (arena): three foes | None | Foes 3→2→1→0 with two strikes each; inert after clear; restart | PASS |
| `proofs/horizontal-shmup/` | `horizontal-shmup` | `sw2d.stage-scroll` (horizontal) over `sw2d.weapons` + `sw2d.encounters` | None | Offset advances on its own; ship moves in band; fire spawns projectiles; pause freezes scroll; stage-clear; restart | PASS |
| `proofs/vertical-shmup/` | `vertical-shmup` | `sw2d.stage-scroll` (vertical, -Y fire axis) | None | Same journey on the vertical axis contract | PASS |
| `proofs/survivor-like/` | `survivor-like` | `sw2d.progression` survive (XP from kills via `combat:entityDied` + survival ticks) over the encounter loop | None | XP ticks slowly; pause freezes the clock; aim up + fire kills a chaser (`kills ≥ 1`, +2 XP); surge at ≥6 XP; restart | PASS |
| `proofs/action-roguelite/` | `action-roguelite` | `sw2d.progression` run (items/currency/xp/unlock) over `sw2d.generation` | Relic walk | `too-far`; core `taken` (no double-credit); spark `cleared` (currency 2, xp 10, `run-cleared`); restart | PASS |
| `proofs/investigation-game/` | `investigation-game` | `sw2d.narrative` case + `sw2d.codex` (case) | Clue walk | `too-far`; print/photo `inspected` once each; desk `deduced` → `closed`; restart | PASS |
| `proofs/photography-game/` | `photography-game` | `sw2d.camera` (frame) via `bindStarterToy` photo | Subject walk | `too-far`; bird captured once; tree completes the album; restart | PASS |
| `proofs/base-defense/` | `base-defense` | `sw2d.combat` via `bindStarterCombat` hold | Raider intercept | `miss`; intercept and kill both raiders; `baseHealth 3` at `complete`; restart | PASS |
| `proofs/simple-rts/` | `simple-rts` | `sw2d.strategy` + `sw2d.territory` (occupy catalog) + ADR-0018 drag box-select | One-unit select, two-unit box | Orders with nothing selected move nobody; PRIMARY selects one; restart; drag boxes 2; march → `seized` both ≥ 780 | PASS |
| `proofs/territory-control/` | `territory-control` | `sw2d.territory` (stand): timed capture, ownership persists on leave | None | Pass-through does not capture; standing does (`owned 1`); kept on leave; zone B → `complete`; restart | PASS |
| `proofs/museum-exhibit/` | `museum-exhibit` | `sw2d.codex` (exhibit) via `bindStarterLook` museum | Plaque walk | `too-far`; plinth inspected once; bust completes; restart | PASS |

### pointer, grid, platform and vehicle shell consumers

| Proof | Preset | Reusable capability exercised | Game-specific mechanics | Browser journey | Status |
|---|---|---|---|---|---|
| `proofs/physics-puzzle/` | `physics-puzzle` | `sw2d.puzzle-rules` `physics-goal` + Matter ball | Nudge / launch presentation | Idle 60 frames never solves; one nudge lands the ball in the goal (`solved`, x ≥ 740); restart | PASS |
| `proofs/escape-room/` | `escape-room` | `sw2d.puzzle-rules` `escape` + ADR-0018 clicks | Inspect hotspots from content | Lock before note `locked`; note (idempotent); lock → key + `solved`; restart | PASS |
| `proofs/drawing-game/` | `drawing-game` | ADR-0018 spatial-pointer drag (`POINTER_STARTER 'draw'`) | Stroke presentation | Tap is not a stroke; 320 px drag is one stroke ≥ 300; second completes; restart | PASS |
| `proofs/dress-up-character-toy/` | `dress-up-character-toy` | ADR-0018 drag capture + drop-zone (`'wardrobe'`) | Wardrobe | Off-figure drop does not attach; mid-drag `draggingId 'hat'`; hat then shirt attach → `complete`; restart | PASS |
| `proofs/sandbox-playground/` | `sandbox-playground` | ADR-0018 click stamps + pick/move/delete (`TOY_STARTER 'sandbox'`) | Authoring | Stamp → hold → move; remove then `empty`; re-stamp + ball → `complete`; restart | PASS |
| `proofs/rail-shooter/` | `rail-shooter` | `sw2d.camera` (rail) + look targets + `sw2d.combat` | Reticle fire | Miss with nothing near; kill each target as the rail brings it in (2→1→0) → `cleared`; restart | PASS |
| `proofs/match-puzzle/` | `match-puzzle` | `sw2d.puzzle-rules` match kind (board, swap legality, cascade, objective all content) | Cursor only | Cursor/select; adjacent swap clears to the objective → `solved`; restart; non-adjacent confirm is not a swap | PASS |
| `proofs/falling-block-puzzle/` | `falling-block-puzzle` | `sw2d.puzzle-rules` falling-block kind (gravity, move/rotate/hard-drop, line-clear) | None | Shift + hard-drop parks; next hard-drop clears the line → `solved`; restart (`moves ≤ 1`: a gravity tick is a move) | PASS |
| `proofs/maze-game/` | `maze-game` | `sw2d.navigation` occupancy + `findPath` hint (`NAV_STARTER 'maze'`) | None | Wall step refused; corridor steps shrink the path; exit `escaped`; inert after; restart | PASS |
| `proofs/precision-platformer/` | `precision-platformer` | parkour gap course + `sw2d.wall` (leap) | None | No jump → falls, `failed` (fail line fixed below the platform row); restart; one timed jump → `finished` | PASS |
| `proofs/climbing-game/` | `climbing-game` | parkour ledges + `sw2d.wall` (slide) | None | Walking into the ledge gains no height; two jumps → `summit`; restart | PASS |
| `proofs/auto-runner/` | `auto-runner` | auto-run course over `sw2d.generation` (`RUN_STARTER 'course'`) | None | Runs on its own; pause freezes; no jump → `failed`; restart; timed jump → `finished` | PASS |
| `proofs/traditional-platformer/` | `traditional-platformer` | `bindLevelObjectives` over `sw2d.world` + `sw2d.world-entities` (Checkpoint / Hazard / Collectible / Exit) | None | Jump; walk; checkpoint + coin; spikes reset to checkpoint; pause; jump the spikes → `cleared`; input frozen; restart | PASS |
| `proofs/asteroids-shooter/` | `asteroids-shooter` | `vehicleController` + drag body + `sw2d.weapons` heading-fire | Open space | Turn at rest; thrust moves; drag halves speed; fire spawns/expires; cooldown gates spam; restart | PASS |
| `proofs/endless-driving/` | `endless-driving` | `sw2d.vehicles` car motion as arcade distance (`VEHICLE_STARTER 'road'`) over `sw2d.generation` | None | No throttle no distance; throttle builds; pause freezes; goal → `distance`; restart | PASS |
| `proofs/boat-flight-racer/` | `boat-flight-racer` | `sw2d.vehicles` definition reload boat → flight (`'craft'`) | None | Boat never climbs; PRIMARY → `flight`; climb → `airborne`; restart as boat | PASS |
| `proofs/kart-racer/` | `kart-racer` | `sw2d.racing` countdown/checkpoints on the `sw2d.vehicles` kart profile | Item box + on-demand fire | `empty`; CONFIRM → countdown → racing; pickup on the straight; cp-1 passed; fire; keyboard steering to cp-2; restart | PASS |

## Phase 10 deep proofs

See [`PHASE10_PROOF_HANDOFF.md`](../architecture/PHASE10_PROOF_HANDOFF.md) for the phase-level
narrative (shared-architecture repair, deferred triggers, known limitations) this matrix does not
repeat.

| Proof | Preset | Reusable capabilities exercised | Game-specific mechanics | Browser journey | Lifecycle evidence | Offline evidence | Maturity result | Status |
|---|---|---|---|---|---|---|---|---|
| A - `proofs/chase-platformer/` | `chase-platformer` | `platformController`, `sw2d.world` (checkpoints), `sw2d.world-entities` (Tiled dispatch), `sw2d.combat` (health/damage/invulnerability), `sw2d.arcade` (score), live `content/tuning.json` | Coyote time, jump buffer, double jump (bounded movement policy), content-derived collectible quota, chase pressure frozen during pause and post-respawn spawn-grace, hazard death, checkpoint respawn | Start, move/jump, buffered jump, coyote jump, double jump, collect quota, activate checkpoint, die to hazard, respawn at checkpoint, chase pressure advances during play and freezes during pause/grace, reach exit after quota | Checkpoint/death/restart does not duplicate listeners or entities (per-life state resets cleanly on respawn) | N/A (no network surface) | `proof-validated` | PASS |
| B - `proofs/twin-stick-shooter/` | `twin-stick-shooter` | `topDownController` (independent digital aim, ADR-0016), shared `ProjectilePool`, `sw2d.combat`, `sw2d.world-entities` (`Enemy`-classed Tiled objects), `sw2d.arcade` (score) | Two content-authored enemy waves (wave 2 dormant until wave 1 clears), stationary turret-archetype contact hazards, real closest-in-range targeting, engine-level pause/restart | Start, move+aim simultaneously in different directions, fire, damage/kill two wave-1 enemies (wave completes, wave 2 activates), take contact damage from a wave-2 enemy, pause (state frozen), resume, restart (scene reinstalls) | Projectile counts bounded; `spawnedTotal = liveCount + expiredTotal` at every sample; restart returns a **fresh** `ProjectilePool`'s counters to zero, proving a real scene reinstall, not a reset flag | N/A (no network surface) | `proof-validated` | PASS |
| C - `proofs/tower-defense/` | `tower-defense` | `gridController` (keyboard cursor - spatial pointer stays deferred), `sw2d.progression` (currency), `sw2d.combat`, shared `ProjectilePool` | Fixed route, placement-cell validation, real closest-in-range target selection, **tower upgrade** (`SECONDARY_ACTION` on the tower's own cell, doubles projectile damage) | Start with known currency, move cursor, invalid placement rejected (no spend), valid placement (currency deducted), wave advances automatically, tower damages first enemy (2 hits at base damage), upgrade (currency deducted, damage doubles), second enemy dies in 1 hit at upgraded damage, victory with zero breaches | Route is deterministic (fixed waypoints/spawn timings); currency changes are exact at every step | N/A (no network surface) | `proof-validated` | PASS |
| D - `proofs/sokoban/` | `sokoban` | Real `sw2d.puzzle-rules` (`PuzzleRulesService`) driven by a `sokoban` definition in validated `content/puzzles.json` (capability program Phase 6 / ADR-0023, superseding the earlier `configSource: 'code'` seam) - the **only** board state; `gridController` | None: the push/block/solved rules are the pack engine fed by content, not game code; `packConfig.ts` is `{}`. `CANCEL`→undo, `SECONDARY_ACTION`→reset, read directly off the service | Start, ordinary move, legal push, invalid push (snapshot byte-for-byte unchanged, rejection counted), two more moves, second push (solves), undo (exact prior state restored), reset (exact initial state restored), replay to solve again | No parallel state/undo stack in `shellPack.ts` to leak; `isSolved()` and `boxesOnGoals === goalCount` agree at every sample | N/A (no network surface) | `proof-validated` | PASS |
| E - `proofs/idle-incremental/` | `idle-incremental` | `sw2d.simulation` (resource ledger + job queue), `sw2d.progression` (currency), `SaveStore` (`context.saves`), `uiSimulationController` | Deterministic passive production, one job (`gather`), one upgrade (doubles the rate, load-bearing for subsequent production), versioned save record | Start, two equal-length stepped intervals (equal gold delta, proving determinism), two job cycles (accumulate currency), upgrade (currency deducted, rate doubles, subsequent production measurably faster), save, **real browser reload** (`gotoAndWaitForRuntime` against the same URL, not an in-memory reset), restored state matches saved state, simulation continues after reload | No canvas movement anywhere in the loop; SaveStore round-trips through real storage across the reload, not JS state | Zero external requests (shared `runSmoke`/`runProofs` oracle) | `proof-validated` | PASS |

## Reading this table against the acceptance contract

Every "Browser journey" cell above is the automated sequence the committed
`packages/qa/proof-specs/<name>.ts` file actually drives against a real production build via
system Chrome (`npm run qa:proof`) - not a manual checklist and not inferred from source reading.
Each proof spec asserts against the same `context.debug.contribute(...)` snapshot surface the
shared `readShellState()` helper reads, the same mechanism every Phase 8 smoke spec already used;
none of the five reaches into private state a real player interaction couldn't also observe.

"Maturity result" reflects `packages/presets/src/catalog/*.ts`'s live `maturity` field, mechanically
checked against this claim by `packages/presets/test/honesty.test.ts` (exactly the twenty-three
preset ids with committed proof games in this matrix may claim `proof-validated`; every other
preset is `smoke-validated` or `recipe`, never overstated). `packages/presets/test/proofEvidence.test.ts`
additionally derives the proof set mechanically from the `proofs/` directory itself, so a
proof-validated claim without a committed proof game (or a proof game whose preset id was never
promoted) fails the suite.
