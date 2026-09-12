# Final Product Completion Matrix

Program: eliminate every machine-executable `knownLimitations` entry in the 74-preset catalog
(`packages/presets/src/catalog/*.ts`) by finishing the product, not by rewording.

Companion: [`FINAL_PRODUCT_COMPLETION_STATE.md`](FINAL_PRODUCT_COMPLETION_STATE.md) (durable
per-checkpoint state). Branch `claude/final-product-completion`, worktree
`~/2d_game_factory/final-completion`, created from `origin/main` `0d00d4a7ae8ca482f1c4b2786e9e409961579355`
(PR #8 merge, the last accepted production state - verified identical before branching).

## Inventory method

`knownLimitations` was extracted programmatically from the live catalog (`PRESETS` from
`@sw2d/presets`, every preset, every entry - not the one-per-recipe table in
`docs/presets/PRESET_CATALOG.md`). Result at program start: **69 entries, 52 distinct texts, 64 of 74
presets carry at least one** (`traditional-platformer`, `metroidvania`, `puzzle-platformer`,
`grappling-platformer`, `collectathon-platformer`, `top-down-adventure`, `top-down-racer`,
`time-trial-racer`, `sokoban`, `exploration-game` carry none). The extraction script is
`tools/scripts/extract-limitations.ts` (`npm run limitations:extract`), and it is the final gate.

The secondary sources (`README.md`, `OPERATIONAL_STATE.md`, `WORKBENCH_OPERATIONAL_STATE.md`,
`PROJECT_BIBLE.md`, `progress.md`, `docs/**`) were grepped for equivalent unresolved product
limitations. Two are recorded below as non-catalog rows (`X01` gamepad feasibility, `X02` public
license); the rest are historical phase logs or already-closed items.

Each row: id · exact source text · preset(s) · technical gap · architecture involved · current
behaviour (at start) · required finished behaviour · acceptance journey · checkpoint (wave) ·
proof/test · browser validation · final commit · status.

Status vocabulary: `OPEN`, `IN PROGRESS`, `CLOSED`, or `HUMAN-ONLY` (the two permitted non-code
exceptions: physical hardware certification and the user-owned public-license choice).

---

## A. Platforming

### L01 - chase/pursuit-pressure pack
- **Source text:** "Closing-wall pursuit for the generated starter is game-specific presentation; a reusable chase/pursuit-pressure pack is not."
- **Presets:** `chase-platformer`
- **Gap:** pursuit pressure (a closing wall / pursuer that advances, catches, resets) exists only as `bindStarterChase` game-support code with no content authoring and no second consumer.
- **Architecture:** new reusable `sw2d.pursuit` pack (`movement.pursuit`), `content/pursuit.json` (schema), `bindStarterChase` rewritten on the service, platform shell.
- **Current:** closing wall hard-coded in `starterChase.ts`.
- **Required:** authorable pursuer (speed, acceleration, catch radius, escape line) reused by chase-platformer, endless-runner and auto-runner.
- **Journey:** start → wall advances → run right → escape line → `complete/escaped`; restart; stand still → `failed/caught`.
- **Checkpoint:** Wave 1.
- **Closed by:** `sw2d.pursuit` (`movement.pursuit`, `packages/packs/src/pursuit/pursuitPack.ts`), `content/pursuit.json` (`pursuit-catalog` schema), `bindStarterChase` rebuilt on the service. **Proof/test:** `packages/packs/test/pursuit.test.ts`, `packages/cli/test/generate.test.ts` (Wave 1 block), proof spec `chasePlatformer` (hand-authored proof unchanged) + completion spec `completion-specs/chasePlatformer.ts`. **Browser:** `npm run qa:completion -- chase-platformer` PASS (stand still → `caught`; restart; run → `escaped` at x ≥ 820).
- **Status:** CLOSED (Wave 1).

### L02 - runner pressure / climbing
- **Source text:** "Auto-run and the starter gap for the generated starter are game-specific presentation; a reusable climbing or chase-pressure system is not."
- **Presets:** `endless-runner`, `auto-runner`
- **Gap:** runners have no defining pressure loop (nothing closes on the player); climbing is `sw2d.wall` (already reusable, not consumed here).
- **Architecture:** `sw2d.pursuit` (L01) consumed by `bindStarterRun`; runner catalog adds a pursuer.
- **Required:** a pursuer trails the runner; a missed jump (fall/stumble) lets it close; caught = `failed`; distance/course completion unchanged.
- **Journey:** start → pursuer trails at fixed gap → miss a jump → pursuer closes → caught → restart → clear course.
- **Checkpoint:** Wave 1.
- **Closed by:** `sw2d.pursuit` chaser + authored stumble blocks in `bindStarterRun`; catalog requires `sw2d.pursuit` for both runners. **Proof/test:** `pursuit.test.ts` (chaser close/recover/catch), generate tests; proof spec `autoRunner` (canonical proof refreshed) + completion specs `endlessRunner` / `autoRunner`. **Browser:** `qa:completion -- endless-runner auto-runner` PASS (trip twice → `caught`; restart; clean run → `survived` / `escaped`), `qa:proof -- auto-runner endless-runner` PASS.
- **Status:** CLOSED (Wave 1).

### L03 - ledge grab / parkour grammar
- **Source text:** "Wall-slide and wall-jump contact are reusable (sw2d.wall); ledge-grab and a full parkour grammar are not."
- **Presets:** `precision-platformer`, `climbing-game`
- **Gap:** no ledge grab, climb-up, drop, or state transitions between slide/jump/ledge/grapple.
- **Architecture:** `sw2d.wall` (`movement.wall`) extended with ledges + a movement state machine (`grounded/airborne/sliding/ledge-hang/climbing`), `content/wall.json` ledges, platform shell consumes states.
- **Required:** hanging on authored ledges, UP climbs, DOWN drops, JUMP from hang; transitions logged; disposal resets.
- **Journey:** jump at a ledge → `ledge-hang` → UP → `climbed` on top → DOWN from next ledge → `dropped`; wall-slide → wall-jump still works.
- **Checkpoint:** Wave 1.
- **Closed by:** `sw2d.wall` ledge grammar (`ledges`, `state()`, `pinned()`, `climb()`, `drop()`, `release()`, `ledgeStats()`), `content/wall.json` ledges for both presets, platform shell pins the body while hanging/climbing (body disabled) and hands it back to Arcade on climb/drop/hang-jump. Also fixed: Wave 30's inverted slide/kick direction (slid while pushing away, kicked into the wall). **Proof/test:** `wall.test.ts` ledge block, generate tests, proof specs `precisionPlatformer` / `climbingGame` (canonical proofs refreshed, contracts updated). **Browser:** `qa:completion -- precision-platformer climbing-game` PASS and `qa:proof` PASS (grab → stable hang → DOWN drops/fails; grab → UP climbs → finish; slide on cliff → wall-jump → summit-ledge grab → climb → summit; hang-jump → regrab).
- **Status:** CLOSED (Wave 1).

## B. Melee / top-down combat

### L04 - combo strings, directional attacks, targeting UI
- **Source text:** "Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not."
- **Presets:** `action-adventure`, `arena-combat`
- **Architecture:** `sw2d.melee` extended (combo chain, combo window/reset, directional arc, interruption), `content/melee.json` combos, `bindStarterMelee` target affordance HUD.
- **Required:** 3-hit combo with windows; direction from facing; hit-stun interrupts; nearest-target reticle; instructions on HUD.
- **Journey:** strike ×3 inside window → `combo 3`; wait → combo resets; strike facing away → miss; face target → hit + knockback; clear arena → `complete`.
- **Checkpoint:** Wave 2.
- **Closed by:** `sw2d.melee` combo chain (`content/melee.json` `combo.steps` / `windowMs`), facing arc (`arcDeg`, `setFacing`), foe pursuit (`speed`), player hit-stun (`contact.stunMs`), `target()`; `bindStarterMelee` draws the arc, the reticle and the combo counter; the top-down shell feeds facing. **Proof/test:** `melee.test.ts` (Wave 2 block), generate tests, proof specs `actionAdventure` / `arenaCombat` (canonical proofs refreshed, contracts updated). **Browser:** `qa:completion` + `qa:proof` PASS.
- **Status:** CLOSED (Wave 2).

### L05 - twin-stick ships no opposition
- **Source text:** "The generated starter ships no enemy waves out of the box: sw2d.encounters is optional for this recipe, so opposition is added by enabling that pack or authoring game-specific spawns (the committed proof game demonstrates the latter)."
- **Presets:** `twin-stick-shooter`
- **Architecture:** catalog (encounters required), generator (encounter catalog), top-down shell already binds `bindStarterEncounters`.
- **Journey:** start → enemies spawn and chase → fire → kill → wave clear → `complete`; die → respawn.
- **Checkpoint:** Wave 2.
- **Closed by:** `sw2d.encounters` required for twin-stick-shooter; the canonical starter fights `content/encounters.json` waves through `bindStarterEncounters`. Wave-2 shooters now actually fire (same group-index parse repair as L16). **Proof/test:** generate/uiCopy tests; completion spec `twinStickShooter` (pointer-aim kiting: kills, wave 1 → wave 2, restart). **Browser:** `qa:completion -- twin-stick-shooter` PASS; hand-authored proof still PASS.
- **Status:** CLOSED (Wave 2).

### L06 - survivor escalation / meta progression
- **Source text:** "In-run XP and unlock flags for the generated starter use sw2d.progression; endless difficulty scaling / meta-progression between runs is not a reusable system; the starter survival loop repeats the authored encounter without escalating it."
- **Presets:** `survivor-like`
- **Architecture:** `sw2d.encounters` escalation rules (per-wave scaling of count/health/speed), new `sw2d.runs` pack (`progression.runs`: run lifecycle, permadeath, persistent meta unlocks, between-run loadout), `bindStarterProgression` survive mode.
- **Journey:** wave 1 → wave 2 larger → die → run ends, meta XP saved → reload → new run starts with unlock applied.
- **Checkpoint:** Wave 2.
- **Closed by:** `sw2d.encounters` escalation (`escalation.countPerWave/healthScalePerWave/speedScalePerWave/maxWaves`, `start(id, { wave })`, `speedScale()`), new reusable `sw2d.runs` pack (`progression.runs`: run lifecycle, permadeath, banked meta via `context.saves`, unlocks, loadout, corrupt/old-record fallback), `bindStarterEncounters` (`respawn: false`, loadout, escalation waves), `bindStarterProgression` survive mode run lifecycle + K buys. **Proof/test:** `runs.test.ts`, `encounters.test.ts` escalation block, proof spec `survivorLike` (escalated wave 1 with faster enemies → death → bank → buy → run 2 with 140 max health). **Browser:** PASS.
- **Status:** CLOSED (Wave 2).

### L07 - dungeon enemies from room graph + AI
- **Source text:** "Contact damage and strike for the generated starter use sw2d.combat; generated Enemy objects from the room graph and AI behaviour are not wired."
- **Presets:** `dungeon-crawler`
- **Architecture:** `bindStarterCombat` room mode consumes `sw2d.generation` room graph + `sw2d.ai` state agents (idle/chase/attack/return), room transitions, room-clear, reset.
- **Journey:** enter room → enemies chase → strike → room cleared → move to next room → new enemies → all rooms cleared → `complete`; die → restart resets.
- **Checkpoint:** Wave 2.
- **Closed by:** `bindStarterDungeon` (`packages/runtime/src/game-support/starterDungeon.ts`): room-graph `Enemy` objects become `sw2d.ai` agents (idle → chase → patrol/return → idle), `sw2d.combat` health, strikes with knockback/stun, room tracking and clearing, exit gate, camera follow, world bounds; `sw2d.ai` required; `DUNGEON_STARTER 'crawl'`. **Proof/test:** generate tests; completion spec `dungeonCrawler` with the shared `dungeonJourney` navigation (chase → leash return → clear every room → exit → restart). **Browser:** PASS.
- **Status:** CLOSED (Wave 2).

### L08 - roguelite permadeath / between-run loadouts
- **Source text:** "In-run currency, XP, items and unlock flags for the generated starter use sw2d.progression; run-based permadeath and between-run loadouts are not a reusable capability."
- **Presets:** `action-roguelite`
- **Architecture:** `sw2d.runs` (shared with L06), `content/runs.json`, `bindStarterProgression` run mode.
- **Journey:** run → collect relic/currency → die → run ends, currency banked, unlock bought → new run starts with loadout.
- **Checkpoint:** Wave 2.
- **Closed by:** `sw2d.runs` (see L06) consumed by `bindStarterDungeon` rogue mode: cleared rooms drop coin, exit clears the run (+clear bonus), death ends it, K buys, run 2 starts with the loadout. **Proof/test:** proof spec `actionRoguelite` (canonical proof refreshed, contract updated). **Browser:** PASS.
- **Status:** CLOSED (Wave 2).

### L09 - stealth AI: patrol, investigate, chase, takedown
- **Source text:** "Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not."
- **Presets:** `stealth-game`, `heist-game`
- **Architecture:** `sw2d.perception` extended: patrol waypoints, observer state machine (`patrol/suspicious/investigate/chase/return`), noise reaction, takedown from behind, optional `sw2d.navigation` grid routing; `content/perception.json`; `bindStarterPerception`.
- **Journey:** guard patrols → sees player → `chase` → player hides → guard `investigate` → loses target → `return` → `patrol`; sneak behind → takedown; loot → exit.
- **Checkpoint:** Wave 2.
- **Closed by:** `sw2d.perception` observer state machine (`patrol / suspicious / chase / investigate / return / downed`), authored patrol routes (`observers[].patrol`), chase/catch, memory, investigation of last known position and of loot noise, return to route, `takedown()`; `bindStarterPerception` draws moving observers with state colours and J takes down; heist alarm sticky, infiltrate alarm live. Consumers: stealth-game, heist-game. **Proof/test:** `perception.test.ts` (Wave 2 block), generate tests, proof specs `stealthGame` (patrol → chase → caught; restart; chase → lost → investigate → return → patrol; takedown; loot; exit) / `heistGame`. **Browser:** PASS.
- **Status:** CLOSED (Wave 2).

### L10 - boss sequencing
- **Source text:** "Sequencing multiple bosses across a run is starter-specific; sw2d.encounters drives one boss encounter at a time."
- **Presets:** `boss-rush`
- **Architecture:** `sw2d.encounters` sequence (ordered encounter list, transitions, per-boss state, final completion), `bindStarterEncounters`.
- **Journey:** boss 1 → defeated → transition banner → boss 2 → defeated → boss 3 → `complete`; restart resets to boss 1.
- **Checkpoint:** Wave 3.
- **Closed by:** `EncounterCatalog.sequence` (ordered encounter ids + `transitionMs`) run back to back by `bindStarterEncounters` (per-boss state, transition banner, boss health on the HUD, final completion, restart); boss-rush content authors three bosses with distinct patterns. **Proof/test:** `encounters.test.ts` (sequence exposure), generate tests; completion spec `bossRush`. **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

## C. Shooters

### L11 - shmup rail cameras, parallax, bullet pooling
- **Source text:** "Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not."
- **Presets:** `horizontal-shmup`, `vertical-shmup`
- **Architecture:** `sw2d.stage-scroll` gets parallax layers, waypoint rail paths and enemy formations authored in `content/stage-scroll.json`; projectile runtime pooled (L12).
- **Journey:** stage scrolls with parallax layers at different speeds → formation spawns → rail waypoint changes scroll direction → stage clear.
- **Checkpoint:** Wave 3.
- **Closed by:** `sw2d.stage-scroll` `layers` (parallax planes at their own speed factors, drawn by `bindStarterStageScroll`) and `rail` (speed / cross-drift legs - a 2D rail path the hazards and layers follow through `crossOffset()`); enemy formations via `sw2d.encounters` `formation` spawn points with `drift` archetypes that sweep the stage. **Proof/test:** stage-scroll + encounters unit tests, generate tests, proof specs `horizontalShmup` / `verticalShmup` (parallax ordering, rail legs 120 → 220 px/s, cross offset, formation escape). **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L12 - bullet-hell pooling / budget
- **Source text:** "Per-bullet GPU-scale pooling for thousands of simultaneous bullets is not tuned; patterns are bounded."
- **Presets:** `bullet-hell`
- **Architecture:** pooled projectile runtime (`ProjectilePool` in every encounter/weapon consumer), benchmark in `qa:performance`, documented simultaneous-projectile budget.
- **Journey:** dense pattern → measured live projectile count ≥ budget at ≥ 55 fps stepped, zero errors, pool reuse proven.
- **Checkpoint:** Wave 3 / Wave 11.
- **Closed by:** pooled `createProjectileRuntime` (parked sprites with persistent colliders reused by the next spawn; pool stats exposed), bullet-hell content with ring / spiral / fan emitters (400+ live bullets), `npm run qa:bullet-budget` benchmark (canonical game, real rAF). Independent re-measure after densifying the opening pattern (the inherited Wave 3 content peaked at 342 live and failed the gate): **peak 555 live at 60.1 fps mean, p95 16.7 ms, pool reuse 80.8 %** on Chrome 152 / macOS arm64. Supported budget documented in `docs/qa/QA_MATRIX.md`: 400 simultaneous projectiles at 60 fps on desktop Chrome. Also fixed: `entity-health-below` completed a phase before its boss spawned. **Proof/test:** encounters test, completion spec `bulletHell` (≥300 live, pool reuse, frenzy phase, restart). **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L13 - asteroids rock field / wrap / splitting
- **Source text:** "Drifting rock fields and wrap-around collision stay game-specific; the generated starter steers and fires along heading through sw2d.weapons."
- **Presets:** `asteroids-shooter`
- **Architecture:** `sw2d.vehicles` `ship` profile (thrust + rotational inertia + wrap), `bindStarterAsteroids` (rock field, drift, wrap, split, score, lives, waves) on `sw2d.combat`/`sw2d.weapons`/`sw2d.arcade`.
- **Journey:** rocks drift and wrap → shoot → rock splits → all cleared → next wave larger → collide → lose life → 0 lives `failed` → restart.
- **Checkpoint:** Wave 3.
- **Closed by:** `bindStarterAsteroids` on the vehicle shell (drifting + wrapping rock field, pooled projectile vs rock collision through `sw2d.weapons`/`sw2d.combat`, large → medium → small splitting, `sw2d.arcade` score, ship-vs-rock lives with a grace window, growing waves, fail / restart HUD); asteroids-shooter requires `sw2d.vehicles` + `sw2d.arcade`. **Proof/test:** generate tests; proof spec `asteroidsShooter` (canonical proof refreshed, contract updated). **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L14 - asteroids rotational inertia
- **Source text:** "vehicleController supplies arcade steering/throttle intent only, not rotational-inertia physics."
- **Presets:** `asteroids-shooter`
- **Architecture:** `sw2d.vehicles` `ship` profile (angular acceleration/damping, momentum), `content/vehicles.json`.
- **Journey:** tap turn → heading keeps rotating and damps; thrust → velocity persists after release.
- **Checkpoint:** Wave 3.
- **Closed by:** `sw2d.vehicles` `ship` profile (`angularAcceleration`, `angularDamping`, momentum, `wrap`; `angularVelocity` / `wraps` in `VehicleState`), `vehicleProfile: 'ship'` in the catalog. **Proof/test:** proof spec `asteroidsShooter` (tap → keeps spinning → settles; thrust → coasts; wraps). **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L15 - gallery target waves in generated starter
- **Source text:** "Authored gallery target waves and projectile-vs-target scoring stay in the frozen proof; the generated starter fires toward the cursor through sw2d.weapons."
- **Presets:** `gallery-shooter`
- **Architecture:** `sw2d.encounters` (required) target waves with movement patterns + `sw2d.arcade` scoring, pointer shell binds a gallery runtime (pointer fire, hit/miss, timer, success/failure, restart).
- **Journey:** targets appear/move → click hits → score → miss counted → wave cleared → `complete`; timer out → `failed`.
- **Checkpoint:** Wave 3.
- **Closed by:** `bindStarterGallery` (gallery mode) on the pointer shell: `sw2d.encounters` rounds (`sequence`) of `drift` targets in `formation`s, pointer-aimed `sw2d.weapons` fire, hit / miss accuracy, `sw2d.arcade` score, 45 s time limit, complete / failed, restart; gallery-shooter requires encounters + arcade. Also fixed: `SpatialPointerHost` never marked the pointer inside without a `pointerenter` (a resting mouse could not aim). **Proof/test:** generate tests; completion spec `galleryShooter`. **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L16 - run-and-gun opposition
- **Source text:** "Enemy encounter orchestration (sw2d.encounters, Phase 4, ADR-0021) is reusable now, but this recipe does not install it - its enemy waves/patterns would be authored as game-specific code or by adding that pack."
- **Presets:** `run-and-gun`
- **Architecture:** catalog (encounters required), platform shell binds `bindStarterEncounters` (gravity-aware enemies).
- **Journey:** run right → enemies spawn/shoot → fire → kill → wave clear → `complete`.
- **Checkpoint:** Wave 3.
- **Closed by:** run-and-gun requires `sw2d.encounters`; the platform shell binds `bindStarterEncounters` with the ground group and gravity; `ground` archetype walkers walk the strip, a `hold` shooter fires. Independent audit found entity-carried emitters on spawn group ≥ 1 never fired (`requestId` parsed the member index as the group). Fixed in the Wave 1-3 sanity repair; completion spec now requires a live `shooter` and enemy `projectilesSpawned` in wave 2. **Proof/test:** generate tests; `encounters.test.ts` group-1 origin fire; completion spec `runAndGun`. **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

### L17 - rail-shooter weapons
- **Source text:** "Fixed-path/rail camera movement is reusable (sw2d.camera); this starter still does not wire sw2d.weapons."
- **Presets:** `rail-shooter`
- **Architecture:** catalog (weapons + encounters required), `bindStarterLook` rail mode fires catalog weapon through the projectile runtime at encounter targets; scoring; progression; completion/failure.
- **Journey:** rail moves → targets spawn → click fires weapon → projectile hits → score → path end `complete`.
- **Checkpoint:** Wave 3.
- **Closed by:** rail-shooter requires `sw2d.weapons` + `sw2d.encounters` + `sw2d.arcade`; `bindStarterGallery` rail mode rides the `sw2d.camera` rail (camera bounds released - the Wave 26 rail never actually scrolled), fires the catalog weapon at `approach` drones, scores, completes both legs. **Proof/test:** proof spec `railShooter` (canonical proof refreshed, contract updated). **Browser:** PASS.
- **Status:** CLOSED (Wave 3).

## D. Vehicles

### L18 - kart held item / fire
- **Source text:** "Holding and firing a kart item on demand (a shell, an on-use boost pickup) is game-specific code; item boxes grant canonical sw2d.items entries (Phase 2), and drift / handling are the reusable sw2d.vehicles kart profile."
- **Presets:** `kart-racer`
- **Architecture:** `sw2d.items` held-item slot (`hold/useHeld`, use effects: `boost`, `projectile`), `bindStarterHeldItem` (item boxes, HUD, respawn), vehicle shell; second consumer endless-driving (L19).
- **Journey:** drive through box → item held (HUD) → press use → effect (shell fired / boost) → consumed → box respawns → race still completes.
- **Checkpoint:** Wave 4.
- **Closed by:** `sw2d.items` `hold`/`useHeld` plus `vehicle.boost` effect; kart-racer requires `sw2d.items`; `content/items.json` ships `kart-shell` / `kart-boost`; `bindStarterKartItem` grants/holds on box overlap, PRIMARY consumes, fires a heading shell, respawns two boxes. Racing still owns finish. **Proof/test:** `items.test.ts` held-slot, `vehicles.test.ts` `triggerBoost`, generate tests, proof spec `kartRacer` (empty fire, pickup, consume, reacquire, race, restart). **Browser:** `qa:completion -- kart-racer` PASS; `qa:proof -- kart-racer` PASS.
- **Status:** CLOSED (Wave 4).

### L19 - endless-driving item system / loop
- **Source text:** "Arcade distance for the generated starter is game-specific presentation of sw2d.vehicles + sw2d.arcade; a reusable kart item-fire system is not."
- **Presets:** `endless-driving`
- **Architecture:** held-item capability (L18) + `bindStarterVehicle` road mode: traffic hazards, item boxes, boost use, crash → `failed`, best distance persisted.
- **Journey:** drive → pick boost → use → distance climbs faster → hit traffic → `failed` → restart → best distance kept.
- **Checkpoint:** Wave 4.
- **Closed by:** endless-driving requires `sw2d.items`; same `hold`/`useHeld` loop with `kart-boost`; road binder adds a traffic hazard, off-road crash, and persisted best distance. **Proof/test:** proof spec `endlessDriving` (pickup, boost, distance, persist best, crash). **Browser:** `qa:completion -- endless-driving` PASS; `qa:proof -- endless-driving` PASS.
- **Status:** CLOSED (Wave 4).

### L20 - boat/flight arcade scope
- **Source text:** "The boat and flight profiles are bounded arcade handling (momentum, drag, lateral grip, and for flight a 2D altitude band) - not fluid or aerodynamic simulation."
- **Presets:** `boat-flight-racer`
- **Architecture:** `bindStarterVehicle` craft mode finished: throttle/drag/turning/altitude/banking visual, buoys/hazards, checkpoints via `sw2d.racing` (required), race completion; the product never promised fluid/aero simulation.
- **Journey:** boat → checkpoints → switch to flight → altitude band + bank → hazard → finish → `complete`.
- **Checkpoint:** Wave 4.
- **Closed by:** racing required; auto-start race; buoy hazard fail; bank visual from lateral speed; boat→flight switch; airborne complete. **Browser:** `qa:completion -- boat-flight-racer` PASS; `qa:proof` PASS.
- **Status:** CLOSED (Wave 4).

## E. Puzzle / arcade

### L21 - puzzle board interaction (pointer swap, wall kicks)
- **Source text:** "Match-detection/cascade and falling-piece/line-clear are reusable (sw2d.puzzle-rules); pointer drag-swap, wall-kicks and overlay-local boards are not."
- **Presets:** `match-puzzle`, `falling-block-puzzle`
- **Architecture:** `sw2d.puzzle-rules` falling-block wall kicks + hard drop + progression/loss; `bindStarterPuzzle` pointer swap via spatial pointer, objective, completion/failure, restart.
- **Journey (match):** drag-swap two tiles → match → cascade → refill → objective reached → `complete`. **(falling):** rotate against wall → kicked → hard drop → line clear → level up → stack out → `failed` → restart.
- **Checkpoint:** Wave 4.
- **Closed by:** falling-block rotate tries kick offsets; match binder maps spatial-pointer drag to the existing `swap` op; keyboard paths kept. One board authority (`sw2d.puzzle-rules`). **Proof/test:** `puzzleRules.test.ts` wall-kick; proof specs `matchPuzzle` (keyboard + pointer drag) / `fallingBlockPuzzle`. **Browser:** `qa:completion -- match-puzzle falling-block-puzzle` PASS; `qa:proof` PASS.
- **Status:** CLOSED (Wave 4).

### L22 - match puzzle does not consume spatial pointer
- **Source text:** "The reusable spatial pointer (world cursor, hover, drag - ADR-0018) exists; this grid-family recipe does not consume it, so tile drag/swap interaction is game-specific code."
- **Presets:** `match-puzzle`
- **Architecture:** grid shell + `bindStarterPuzzle` use `context.spatialPointer` for hover/drag-swap (L21).
- **Checkpoint:** Wave 4.
- **Closed by:** L21 pointer drag-swap. **Browser:** PASS.
- **Status:** CLOSED (Wave 4).

### L23 - ball/paddle vs pinball
- **Source text:** "Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not."
- **Presets:** `breakout`, `pong`
- **Gap:** the sentence records that breakout/pong do not ship a pinball table; the pinball table is `sw2d.pinball` (L28). Closed when `sw2d.pinball` is a complete table (launch, flippers, bumpers, drain, balls, game-over) so the statement is no longer a product gap.
- **Checkpoint:** Wave 4.
- **Closed by:** L28. Breakout/pong no longer declare a missing pinball table.
- **Status:** CLOSED (Wave 4).

### L24 - local-play seats / gamepads / netcode / split-screen
- **Source text:** "Local hot-seat turns and simultaneous versus axes are reusable (sw2d.local-play); netcode, gamepads, split-screen cameras and more than two seats are not."
- **Presets:** `pong`, `local-party-game`
- **Architecture:** `GamepadAdapter` (runtime input, synthetic Gamepad API tests, connect/disconnect, multiple pads, per-seat routing), `sw2d.local-play` up to 4 seats with device assignment, split-screen cameras for local-party-game, optional `sw2d.netplay` (BroadcastChannel + WebRTC manual-signal transports, host-authoritative input relay, connect/disconnect, journey with two browser pages).
- **Journey:** 4 seats join (keyboard + 2 synthetic pads) → simultaneous input → pad disconnects → seat parked → reconnect; netplay: page A hosts, page B joins → inputs mirrored → B disconnects → A continues.
- **Checkpoint:** Wave 9.

### L25 - physics-puzzle / escape-room code seam
- **Source text:** "Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content."
- **Presets:** `physics-puzzle`, `escape-room`
- **Architecture:** `sw2d.puzzle-rules` `physics-goal` (zones, launch limit, `report-entity` / `launch`) and `escape` (interactables, flag gates, `inspect`) kinds; both presets require `sw2d.puzzle-rules`; generator writes `content/puzzles.json`; no TypeScript placeholder.
- **Journey (physics):** launch ball → lands in goal zone → `solved`; launches exhausted → `failed`. **(escape):** inspect note → take key → unlock door → `escaped`.
- **Checkpoint:** Wave 4.
- **Closed by:** pointer shell consumes `PuzzleRulesService`; physics-puzzle / escape-room drop `sw2d.puzzle` code seam. **Proof/test:** `puzzleRules.test.ts` physics-goal + escape; generate tests; proof specs `physicsPuzzle` / `escapeRoom`. **Browser:** `qa:completion -- physics-puzzle escape-room` PASS; `qa:proof` PASS.
- **Status:** CLOSED (Wave 4).

### L26 - maze fog / minimap / generation
- **Source text:** "Grid pathfinding and walkable occupancy are reusable (sw2d.navigation); fog-of-war, minimap and authored maze generation are not."
- **Presets:** `maze-game`
- **Architecture:** `sw2d.generation` `maze` kind (seeded perfect maze), `bindStarterNavigation` maze mode: fog-of-war reveal, minimap overlay, entrance/exit, completion, regenerate (new seed) on restart.
- **Journey:** fog hides maze → walk reveals → minimap grows → exit → `complete` → restart regenerates.
- **Checkpoint:** Wave 4.
- **Closed by:** `generateMazeLayout` recursive backtracker; maze-game requires `sw2d.generation`; fog reveals walked cells; minimap of revealed walkable cells; exit reachable. **Proof/test:** proof spec `mazeGame` (generation installed, path exists, wall reject, walk to exit, fog grows, restart). **Browser:** PASS.
- **Status:** CLOSED (Wave 4).

### L27 - rhythm audio clock / reaction timing
- **Source text:** "Visual reaction cues and beat windows are reusable (sw2d.timing); a deterministic music-beat/audio-synchronization system is not."
- **Presets:** `rhythm-action`, `reaction-timing`
- **Architecture:** `AudioBus` transport (Web Audio clock: `now/pauseClock/resumeClock/scheduleTone`, latency offset, suspend/visibility handling), `sw2d.timing` rhythm mode samples that transport (early/perfect/late/miss); reaction mode stays a visual delay cue with false-start, timeout, rounds and pause freeze.
- **Journey (rhythm):** track starts → beats scheduled on audio clock → hit on beat `perfect` → pause → resume → beat phase preserved → restart. **(reaction):** wait → early press `false-start` → cue → press → reaction ms scored → next round.
- **Checkpoint:** Wave 4.
- **Closed by:** `WebAudioBus.now()` is AudioContext.currentTime; pause/visibility suspend the clock; rhythm judges from audio time; reaction keeps deltaMs. **Proof/test:** `timing.test.ts` audio transport + pause; proof specs `rhythmAction` / `reactionTiming`. **Browser:** `qa:completion -- rhythm-action reaction-timing` PASS; `qa:proof` PASS.
- **Status:** CLOSED (Wave 4).

### L28 - pinball table completeness
- **Source text:** "Flippers, bumpers and bumper-score are reusable (sw2d.pinball); Matter presentation stays on physics-toy."
- **Presets:** `pinball-lite`
- **Architecture:** `sw2d.pinball` completed (launch/plunger, drain, balls/lives, multi-bumper score, game-over, reset) and `bindStarterPhysics` table mode presents it on Matter.
- **Journey:** launch → bumper hits score → drain → ball 2 → … → balls 0 `game-over` → restart.
- **Checkpoint:** Wave 4.
- **Closed by:** `PinballCatalog.balls`, drain consumes a ball, 0 → `failed/game-over`, `launch()` plunger, HUD balls. **Proof/test:** `pinball.test.ts`, `pinballTable.test.ts`, proof spec `pinballLite` (hands-off drain consumes a life, flips still win). **Browser:** PASS.
- **Status:** CLOSED (Wave 4).

## F. Strategy / defense

### L29 - tower-defense pointer placement
- **Source text:** "Spatial hover placement via the pointer shell is available but this starter uses the keyboard grid cursor."
- **Presets:** `tower-defense`
- **Architecture:** `bindStarterTargeting` tower mode: spatial pointer hover preview, click placement, validation, cost, keyboard cursor kept.
- **Journey:** hover cell → preview → click → tower placed, cost paid → invalid cell refused → waves → victory.
- **Checkpoint:** Wave 5.
- **Closed by:** `sw2d.targeting` slots/placeCost; pointer click + keyboard confirm place; miss-click rejected. **Proof/test:** `targeting.test.ts` place; completion spec `towerDefense`. **Browser:** `qa:completion -- tower-defense` PASS; frozen `qa:proof -- tower-defense` PASS.
- **Status:** CLOSED (Wave 5).

### L30 - tower upgrade rules
- **Source text:** "Deterministic route-following pathfinding is reusable (sw2d.navigation); tower target-selection is reusable (sw2d.targeting); upgrade rules stay starter-specific."
- **Presets:** `tower-defense`
- **Architecture:** `content/targeting.json` upgrade tiers (cost, range, damage) consumed by `sw2d.targeting`; click an owned tower to upgrade.
- **Checkpoint:** Wave 5.
- **Closed by:** authored `upgrades` tiers; click/K upgrades owned pad. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

### L31 - lane-defense scheduling / combat
- **Source text:** "Lane-spawn scheduling and combat resolution are still starter-specific."
- **Presets:** `lane-defense`
- **Architecture:** `sw2d.encounters` lane-scheduled waves + `sw2d.combat` resolution (both required), `bindStarterNavigation` lane mode consumes them; unit placement, waves, victory/failure.
- **Journey:** schedule spawns per lane → place defender → combat resolves → wave cleared → all waves → `victory`; enemy reaches base → `failed`.
- **Checkpoint:** Wave 5.
- **Closed by:** lane-defense requires encounters+combat; runners spawn from `starter-lane`; pads damage; base HP; victory/fail. **Browser:** `qa:completion -- lane-defense` PASS; frozen proof PASS.
- **Status:** CLOSED (Wave 5).

### L32 - auto-battler lineup is presentation only
- **Source text:** "Teams, active turn, selection and turn advance are reusable (sw2d.strategy); autonomous strikes are reusable (sw2d.targeting); the lineup pick is presentation (it does not change the fighting actor) and loadout drafting stays starter-specific."
- **Presets:** `auto-battler`
- **Architecture:** `content/targeting.json` roster; `bindStarterStrategy` battler mode: draft changes the actual fighters/stats; rounds; win/loss; restart.
- **Journey:** draft tank vs archer → different fighters → autonomous rounds → outcome differs by draft → restart.
- **Checkpoint:** Wave 5.
- **Closed by:** `TargetingService.setLineup`; FOX vs BEAR actually fight. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

### L33 - RTS box select / command queue
- **Source text:** "Unit pathfinding is reusable (sw2d.navigation, optional); box-select for the generated starter is a two-unit presentation on the spatial pointer; a command-queue UI is not implemented."
- **Presets:** `simple-rts`
- **Architecture:** `bindStarterCommand` rts mode: N-unit box selection, queued move commands (shift-queue), grid pathfinding via `sw2d.navigation` (required), dead-unit selection cleanup, objective.
- **Journey:** box-select 3 units → click → queue 2 waypoints → units path around walls → capture zone → `complete`; unit dies → selection drops it.
- **Checkpoint:** Wave 5.
- **Closed by:** 3 units, box-select, click-queue, hazard death drops selection. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

### L34 - tactics turn-action state machine
- **Source text:** "Teams, active turn, selection and turn advance are reusable (sw2d.strategy); attack-range is reusable (sw2d.targeting); a full turn-action state machine is still starter-specific."
- **Presets:** `turn-based-tactics`
- **Architecture:** `sw2d.strategy` turn-action machine (`select-unit → choose move/attack → legal targets → execute → consume action → next unit → enemy side → victory/failure`), enemy AI turn, restart.
- **Checkpoint:** Wave 5.
- **Closed by:** select/move/spend/attack/end-turn/cpu strike; invalid/dead/out-of-range. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

### L35 - base-defense waves / priority / upgrades
- **Source text:** "Base HP and incoming contact for the generated starter use sw2d.combat; wave spawning is optional (sw2d.encounters); target-priority and upgrade rules stay starter-specific."
- **Presets:** `base-defense`
- **Architecture:** encounters required; `sw2d.targeting` priority (nearest-to-base / lowest-hp); upgrade with resource cost via `sw2d.progression`; base failure; victory; restart.
- **Checkpoint:** Wave 5.
- **Closed by:** hold upgrades (K), priority cycle, encounter wave 2, base HP. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

### L36 - territory scoring overlays / multi-faction
- **Source text:** "Capture-zone occupancy is reusable (sw2d.territory); scoring overlays and contested multi-faction capture stay starter-specific."
- **Presets:** `territory-control`
- **Architecture:** `sw2d.territory` multi-faction contested capture progress + score + victory threshold; overlay in `bindStarterCommand` zone mode; reset.
- **Checkpoint:** Wave 5.
- **Closed by:** factions player/red, contested decay, score, victoryScore. **Browser:** PASS.
- **Status:** CLOSED (Wave 5).

## G. Simulation / economy

### L37 - idle offline / prestige / large numbers
- **Source text:** "The simulation/resource core exists, but full offline-progress/catch-up, prestige, and large economy balancing are not production systems."
- **Presets:** `idle-incremental`
- **Architecture:** `sw2d.simulation` persistence, bounded offline catch-up, wall-clock reconciliation with discontinuity defence, big-number formatting, prestige; reused by shopkeeper/tycoon/restaurant (L38).
- **Journey:** earn → reload → offline gain (capped) → prestige → reset with multiplier.
- **Checkpoint:** Wave 6.
- **Closed by:** catalog production, gather/upgrade, prestige, bounded catch-up, `formatAmount`. **Browser:** PASS.
- **Status:** CLOSED (Wave 6).

### L38 - economy layout / walking customers / prestige / offline
- **Source text:** "Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not."
- **Presets:** `shopkeeper`, `tycoon-lite`, `restaurant`
- **Architecture:** `sw2d.economy` layout (counter, queue slots, seats) + walking customer agents; prestige/offline via `sw2d.simulation`; tycoon investments/unlocks; restaurant seating/serving/leaving.
- **Checkpoint:** Wave 6.
- **Closed by:** authored layout, walking customers, seats, simulation prestige multiplier. **Browser:** PASS.
- **Status:** CLOSED (Wave 6).

### L39 - farming plots
- **Source text:** "Resource ledger and timed jobs are reusable (sw2d.simulation); crop growth and season rotation for the generated starter are presentation of those jobs; a plot-framework pack is not."
- **Presets:** `farming-lite`
- **Architecture:** `bindStarterSimulation` farm mode finished on content-authored crops (`content/simulation.json`): plots, plant, water, growth, seasons, harvest, inventory, regrow, persistence.
- **Checkpoint:** Wave 6.
- **Closed by:** catalog plots, water, seasons, harvest target. **Browser:** PASS.
- **Status:** CLOSED (Wave 6).

### L40 - creature behaviour AI / relationships / colony assignment
- **Source text:** "Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not."
- **Presets:** `pet-creature`, `aquarium-terrarium`, `virtual-pet`
- **Architecture:** `sw2d.needs` autonomous behaviour (activity choice from needs), multiple creatures, relationship affinity graph; persistent care state; colony assignment in L41.
- **Checkpoint:** Wave 7.
- **Closed by:** `sw2d.needs` deterministic activity rules, multiple actor state, movement targets, relationship graph, and versioned local persistence. Pet care changes the next decision; aquarium authors three moving creatures and two affinity edges; virtual-pet reload restores care state and explicit restart clears it. **Proof/test:** needs unit tests plus generated completion and proof journeys for all three presets. **Browser:** PASS.
- **Status:** CLOSED (Wave 7).

### L41 - colony needs / assignment / construction
- **Source text:** "Resource ledger and timed jobs are reusable (sw2d.simulation); colonist pathfinding is reusable (sw2d.navigation, optional); needs, assignment AI and construction placement are not."
- **Presets:** `colony-lite`
- **Architecture:** `bindStarterSimulation` colony mode on `sw2d.needs` (required) + `sw2d.navigation` (required): colonists with needs, job assignment, pathing, construction placement, resources, completion/failure.
- **Checkpoint:** Wave 7.
- **Closed by:** colony-lite requires `sw2d.needs` and `sw2d.navigation` and composes them with `sw2d.simulation`: three colonists expose needs, deterministic healthiest-idle assignment honors wood/stone/build priority, route followers travel to job sites, the canonical ledger receives resources and pays 2 wood + 1 stone for the hall, and construction has complete/fail/restart behavior. **Proof/test:** focused generation/honesty tests and fresh generated plus committed proof journeys, including cost refusal, path length/movement, both resources, construction, neglect failure, and restart. **Browser:** PASS.
- **Status:** CLOSED (Wave 7).

## H. Narrative

### L42 - portraits / scene composition / parser / evidence board
- **Source text:** "Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not."
- **Presets:** `visual-novel`, `point-and-click`
- **Architecture:** `sw2d.dialogue` speakers with portraits + scene backgrounds/composition (`content/dialogue.json`), `bindStarterDialogue` renders them; parser (L43) and evidence board (L44) are the other presets' rows.
- **Checkpoint:** Wave 8.

### L43 - parser IF
- **Source text:** "Nodes, flags, choices and seen entries are reusable (sw2d.narrative); a dedicated parser/text-command system and an evidence-board/deduction/linking system are not."
- **Presets:** `interactive-fiction-hybrid`, `investigation-game`
- **Architecture:** `sw2d.narrative` parser (verbs, nouns, aliases, object resolution, invalid-command feedback, state changes) authored in `content/narrative.json`; DOM text input in `bindStarterNarrative` fiction mode.
- **Checkpoint:** Wave 8.

### L44 - evidence board (same source text as L43, investigation half)
- **Presets:** `investigation-game`
- **Architecture:** `sw2d.codex` evidence + links (valid/invalid deductions, unlocked conclusions, case completion) authored in `content/codex.json`; `bindStarterNarrative` case mode board overlay.
- **Checkpoint:** Wave 8.

### L45 - museum presentation
- **Source text:** "Exhibit entries are reusable (sw2d.codex); portraits and a dedicated museum lighting/presentation overlay are not."
- **Presets:** `museum-exhibit`
- **Architecture:** `bindStarterLook` museum mode: exhibit portraits, lighting vignette/spotlight layer, inspection panel, tour completion.
- **Checkpoint:** Wave 8.

### L46 - escape-room grammar
- **Source text:** "No content-authored escape-room puzzle grammar exists yet."
- **Presets:** `escape-room`
- **Architecture:** `sw2d.puzzle-rules` `escape` kind (L25).
- **Checkpoint:** Wave 4.
- **Closed by:** L25. Authored interactables + flag gates in `content/puzzles.json`. **Browser:** PASS.
- **Status:** CLOSED (Wave 4).

## I. Party / toy / weird

### L47 - microgame rotation framework
- **Source text:** "Wait/go then mash rounds are a generated starter scheduler on sw2d.arcade; a content-authored rotation/meta-framework is not."
- **Presets:** `microgame-collection`
- **Architecture:** `content/microgames.json` (kinds: mash, react, hold, alternate; order/random; countdown; win/fail; score) consumed by `bindStarterArcade` micro mode.
- **Checkpoint:** Wave 9.

### L48 - toy launch/goal presentation
- **Source text:** "Toy launch/goal is game-specific presentation of Matter; pinball-lite consumes sw2d.pinball instead."
- **Presets:** `physics-toy`
- **Architecture:** `bindStarterPhysics` toy mode finished: spawn props, launch, goal, reset, prop count; verified complete; the sentence is a design note, not a gap, once the toy is complete.
- **Checkpoint:** Wave 9.

### L49 - wardrobe attachment system
- **Source text:** "Wardrobe slots for the generated starter use interaction drag/drop (ADR-0018); a reusable attachment/skeleton wardrobe system is not."
- **Presets:** `dress-up-character-toy`
- **Architecture:** `sw2d.items` (required) equip slots with 2D anchor metadata (slot, layer, offset, scale, rotation) in `content/items.json`; `bindStarterPointer` wardrobe mode: swap/remove, persistence, starter wardrobe.
- **Checkpoint:** Wave 9.

### L50 - sandbox authoring
- **Source text:** "Block, ball and crate stamps, plus pick-up/move/delete, for the generated starter use interaction click (ADR-0018); a generalized authoring/editing sandbox pack is not."
- **Presets:** `sandbox-playground`
- **Architecture:** `bindStarterToy` sandbox mode: spawn, select, move, delete, duplicate, edit (colour/size), undo/redo, persistence.
- **Checkpoint:** Wave 9.

### L51 - drawing canvas
- **Source text:** "Stroke polylines for the generated starter are captured through the spatial pointer (ADR-0018); pressure, layers, export and a reusable drawing-canvas system are not."
- **Presets:** `drawing-game`
- **Architecture:** spatial pointer pressure; `bindStarterPointer` draw mode: pressure width, layers, undo/redo, clear, local PNG export, pointer cancel/out-of-bounds lifecycle.
- **Checkpoint:** Wave 9.

### L52 - fishing / cooking systems
- **Source text:** "Score, combo, lives and elapsed are reusable (sw2d.arcade); a reusable casting/line/tension/fish behavior system and an ingredient/recipe/action-sequence cooking system are not."
- **Presets:** `fishing-game`, `cooking-game`
- **Architecture:** two separate content-authored systems: `content/fishing.json` (cast, bite, hook, tension, reel, fish behaviour) and `content/cooking.json` (ingredients, recipes, ordered actions, timing, dish); `bindStarterArcade` fishing/cooking modes.
- **Checkpoint:** Wave 9.

### L53 - photography scoring
- **Source text:** "Subjects for the generated starter are captured through the spatial pointer (ADR-0018) when the player is in range; framing capture is reusable (sw2d.camera); pressure, exposure and a photography scoring overlay are not."
- **Presets:** `photography-game`
- **Architecture:** `bindStarterToy` photo mode: subject detection, framing/distance/composition score, exposure (light level), half-press focus (pressure), duplicate handling, objectives, score overlay, completion.
- **Checkpoint:** Wave 9.

## X. Non-catalog rows

### X01 - gamepad feasibility (OPERATIONAL_STATE.md / README / honesty test)
- **Gap:** no gamepad adapter; catalog forbids `gamepad` input mode.
- **Architecture:** `GamepadAdapter` (poll-based, standard mapping, deadzone, connect/disconnect, multiple pads, seat routing), synthetic Gamepad API tests, `supportedInputModes` includes `gamepad` on every preset, honesty test inverted.
- **Status:** software CLOSED in Wave 9; physical-controller certification is `HUMAN-ONLY`.

### X02 - public license
- **Gap:** `UNLICENSED`; the user must choose.
- **Status:** `HUMAN-ONLY` (permitted exception 2).

---

## Status ledger

| id | presets | wave | status | final commit |
|---|---|---|---|---|
| L01 | chase-platformer | 1 | CLOSED | wave 1 |
| L02 | endless-runner, auto-runner | 1 | CLOSED | wave 1 |
| L03 | precision-platformer, climbing-game | 1 | CLOSED | wave 1 |
| L04 | action-adventure, arena-combat | 2 | CLOSED | wave 2 |
| L05 | twin-stick-shooter | 2 | CLOSED | wave 2 |
| L06 | survivor-like | 2 | CLOSED | wave 2 |
| L07 | dungeon-crawler | 2 | CLOSED | wave 2 |
| L08 | action-roguelite | 2 | CLOSED | wave 2 |
| L09 | stealth-game, heist-game | 2 | CLOSED | wave 2 |
| L10 | boss-rush | 3 | CLOSED | wave 3 |
| L11 | horizontal-shmup, vertical-shmup | 3 | CLOSED | wave 3 |
| L12 | bullet-hell | 3/11 | CLOSED | wave 3 |
| L13 | asteroids-shooter | 3 | CLOSED | wave 3 |
| L14 | asteroids-shooter | 3 | CLOSED | wave 3 |
| L15 | gallery-shooter | 3 | CLOSED | wave 3 |
| L16 | run-and-gun | 3 | CLOSED | wave 3 |
| L17 | rail-shooter | 3 | CLOSED | wave 3 |
| L18 | kart-racer | 4 | CLOSED | wave 4 kart |
| L19 | endless-driving | 4 | CLOSED | wave 4 kart |
| L20 | boat-flight-racer | 4 | CLOSED | wave 4 craft |
| L21 | match-puzzle, falling-block-puzzle | 4 | CLOSED | wave 4 puzzle |
| L22 | match-puzzle | 4 | CLOSED | wave 4 puzzle |
| L23 | breakout, pong | 4 | CLOSED | wave 4 pinball |
| L24 | pong, local-party-game | 9 | OPEN | |
| L25 | physics-puzzle, escape-room | 4 | CLOSED | wave 4 puzzle grammar |
| L26 | maze-game | 4 | CLOSED | wave 4 maze |
| L27 | rhythm-action, reaction-timing | 4 | CLOSED | wave 4 timing |
| L28 | pinball-lite | 4 | CLOSED | wave 4 pinball |
| L29 | tower-defense | 5 | CLOSED | wave 5 targeting |
| L30 | tower-defense | 5 | CLOSED | wave 5 targeting |
| L31 | lane-defense | 5 | CLOSED | wave 5 strategy |
| L32 | auto-battler | 5 | CLOSED | wave 5 strategy |
| L33 | simple-rts | 5 | CLOSED | wave 5 strategy |
| L34 | turn-based-tactics | 5 | CLOSED | wave 5 strategy |
| L35 | base-defense | 5 | CLOSED | wave 5 strategy |
| L36 | territory-control | 5 | CLOSED | wave 5 strategy |
| L37 | idle-incremental | 6 | CLOSED | wave 6 simulation |
| L38 | shopkeeper, tycoon-lite, restaurant | 6 | CLOSED | wave 6 economy layout |
| L39 | farming-lite | 6 | CLOSED | wave 6 plots |
| L40 | pet-creature, aquarium-terrarium, virtual-pet | 7 | CLOSED | wave 7 |
| L41 | colony-lite | 7 | CLOSED | wave 7 |
| L42 | visual-novel, point-and-click | 8 | OPEN | |
| L43 | interactive-fiction-hybrid | 8 | OPEN | |
| L44 | investigation-game | 8 | OPEN | |
| L45 | museum-exhibit | 8 | OPEN | |
| L46 | escape-room | 4 | CLOSED | wave 4 puzzle grammar |
| L47 | microgame-collection | 9 | OPEN | |
| L48 | physics-toy | 9 | OPEN | |
| L49 | dress-up-character-toy | 9 | OPEN | |
| L50 | sandbox-playground | 9 | OPEN | |
| L51 | drawing-game | 9 | OPEN | |
| L52 | fishing-game, cooking-game | 9 | OPEN | |
| L53 | photography-game | 9 | OPEN | |
| X01 | all (gamepad) | 9 | OPEN (software) / HUMAN-ONLY (hardware) | |
| X02 | license | - | HUMAN-ONLY | |
