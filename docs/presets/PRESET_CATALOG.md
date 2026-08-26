# Preset Catalog

All 74 registered composition recipes across nine families - Phase 7A (platforming,
top-down action, shooter, 27 recipes), Phase 7B (vehicle/movement, puzzle/arcade,
strategy/defense, 22 more), and Phase 7C (simulation/management, narrative/exploration,
party/toy/weird, the final 25). This completes the catalog MASTER_PROJECT.md section 21
names - no further families remain. A recipe is a composition of real controller
families and real `@sw2d/packs` system packs - never an engine fork (MASTER_PROJECT.md
section 3.1). Twelve presets - one representative per genre family - are now
`maturity: "smoke-validated"`: each has a real, generated demo game
(`demos/<preset-id>/`) with a committed real-browser smoke test that passed against
system Chrome (Phase 8 - see [`DEMO_MATRIX.md`](../demos/DEMO_MATRIX.md) and
[`PHASE8_OPUS_GATE_B_HANDOFF.md`](../architecture/PHASE8_OPUS_GATE_B_HANDOFF.md)). The
other 62 remain `maturity: "recipe"`: no functional demo yet. Zero presets are
`"proof-validated"` - that is Phase 10's deeper end-to-end bar, not yet claimed by any
recipe here.

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
| `chase-platformer` | Chase Platformer | platform | tuning, levels | smoke-validated |
| `endless-runner` | Endless Runner | platform | tuning, levels | recipe |
| `precision-platformer` | Precision Platformer | platform | tuning, levels | recipe |
| `metroidvania` | Metroidvania | platform | tuning, levels | smoke-validated |
| `puzzle-platformer` | Puzzle Platformer | platform, grid | tuning, levels | recipe |
| `auto-runner` | Auto Runner | platform | tuning, levels | recipe |
| `climbing-game` | Climbing Game | platform | tuning, levels | recipe |
| `grappling-platformer` | Grappling Platformer | platform | tuning, levels | recipe |
| `collectathon-platformer` | Collectathon Platformer | platform | tuning, levels, items | recipe |

## Top-down action (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-adventure` | Top-Down Adventure | top-down | tuning, levels | recipe |
| `action-adventure` | Action Adventure | top-down | tuning, levels | recipe |
| `twin-stick-shooter` | Twin-Stick Shooter | top-down | tuning, levels | smoke-validated |
| `survivor-like` | Survivor-Like | top-down | tuning | recipe |
| `dungeon-crawler` | Dungeon Crawler | top-down | tuning, levels | recipe |
| `action-roguelite` | Action Roguelite | top-down | tuning, levels | recipe |
| `stealth-game` | Stealth Game | top-down | tuning, levels | smoke-validated |
| `heist-game` | Heist Game | top-down | tuning, levels | recipe |
| `arena-combat` | Arena Combat | top-down | tuning, levels | recipe |
| `boss-rush` | Boss Rush | top-down | tuning, levels | recipe |

## Shooter (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `horizontal-shmup` | Horizontal Shmup | top-down | tuning | recipe |
| `vertical-shmup` | Vertical Shmup | top-down | tuning | recipe |
| `bullet-hell` | Bullet Hell | top-down | tuning | smoke-validated |
| `asteroids-shooter` | Asteroids Shooter | vehicle | tuning | recipe |
| `gallery-shooter` | Gallery Shooter | pointer | tuning | recipe |
| `run-and-gun` | Run and Gun | platform | tuning, levels | recipe |
| `rail-shooter` | Rail Shooter | pointer | tuning | recipe |

## Vehicle / movement (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-racer` | Top-Down Racer | vehicle | tuning, levels | smoke-validated |
| `kart-racer` | Kart Racer | vehicle | tuning, levels | recipe |
| `time-trial-racer` | Time Trial Racer | vehicle | tuning, levels | recipe |
| `endless-driving` | Endless Driving | vehicle | tuning | recipe |
| `boat-flight-racer` | Boat / Flight Racer | vehicle | tuning, levels | recipe |

## Puzzle / arcade (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `sokoban` | Sokoban | grid | tuning | smoke-validated |
| `match-puzzle` | Match Puzzle | grid | tuning | recipe |
| `falling-block-puzzle` | Falling Block Puzzle | grid, ui-simulation | tuning | recipe |
| `breakout` | Breakout | top-down | tuning | recipe |
| `pong` | Pong | top-down | tuning | recipe |
| `physics-puzzle` | Physics Puzzle | pointer | tuning | recipe |
| `maze-game` | Maze Game | grid | tuning, levels | recipe |
| `rhythm-action` | Rhythm Action | ui-simulation | tuning | recipe |
| `reaction-timing` | Reaction Timing | ui-simulation | tuning | recipe |
| `pinball-lite` | Pinball Lite | ui-simulation | tuning | recipe |

## Strategy / defense (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `tower-defense` | Tower Defense | grid, pointer | tuning, levels | smoke-validated |
| `lane-defense` | Lane Defense | grid, pointer | tuning, levels | recipe |
| `auto-battler` | Auto Battler | ui-simulation | tuning | recipe |
| `simple-rts` | Simple RTS | top-down | tuning, levels | recipe |
| `turn-based-tactics` | Turn-Based Tactics | grid, ui-simulation | tuning, levels | smoke-validated |
| `base-defense` | Base Defense | top-down | tuning, levels | recipe |
| `territory-control` | Territory Control | top-down | tuning, levels | recipe |

## Simulation / management (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `idle-incremental` | Idle Incremental | ui-simulation | tuning | smoke-validated |
| `shopkeeper` | Shopkeeper | ui-simulation | tuning | recipe |
| `tycoon-lite` | Tycoon Lite | ui-simulation | tuning | recipe |
| `farming-lite` | Farming Lite | ui-simulation | tuning | recipe |
| `pet-creature` | Pet Creature | ui-simulation | tuning | recipe |
| `colony-lite` | Colony Lite | ui-simulation | tuning | recipe |
| `restaurant` | Restaurant | ui-simulation | tuning | recipe |
| `aquarium-terrarium` | Aquarium / Terrarium | ui-simulation | tuning | recipe |

## Narrative / exploration (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `exploration-game` | Exploration Game | top-down | tuning, levels | recipe |
| `visual-novel` | Visual Novel | ui-simulation | tuning, dialogue | smoke-validated |
| `point-and-click` | Point and Click | pointer, ui-simulation | tuning, levels, dialogue | recipe |
| `interactive-fiction-hybrid` | Interactive Fiction Hybrid | ui-simulation | tuning, dialogue | recipe |
| `investigation-game` | Investigation Game | top-down, pointer | tuning, levels, dialogue | recipe |
| `museum-exhibit` | Museum Exhibit | top-down, pointer | tuning, levels, exhibits | recipe |
| `escape-room` | Escape Room | pointer, ui-simulation | tuning, puzzles | recipe |

## Party / toy / weird (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `microgame-collection` | Microgame Collection | ui-simulation | tuning, microgames | recipe |
| `local-party-game` | Local Party Game | ui-simulation | tuning | recipe |
| `physics-toy` | Physics Toy | pointer | tuning | recipe |
| `virtual-pet` | Virtual Pet | ui-simulation | tuning | recipe |
| `dress-up-character-toy` | Dress-Up Character Toy | pointer, ui-simulation | tuning, characters | recipe |
| `sandbox-playground` | Sandbox Playground | pointer, ui-simulation | tuning, levels | recipe |
| `drawing-game` | Drawing Game | pointer | tuning | recipe |
| `fishing-game` | Fishing Game | ui-simulation | tuning | recipe |
| `cooking-game` | Cooking Game | ui-simulation | tuning, recipes | recipe |
| `photography-game` | Photography Game | top-down, pointer | tuning, levels | recipe |

## Key limitations by recipe

Every recipe with a real, currently-missing capability states it explicitly - this is
not an exhaustive changelog, just the one limitation most defines what the recipe cannot
do yet. See each recipe's `knownLimitations` in source for the complete list.

| id | most important current limitation |
|---|---|
| `traditional-platformer` | (none stated) |
| `chase-platformer` | A reusable chase/pursuit-pressure system does not exist yet; it must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates. |
| `endless-runner` | No procedural level/segment generation exists yet; only hand-authored Tiled levels (Phase 6) are supported. |
| `precision-platformer` | (none stated) |
| `metroidvania` | A world graph, room transitions and a map system are not yet implemented; only flat single-level Tiled maps plus world flags/checkpoints exist (Phase 6). |
| `puzzle-platformer` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `auto-runner` | No procedural level/segment generation exists yet; only hand-authored Tiled levels (Phase 6) are supported. |
| `climbing-game` | Wall-slide, wall-jump and ledge-grab movement mechanics are not yet implemented as reusable capabilities (MASTER_PROJECT.md section 9.2); vertical movement must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates. |
| `grappling-platformer` | No advanced rope/constraint/grappling physics exists yet. |
| `collectathon-platformer` | Item/collectible definitions beyond the Collectible Tiled object class (Phase 6) have no dedicated schema yet. |
| `top-down-adventure` | (none stated) |
| `action-adventure` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `twin-stick-shooter` | Independent spatial/analog aim is not yet a proven controller capability. Current pointer controller is press-style only; spatial pointer remains deferred. |
| `survivor-like` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `dungeon-crawler` | No procedural level/segment generation exists yet; only hand-authored Tiled levels (Phase 6) are supported. |
| `action-roguelite` | No procedural level/segment generation exists yet; only hand-authored Tiled levels (Phase 6) are supported. |
| `stealth-game` | AI state exists, but full vision cones, awareness geometry, noise propagation, hiding, and patrol navigation are not implemented. |
| `heist-game` | AI state exists, but full vision cones, awareness geometry, noise propagation, hiding, and patrol navigation are not implemented. |
| `arena-combat` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `boss-rush` | AI/combat state foundations exist, but reusable boss-phase orchestration is not yet a production system. |
| `horizontal-shmup` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `vertical-shmup` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `bullet-hell` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `asteroids-shooter` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `gallery-shooter` | Spatial pointer targeting is not yet implemented. |
| `run-and-gun` | Combat core exists, but full projectile/weapon systems are not yet implemented. |
| `rail-shooter` | Spatial pointer targeting is not yet implemented. |
| `top-down-racer` | The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists. |
| `kart-racer` | The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists. |
| `time-trial-racer` | The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists. |
| `endless-driving` | The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists. |
| `boat-flight-racer` | The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists. |
| `sokoban` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `match-puzzle` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `falling-block-puzzle` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `breakout` | No reusable ball/paddle collision-and-bounce system exists yet. |
| `pong` | No reusable ball/paddle collision-and-bounce system exists yet. |
| `physics-puzzle` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `maze-game` | (none stated) |
| `rhythm-action` | No deterministic music-beat/audio-synchronization system exists yet. |
| `reaction-timing` | Arcade timing state exists, but no specialized reaction-test flow is implemented. |
| `pinball-lite` | Optional advanced rigid-body/constraint physics has not been implemented. |
| `tower-defense` | Spatial placement/hover targeting is not implemented. |
| `lane-defense` | No reusable lane-spawn/route/combat-resolution system exists yet. |
| `auto-battler` | AI/combat/strategy state foundations exist, but autonomous combat orchestration is not implemented. |
| `simple-rts` | Spatial selection/command targeting and pathfinding are not implemented. |
| `turn-based-tactics` | Grid/strategy foundations exist, but movement range, attack range, pathfinding, and turn-action resolution are not reusable systems yet. |
| `base-defense` | Wave spawning/targeting/base-damage orchestration is not a reusable system yet. |
| `territory-control` | Reusable capture-zone/territory ownership/scoring mechanics do not exist yet. |
| `idle-incremental` | The simulation/resource core exists, but full offline-progress/catch-up, prestige, and large economy balancing are not production systems. |
| `shopkeeper` | No complete customer AI, demand/economy model, queue/placement UI, or content-authored production chain exists. |
| `tycoon-lite` | No complete customer AI, demand/economy model, queue/placement UI, or content-authored production chain exists. |
| `farming-lite` | No reusable crop-growth/season/plot-interaction system exists. |
| `pet-creature` | No reusable needs/behavior/relationship/creature simulation exists beyond foundational resources/state. |
| `colony-lite` | No colonist needs, assignment AI, pathfinding, construction placement, or colony simulation exists. |
| `restaurant` | No complete customer AI, demand/economy model, queue/placement UI, or content-authored production chain exists. |
| `aquarium-terrarium` | No reusable needs/behavior/relationship/creature simulation exists beyond foundational resources/state. |
| `exploration-game` | A world graph, room transitions and a map system are not yet implemented; only flat single-level Tiled maps plus world flags/checkpoints exist (Phase 6). |
| `visual-novel` | Narrative state exists, but no full content-authored branching dialogue renderer/portrait presentation system exists. |
| `point-and-click` | Spatial pointer position, hover targets, and world-coordinate click targeting remain unimplemented. |
| `interactive-fiction-hybrid` | No dedicated parser/text-command system exists. |
| `investigation-game` | No evidence-board/deduction/linking system exists. |
| `museum-exhibit` | No dedicated exhibit/codex presentation framework exists beyond general world/narrative/UI foundations. |
| `escape-room` | puzzlePack's config (createInitialState/isSolved) is functions, not JSON-serializable data, so puzzle definitions are not currently content-authorable through a schema; they are written as game-specific TypeScript. |
| `microgame-collection` | No microgame scheduler/rotation/meta-framework exists. |
| `local-party-game` | No multi-player/local multi-device input routing exists. |
| `physics-toy` | Optional advanced rigid-body/constraint physics has not been implemented. |
| `virtual-pet` | No reusable needs/behavior/relationship/creature simulation exists beyond foundational resources/state. |
| `dress-up-character-toy` | No spatial drag/drop wardrobe/attachment system exists. |
| `sandbox-playground` | No generalized authoring/editing sandbox exists. |
| `drawing-game` | No spatial pointer drawing/canvas-stroke input service exists. |
| `fishing-game` | No reusable casting/line/tension/fish behavior system exists. |
| `cooking-game` | No reusable ingredient/recipe/action-sequence cooking system exists. |
| `photography-game` | No reusable camera/framing/scoring/photo-capture gameplay system exists. |
