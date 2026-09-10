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
| `precision-platformer` | Precision Platformer | platform | tuning, levels | recipe |
| `metroidvania` | Metroidvania | platform | tuning, levels | proof-validated |
| `puzzle-platformer` | Puzzle Platformer | platform, grid | tuning, levels | proof-validated |
| `auto-runner` | Auto Runner | platform | tuning, levels | recipe |
| `climbing-game` | Climbing Game | platform | tuning, levels | recipe |
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
| `rail-shooter` | Rail Shooter | pointer | tuning | recipe |

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
| `rhythm-action` | Rhythm Action | ui-simulation | tuning | recipe |
| `reaction-timing` | Reaction Timing | ui-simulation | tuning | recipe |
| `pinball-lite` | Pinball Lite | ui-simulation | tuning | recipe |

## Strategy / defense (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `tower-defense` | Tower Defense | grid, pointer | tuning, levels | proof-validated |
| `lane-defense` | Lane Defense | grid, pointer | tuning, levels | proof-validated |
| `auto-battler` | Auto Battler | ui-simulation | tuning | recipe |
| `simple-rts` | Simple RTS | top-down | tuning, levels | recipe |
| `turn-based-tactics` | Turn-Based Tactics | grid, ui-simulation | tuning, levels | proof-validated |
| `base-defense` | Base Defense | top-down | tuning, levels | recipe |
| `territory-control` | Territory Control | top-down | tuning, levels | recipe |

## Simulation / management (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `idle-incremental` | Idle Incremental | ui-simulation | tuning | proof-validated |
| `shopkeeper` | Shopkeeper | ui-simulation | tuning, economy | recipe |
| `tycoon-lite` | Tycoon Lite | ui-simulation | tuning, economy | recipe |
| `farming-lite` | Farming Lite | ui-simulation | tuning | recipe |
| `pet-creature` | Pet Creature | ui-simulation | tuning, needs | recipe |
| `colony-lite` | Colony Lite | ui-simulation | tuning | recipe |
| `restaurant` | Restaurant | ui-simulation | tuning, economy | recipe |
| `aquarium-terrarium` | Aquarium / Terrarium | ui-simulation | tuning, needs | recipe |

## Narrative / exploration (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `exploration-game` | Exploration Game | top-down | tuning, levels | proof-validated |
| `visual-novel` | Visual Novel | ui-simulation | tuning, dialogue | smoke-validated |
| `point-and-click` | Point and Click | pointer, ui-simulation | tuning, levels, dialogue | proof-validated |
| `interactive-fiction-hybrid` | Interactive Fiction Hybrid | ui-simulation | tuning, dialogue | recipe |
| `investigation-game` | Investigation Game | top-down, pointer | tuning, levels, dialogue | recipe |
| `museum-exhibit` | Museum Exhibit | top-down, pointer | tuning, levels, exhibits | recipe |
| `escape-room` | Escape Room | pointer, ui-simulation | tuning, puzzles | recipe |

## Party / toy / weird (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `microgame-collection` | Microgame Collection | ui-simulation | tuning, microgames | recipe |
| `local-party-game` | Local Party Game | ui-simulation | tuning, local-play | recipe |
| `physics-toy` | Physics Toy | pointer | tuning | proof-validated |
| `virtual-pet` | Virtual Pet | ui-simulation | tuning, needs | recipe |
| `dress-up-character-toy` | Dress-Up Character Toy | pointer, ui-simulation | tuning, characters | recipe |
| `sandbox-playground` | Sandbox Playground | pointer, ui-simulation | tuning, levels | recipe |
| `drawing-game` | Drawing Game | pointer | tuning | recipe |
| `fishing-game` | Fishing Game | ui-simulation | tuning | recipe |
| `cooking-game` | Cooking Game | ui-simulation | tuning, recipes | recipe |
| `photography-game` | Photography Game | top-down, pointer | tuning, levels | recipe |

## Key limitations by recipe

Regenerated mechanically from the live catalog (the Arena finish program found the previous
hand-maintained version had drifted badly behind the capability program). Each row is the
recipe's *first* stated limitation; see `knownLimitations` in
`packages/presets/src/catalog/*.ts` for the complete per-recipe list.

| id | most important current limitation |
|---|---|
| `traditional-platformer` | (none stated) |
| `chase-platformer` | A reusable chase/pursuit-pressure system does not exist yet; it must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates. |
| `endless-runner` | (none stated) |
| `precision-platformer` | (none stated) |
| `metroidvania` | (none stated) |
| `puzzle-platformer` | (none stated) |
| `auto-runner` | (none stated) |
| `climbing-game` | Wall-slide, wall-jump and ledge-grab movement mechanics are not yet implemented as reusable capabilities (MASTER_PROJECT.md section 9.2); vertical movement must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates. |
| `grappling-platformer` | (none stated) |
| `collectathon-platformer` | (none stated) |
| `top-down-adventure` | (none stated) |
| `action-adventure` | Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not. |
| `twin-stick-shooter` | The generated starter ships no enemy waves out of the box: sw2d.encounters is optional for this recipe, so opposition is added by enabling that pack or authoring game-specific spawns (the committed proof game demonstrates the latter). |
| `survivor-like` | Endless difficulty scaling / meta-progression between runs is not a reusable system; the starter survival loop repeats the authored encounter without escalating it. |
| `dungeon-crawler` | The room graph places Enemy objects, but the generated top-down shell does not yet wire them into sw2d.combat / sw2d.ai - enemy behaviour is game-specific code. |
| `action-roguelite` | Run-based meta-progression/permadeath state is not yet a reusable capability beyond sw2d.progression. |
| `stealth-game` | Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not. |
| `heist-game` | Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not. |
| `arena-combat` | Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not. |
| `boss-rush` | Sequencing multiple bosses across a run is starter-specific; sw2d.encounters drives one boss encounter at a time. |
| `horizontal-shmup` | Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not. |
| `vertical-shmup` | Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not. |
| `bullet-hell` | Per-bullet GPU-scale pooling for thousands of simultaneous bullets is not tuned; patterns are bounded. |
| `asteroids-shooter` | The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter's shell does not wire it yet. |
| `gallery-shooter` | The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter's shell does not wire it yet. |
| `run-and-gun` | Enemy encounter orchestration (sw2d.encounters, Phase 4, ADR-0021) is reusable now, but this recipe does not install it - its enemy waves/patterns would be authored as game-specific code or by adding that pack. |
| `rail-shooter` | The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter's shell does not wire it yet. |
| `top-down-racer` | (none stated) |
| `kart-racer` | Holding and firing a kart item on demand (a shell, an on-use boost pickup) is game-specific code; item boxes grant canonical sw2d.items entries (Phase 2), and drift / handling are the reusable sw2d.vehicles kart profile. |
| `time-trial-racer` | (none stated) |
| `endless-driving` | (none stated) |
| `boat-flight-racer` | The boat and flight profiles are bounded arcade handling (momentum, drag, lateral grip, and for flight a 2D altitude band) - not fluid or aerodynamic simulation. |
| `sokoban` | (none stated) |
| `match-puzzle` | Match-detection/cascade and falling-piece/line-clear are reusable (sw2d.puzzle-rules); pointer drag-swap, wall-kicks and overlay-local boards are not. |
| `falling-block-puzzle` | Match-detection/cascade and falling-piece/line-clear are reusable (sw2d.puzzle-rules); pointer drag-swap, wall-kicks and overlay-local boards are not. |
| `breakout` | Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not. |
| `pong` | Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not. |
| `physics-puzzle` | Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content. |
| `maze-game` | (none stated) |
| `rhythm-action` | No deterministic music-beat/audio-synchronization system exists yet. |
| `reaction-timing` | Arcade timing state exists, but no specialized reaction-test flow is implemented. |
| `pinball-lite` | A full pinball table (flippers, bumpers, scoring lanes) is game-specific code on top of the Matter ball + static collision the shell provides. |
| `tower-defense` | Spatial hover placement via the pointer shell is available but this starter uses the keyboard grid cursor. |
| `lane-defense` | Lane-spawn scheduling and combat resolution are still starter-specific. |
| `auto-battler` | AI/combat/strategy state foundations exist, but autonomous combat orchestration is not implemented. |
| `simple-rts` | Unit pathfinding is reusable (sw2d.navigation, optional); box-select and command-queue UI are not implemented. |
| `turn-based-tactics` | Attack-range/line-of-fire resolution and a full turn-action state machine are still starter-specific. |
| `base-defense` | Wave spawning is reusable (sw2d.encounters, Phase 4, optional); base-damage/target-priority resolution is still starter-specific. |
| `territory-control` | Reusable capture-zone/territory ownership/scoring mechanics do not exist yet. |
| `idle-incremental` | The simulation/resource core exists, but full offline-progress/catch-up, prestige, and large economy balancing are not production systems. |
| `shopkeeper` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `tycoon-lite` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `farming-lite` | No reusable crop-growth/season/plot-interaction system exists. |
| `pet-creature` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `colony-lite` | Colonist pathfinding is reusable (sw2d.navigation, optional); needs, assignment AI, construction placement and colony simulation are not. |
| `restaurant` | Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not. |
| `aquarium-terrarium` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `exploration-game` | (none stated) |
| `visual-novel` | Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not. |
| `point-and-click` | Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not. |
| `interactive-fiction-hybrid` | No dedicated parser/text-command system exists. |
| `investigation-game` | No evidence-board/deduction/linking system exists. |
| `museum-exhibit` | No dedicated exhibit/codex presentation framework exists beyond general world/narrative/UI foundations. |
| `escape-room` | Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content. |
| `microgame-collection` | No microgame scheduler/rotation/meta-framework exists. |
| `local-party-game` | Local hot-seat turns and simultaneous versus axes are reusable (sw2d.local-play); netcode, gamepads, split-screen cameras and more than two seats are not. |
| `physics-toy` | (none stated) |
| `virtual-pet` | Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not. |
| `dress-up-character-toy` | No wardrobe/attachment system is built on the drag/drop capability (ADR-0018) yet. |
| `sandbox-playground` | No generalized authoring/editing sandbox exists. |
| `drawing-game` | No canvas-stroke/drawing capture is built on the spatial pointer service (ADR-0018) yet. |
| `fishing-game` | No reusable casting/line/tension/fish behavior system exists. |
| `cooking-game` | No reusable ingredient/recipe/action-sequence cooking system exists. |
| `photography-game` | No reusable camera/framing/scoring/photo-capture gameplay system exists. |
