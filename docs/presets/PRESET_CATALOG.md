# Preset Catalog

All 74 registered composition recipes across nine families - Phase 7A (platforming,
top-down action, shooter, 27 recipes), Phase 7B (vehicle/movement, puzzle/arcade,
strategy/defense, 22 more), and Phase 7C (simulation/management, narrative/exploration,
party/toy/weird, the final 25). This completes the catalog MASTER_PROJECT.md section 21
names - no further families remain. A recipe is a composition of real controller
families and real `@sw2d/packs` system packs - never an engine fork (MASTER_PROJECT.md
section 3.1). Twenty-three presets are `maturity: "proof-validated"`: each has a
committed proof game under `proofs/<preset-id>/` with a frozen `PROOF_CONTRACT.md`
and a dedicated real-browser proof test wired into `npm run qa:proof` (23/23; see
[`PROOF_MATRIX.md`](../proofs/PROOF_MATRIX.md)). Phase 10 established the first five
(`chase-platformer`, `twin-stick-shooter`, `tower-defense`, `sokoban`,
`idle-incremental`); the capability-completion program (ADR-0018..0027) built the
other eighteen proof games, and the Arena finish program reconciled the catalog
with that evidence one preset at a time
(docs/architecture/ARENA_FACTORY_FINISH_STATE.md). Three presets
(`traditional-platformer`, `stealth-game`, `visual-novel`) remain
`maturity: "smoke-validated"` - Phase 8 demo-level evidence only
(`demos/<preset-id>/`; see [`DEMO_MATRIX.md`](../demos/DEMO_MATRIX.md)). The other
48 remain `maturity: "recipe"`: no committed per-preset browser journey yet
(the generated-runtime matrix still proves every one of them generates, builds
and enters play).

Source of truth: `packages/presets/src/catalog/*.ts`. This file is mechanically checked
against the catalog by `packages/presets/test/catalog.test.ts` (exact id/count/family
match) and `packages/presets/test/docsSync.test.ts` - if the catalog changes, update this
file in the same change.

See also: [`PRESET_CAPABILITY_MATRIX.md`](PRESET_CAPABILITY_MATRIX.md) for the pack/
controller/input-mode breakdown and full pack-consumer coverage.

## Platforming (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `traditional-platformer` | Traditional Platformer | platform | tuning, levels | smoke-validated |
| `chase-platformer` | Chase Platformer | platform | tuning, levels | proof-validated |
| `endless-runner` | Endless Runner | platform | tuning, levels | proof-validated |
| `precision-platformer` | Precision Platformer | platform | tuning, levels, wall | recipe |
| `metroidvania` | Metroidvania | platform | tuning, levels | proof-validated |
| `puzzle-platformer` | Puzzle Platformer | platform, grid | tuning, levels | proof-validated |
| `auto-runner` | Auto Runner | platform | tuning, levels | recipe |
| `climbing-game` | Climbing Game | platform | tuning, levels, wall | recipe |
| `grappling-platformer` | Grappling Platformer | platform | tuning, levels | proof-validated |
| `collectathon-platformer` | Collectathon Platformer | platform | tuning, levels, items | proof-validated |

## Top-down action (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-adventure` | Top-Down Adventure | top-down | tuning, levels | proof-validated |
| `action-adventure` | Action Adventure | top-down | tuning, levels, melee | recipe |
| `twin-stick-shooter` | Twin-Stick Shooter | top-down | tuning, levels | proof-validated |
| `survivor-like` | Survivor-Like | top-down | tuning | recipe |
| `dungeon-crawler` | Dungeon Crawler | top-down | tuning, levels | proof-validated |
| `action-roguelite` | Action Roguelite | top-down | tuning, levels | recipe |
| `stealth-game` | Stealth Game | top-down | tuning, levels | smoke-validated |
| `heist-game` | Heist Game | top-down | tuning, levels | recipe |
| `arena-combat` | Arena Combat | top-down | tuning, levels, melee | recipe |
| `boss-rush` | Boss Rush | top-down | tuning, levels | proof-validated |

## Shooter (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `horizontal-shmup` | Horizontal Shmup | top-down | tuning, stage-scroll | recipe |
| `vertical-shmup` | Vertical Shmup | top-down | tuning, stage-scroll | recipe |
| `bullet-hell` | Bullet Hell | top-down | tuning | proof-validated |
| `asteroids-shooter` | Asteroids Shooter | vehicle | tuning | recipe |
| `gallery-shooter` | Gallery Shooter | pointer | tuning | proof-validated |
| `run-and-gun` | Run and Gun | platform | tuning, levels | proof-validated |
| `rail-shooter` | Rail Shooter | pointer | tuning, camera | recipe |

## Vehicle / movement (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-racer` | Top-Down Racer | vehicle | tuning, levels | proof-validated |
| `kart-racer` | Kart Racer | vehicle | tuning, levels | recipe |
| `time-trial-racer` | Time Trial Racer | vehicle | tuning, levels | proof-validated |
| `endless-driving` | Endless Driving | vehicle | tuning | recipe |
| `boat-flight-racer` | Boat / Flight Racer | vehicle | tuning, levels | recipe |

## Puzzle / arcade (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `sokoban` | Sokoban | grid | tuning | proof-validated |
| `match-puzzle` | Match Puzzle | grid | tuning, puzzles | recipe |
| `falling-block-puzzle` | Falling Block Puzzle | grid, ui-simulation | tuning, puzzles | recipe |
| `breakout` | Breakout | top-down | tuning, ball-paddle | recipe |
| `pong` | Pong | top-down | tuning, ball-paddle, local-play | recipe |
| `physics-puzzle` | Physics Puzzle | pointer | tuning | recipe |
| `maze-game` | Maze Game | grid | tuning, levels | recipe |
| `rhythm-action` | Rhythm Action | ui-simulation | tuning, timing | proof-validated |
| `reaction-timing` | Reaction Timing | ui-simulation | tuning, timing | proof-validated |
| `pinball-lite` | Pinball Lite | ui-simulation | tuning, pinball | proof-validated |

## Strategy / defense (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `tower-defense` | Tower Defense | grid, pointer | tuning, levels, targeting | proof-validated |
| `lane-defense` | Lane Defense | grid, pointer | tuning, levels | proof-validated |
| `auto-battler` | Auto Battler | ui-simulation | tuning, targeting | proof-validated |
| `simple-rts` | Simple RTS | top-down | tuning, levels, territory | recipe |
| `turn-based-tactics` | Turn-Based Tactics | grid, ui-simulation | tuning, levels, targeting | proof-validated |
| `base-defense` | Base Defense | top-down | tuning, levels | recipe |
| `territory-control` | Territory Control | top-down | tuning, levels, territory | recipe |

## Simulation / management (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `idle-incremental` | Idle Incremental | ui-simulation | tuning | proof-validated |
| `shopkeeper` | Shopkeeper | ui-simulation | tuning, economy | proof-validated |
| `tycoon-lite` | Tycoon Lite | ui-simulation | tuning, economy | proof-validated |
| `farming-lite` | Farming Lite | ui-simulation | tuning | proof-validated |
| `pet-creature` | Pet Creature | ui-simulation | tuning, needs | proof-validated |
| `colony-lite` | Colony Lite | ui-simulation | tuning | proof-validated |
| `restaurant` | Restaurant | ui-simulation | tuning, economy | proof-validated |
| `aquarium-terrarium` | Aquarium / Terrarium | ui-simulation | tuning, needs | proof-validated |

## Narrative / exploration (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `exploration-game` | Exploration Game | top-down | tuning, levels | proof-validated |
| `visual-novel` | Visual Novel | ui-simulation | tuning, dialogue | proof-validated |
| `point-and-click` | Point and Click | pointer, ui-simulation | tuning, levels, dialogue | proof-validated |
| `interactive-fiction-hybrid` | Interactive Fiction Hybrid | ui-simulation | tuning, dialogue | proof-validated |
| `investigation-game` | Investigation Game | top-down, pointer | tuning, levels, dialogue, codex | recipe |
| `museum-exhibit` | Museum Exhibit | top-down, pointer | tuning, levels, exhibits, codex | recipe |
| `escape-room` | Escape Room | pointer, ui-simulation | tuning, puzzles | recipe |

## Party / toy / weird (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `microgame-collection` | Microgame Collection | ui-simulation | tuning, microgames | proof-validated |
| `local-party-game` | Local Party Game | ui-simulation | tuning, local-play | proof-validated |
| `physics-toy` | Physics Toy | pointer | tuning | proof-validated |
| `virtual-pet` | Virtual Pet | ui-simulation | tuning, needs | proof-validated |
| `dress-up-character-toy` | Dress-Up Character Toy | pointer, ui-simulation | tuning, characters | recipe |
| `sandbox-playground` | Sandbox Playground | pointer, ui-simulation | tuning, levels | recipe |
| `drawing-game` | Drawing Game | pointer | tuning | recipe |
| `fishing-game` | Fishing Game | ui-simulation | tuning | proof-validated |
| `cooking-game` | Cooking Game | ui-simulation | tuning, recipes | proof-validated |
| `photography-game` | Photography Game | top-down, pointer | tuning, levels, camera | recipe |

## Key limitations by recipe

Regenerated mechanically from the live catalog (the Arena finish program found the previous
hand-maintained version had drifted badly behind the capability program). Each row is the
recipe's *first* stated limitation; see `knownLimitations` in
`packages/presets/src/catalog/*.ts` for the complete per-recipe list.

| id | most important current limitation |
|---|---|
| `traditional-platformer` | (none stated) |
| `chase-platformer` | Closing-wall pursuit for the generated starter is game-specific presentation; a reusable chase/pursuit-pressure pack is not. |
| `endless-runner` | Auto-run and the starter gap for the generated starter are game-specific presentation; a reusable climbing or chase-pressure system is not. |
| `precision-platformer` | Wall-slide and wall-jump contact are reusable (sw2d.wall); ledge-grab and a full parkour grammar are not. |
| `metroidvania` | (none stated) |
| `puzzle-platformer` | (none stated) |
| `auto-runner` | Auto-run and the starter gap for the generated starter are game-specific presentation; a reusable climbing or chase-pressure system is not. |
| `climbing-game` | Wall-slide and wall-jump contact are reusable (sw2d.wall); ledge-grab and a full parkour grammar are not. |
| `grappling-platformer` | (none stated) |
| `collectathon-platformer` | (none stated) |
| `top-down-adventure` | (none stated) |
| `action-adventure` | Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not. |
| `twin-stick-shooter` | The generated starter ships no enemy waves out of the box: sw2d.encounters is optional for this recipe, so opposition is added by enabling that pack or authoring game-specific spawns (the committed proof game demonstrates the latter). |
| `survivor-like` | In-run XP and unlock flags for the generated starter use sw2d.progression; endless difficulty scaling / meta-progression between runs is not a reusable system; the starter survival loop repeats the authored encounter without escalating it. |
| `dungeon-crawler` | Contact damage and strike for the generated starter use sw2d.combat; generated Enemy objects from the room graph and AI behaviour are not wired. |
| `action-roguelite` | In-run currency, XP, items and unlock flags for the generated starter use sw2d.progression; run-based permadeath and between-run loadouts are not a reusable capability. |
| `stealth-game` | Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not. |
| `heist-game` | Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not. |
| `arena-combat` | Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not. |
| `boss-rush` | Sequencing multiple bosses across a run is starter-specific; sw2d.encounters drives one boss encounter at a time. |
| `horizontal-shmup` | Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not. |
| `vertical-shmup` | Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not. |
| `bullet-hell` | Per-bullet GPU-scale pooling for thousands of simultaneous bullets is not tuned; patterns are bounded. |
| `asteroids-shooter` | Drifting rock fields and wrap-around collision stay game-specific; the generated starter steers and fires along heading through sw2d.weapons. |
| `gallery-shooter` | Authored gallery target waves and projectile-vs-target scoring stay in the frozen proof; the generated starter fires toward the cursor through sw2d.weapons. |
| `run-and-gun` | Enemy encounter orchestration (sw2d.encounters, Phase 4, ADR-0021) is reusable now, but this recipe does not install it - its enemy waves/patterns would be authored as game-specific code or by adding that pack. |
| `rail-shooter` | Fixed-path/rail camera movement is reusable (sw2d.camera); this starter still does not wire sw2d.weapons. |
| `top-down-racer` | (none stated) |
| `kart-racer` | Holding and firing a kart item on demand (a shell, an on-use boost pickup) is game-specific code; item boxes grant canonical sw2d.items entries (Phase 2), and drift / handling are the reusable sw2d.vehicles kart profile. |
| `time-trial-racer` | (none stated) |
| `endless-driving` | Arcade distance for the generated starter is game-specific presentation of sw2d.vehicles + sw2d.arcade; a reusable kart item-fire system is not. |
| `boat-flight-racer` | The boat and flight profiles are bounded arcade handling (momentum, drag, lateral grip, and for flight a 2D altitude band) - not fluid or aerodynamic simulation. |
| `sokoban` | (none stated) |
| `match-puzzle` | Match-detection/cascade and falling-piece/line-clear are reusable (sw2d.puzzle-rules); pointer drag-swap, wall-kicks and overlay-local boards are not. |
| `falling-block-puzzle` | Match-detection/cascade and falling-piece/line-clear are reusable (sw2d.puzzle-rules); pointer drag-swap, wall-kicks and overlay-local boards are not. |
| `breakout` | Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not. |
| `pong` | Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not. |
| `physics-puzzle` | Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content. |
| `maze-game` | Grid pathfinding and walkable occupancy are reusable (sw2d.navigation); fog-of-war, minimap and authored maze generation are not. |
| `rhythm-action` | Visual reaction cues and beat windows are reusable (sw2d.timing); a deterministic music-beat/audio-synchronization system is not. |
| `reaction-timing` | Visual reaction cues and beat windows are reusable (sw2d.timing); a deterministic music-beat/audio-synchronization system is not. |
| `pinball-lite` | Flippers, bumpers and bumper-score are reusable (sw2d.pinball); Matter presentation stays on physics-toy. |
| `tower-defense` | Spatial hover placement via the pointer shell is available but this starter uses the keyboard grid cursor. |
| `lane-defense` | Lane-spawn scheduling and combat resolution are still starter-specific. |
| `auto-battler` | Teams, active turn, selection and turn advance are reusable (sw2d.strategy); autonomous strikes are reusable (sw2d.targeting); loadout drafting stays starter-specific. |
| `simple-rts` | Unit pathfinding is reusable (sw2d.navigation, optional); box-select for the generated starter is a two-unit presentation on the spatial pointer; a command-queue UI is not implemented. |
| `turn-based-tactics` | Teams, active turn, selection and turn advance are reusable (sw2d.strategy); attack-range is reusable (sw2d.targeting); a full turn-action state machine is still starter-specific. |
| `base-defense` | Base HP and incoming contact for the generated starter use sw2d.combat; wave spawning is optional (sw2d.encounters); target-priority and upgrade rules stay starter-specific. |
| `territory-control` | Capture-zone occupancy is reusable (sw2d.territory); scoring overlays and contested multi-faction capture stay starter-specific. |
| `idle-incremental` | The simulation/resource core exists, but full offline-progress/catch-up, prestige, and large economy balancing are not production systems. |
| `shopkeeper` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `tycoon-lite` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `farming-lite` | Resource ledger and timed jobs are reusable (sw2d.simulation); crop growth and season rotation for the generated starter are presentation of those jobs; a plot-framework pack is not. |
| `pet-creature` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `colony-lite` | Resource ledger and timed jobs are reusable (sw2d.simulation); colonist pathfinding is reusable (sw2d.navigation, optional); needs, assignment AI and construction placement are not. |
| `restaurant` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `aquarium-terrarium` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `exploration-game` | (none stated) |
| `visual-novel` | Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not. |
| `point-and-click` | Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not. |
| `interactive-fiction-hybrid` | Nodes, flags, choices and seen entries are reusable (sw2d.narrative); a dedicated parser/text-command system and an evidence-board/deduction/linking system are not. |
| `investigation-game` | Nodes, flags, choices and seen entries are reusable (sw2d.narrative); a dedicated parser/text-command system and an evidence-board/deduction/linking system are not. |
| `museum-exhibit` | Exhibit entries are reusable (sw2d.codex); portraits and a dedicated museum lighting/presentation overlay are not. |
| `escape-room` | Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content. |
| `microgame-collection` | Wait/go then mash rounds are a generated starter scheduler on sw2d.arcade; a content-authored rotation/meta-framework is not. |
| `local-party-game` | Local hot-seat turns and simultaneous versus axes are reusable (sw2d.local-play); netcode, gamepads, split-screen cameras and more than two seats are not. |
| `physics-toy` | Toy launch/goal is game-specific presentation of Matter; pinball-lite consumes sw2d.pinball instead. |
| `virtual-pet` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `dress-up-character-toy` | Wardrobe slots for the generated starter use interaction drag/drop (ADR-0018); a reusable attachment/skeleton wardrobe system is not. |
| `sandbox-playground` | Block, ball and crate stamps, plus pick-up/move/delete, for the generated starter use interaction click (ADR-0018); a generalized authoring/editing sandbox pack is not. |
| `drawing-game` | Stroke polylines for the generated starter are captured through the spatial pointer (ADR-0018); pressure, layers, export and a reusable drawing-canvas system are not. |
| `fishing-game` | Score, combo, lives and elapsed are reusable (sw2d.arcade); a reusable casting/line/tension/fish behavior system and an ingredient/recipe/action-sequence cooking system are not. |
| `cooking-game` | Score, combo, lives and elapsed are reusable (sw2d.arcade); a reusable casting/line/tension/fish behavior system and an ingredient/recipe/action-sequence cooking system are not. |
| `photography-game` | Subjects for the generated starter are captured through the spatial pointer (ADR-0018) when the player is in range; framing capture is reusable (sw2d.camera); pressure, exposure and a photography scoring overlay are not. |
