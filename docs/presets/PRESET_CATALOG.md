# Preset Catalog

49 registered composition recipes across six families - Phase 7A (platforming,
top-down action, shooter, 27 recipes) plus Phase 7B (vehicle/movement, puzzle/arcade,
strategy/defense, 22 more). A recipe is a composition of real controller families and
real `@sw2d/packs` system packs - never an engine fork (MASTER_PROJECT.md section 3.1).
Every recipe below is `maturity: "recipe"`: none has a functional smoke demo (Phase 8)
or a deep end-to-end proof (Phase 10) yet.

Source of truth: `packages/presets/src/catalog/*.ts`. This file is mechanically checked
against the catalog by `packages/presets/test/catalog.test.ts` (exact id/count/family
match) and `packages/presets/test/docsSync.test.ts` - if the catalog changes, update this
file in the same change.

See also: [`PRESET_CAPABILITY_MATRIX.md`](PRESET_CAPABILITY_MATRIX.md) for the pack/
controller/input-mode breakdown.

## Platforming (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `traditional-platformer` | Traditional Platformer | platform | tuning, levels | recipe |
| `chase-platformer` | Chase Platformer | platform | tuning, levels | recipe |
| `endless-runner` | Endless Runner | platform | tuning, levels | recipe |
| `precision-platformer` | Precision Platformer | platform | tuning, levels | recipe |
| `metroidvania` | Metroidvania | platform | tuning, levels | recipe |
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
| `twin-stick-shooter` | Twin-Stick Shooter | top-down | tuning, levels | recipe |
| `survivor-like` | Survivor-Like | top-down | tuning | recipe |
| `dungeon-crawler` | Dungeon Crawler | top-down | tuning, levels | recipe |
| `action-roguelite` | Action Roguelite | top-down | tuning, levels | recipe |
| `stealth-game` | Stealth Game | top-down | tuning, levels | recipe |
| `heist-game` | Heist Game | top-down | tuning, levels | recipe |
| `arena-combat` | Arena Combat | top-down | tuning, levels | recipe |
| `boss-rush` | Boss Rush | top-down | tuning, levels | recipe |

## Shooter (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `horizontal-shmup` | Horizontal Shmup | top-down | tuning | recipe |
| `vertical-shmup` | Vertical Shmup | top-down | tuning | recipe |
| `bullet-hell` | Bullet Hell | top-down | tuning | recipe |
| `asteroids-shooter` | Asteroids Shooter | vehicle | tuning | recipe |
| `gallery-shooter` | Gallery Shooter | pointer | tuning | recipe |
| `run-and-gun` | Run and Gun | platform | tuning, levels | recipe |
| `rail-shooter` | Rail Shooter | pointer | tuning | recipe |

## Vehicle / movement (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-racer` | Top-Down Racer | vehicle | tuning, levels | recipe |
| `kart-racer` | Kart Racer | vehicle | tuning, levels | recipe |
| `time-trial-racer` | Time Trial Racer | vehicle | tuning, levels | recipe |
| `endless-driving` | Endless Driving | vehicle | tuning | recipe |
| `boat-flight-racer` | Boat / Flight Racer | vehicle | tuning, levels | recipe |

## Puzzle / arcade (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `sokoban` | Sokoban | grid | tuning | recipe |
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
| `tower-defense` | Tower Defense | grid, pointer | tuning, levels | recipe |
| `lane-defense` | Lane Defense | grid, pointer | tuning, levels | recipe |
| `auto-battler` | Auto Battler | ui-simulation | tuning | recipe |
| `simple-rts` | Simple RTS | top-down | tuning, levels | recipe |
| `turn-based-tactics` | Turn-Based Tactics | grid, ui-simulation | tuning, levels | recipe |
| `base-defense` | Base Defense | top-down | tuning, levels | recipe |
| `territory-control` | Territory Control | top-down | tuning, levels | recipe |

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
