# Preset Catalog

All 74 registered composition recipes across nine families - Phase 7A (platforming,
top-down action, shooter, 27 recipes), Phase 7B (vehicle/movement, puzzle/arcade,
strategy/defense, 22 more), and Phase 7C (simulation/management, narrative/exploration,
party/toy/weird, the final 25). This completes the catalog MASTER_PROJECT.md section 21
names - no further families remain. A recipe is a composition of real controller
families and real `@sw2d/packs` system packs - never an engine fork (MASTER_PROJECT.md
section 3.1). Every one of the 74 presets is `maturity: "proof-validated"`: each has a
committed proof game under `proofs/<preset-id>/` with a frozen `PROOF_CONTRACT.md` and a
dedicated real-browser proof test wired into `npm run qa:proof` (74/74; see
[`PROOF_MATRIX.md`](../proofs/PROOF_MATRIX.md)). Phase 10 established the first five
(`chase-platformer`, `twin-stick-shooter`, `tower-defense`, `sokoban`,
`idle-incremental`); the capability-completion program (ADR-0018..0027) built the
next eighteen proof games, and the Arena finish program reconciled the catalog with
that evidence one preset at a time
(docs/architecture/ARENA_FACTORY_FINISH_STATE.md). The Category-C convergence program
(docs/architecture/CATEGORY_C_CONVERGENCE_MATRIX.md) committed the remaining 51 proofs -
each the unmodified canonical factory output for its preset, promoted only after its
journey passed `qa:proof` - so no preset is `smoke-validated` or `recipe` any more. A
proof-validated preset is still a *recipe* in the sense of MASTER_PROJECT.md section 3.1:
the "Key limitations by recipe" table below is what each generated game deliberately does
not do yet, and the generated-runtime matrix still proves every preset generates, builds
and enters play.

Source of truth: `packages/presets/src/catalog/*.ts`. This file is mechanically checked
against the catalog by `packages/presets/test/catalog.test.ts` (exact id/count/family
match) and `packages/presets/test/docsSync.test.ts` - if the catalog changes, update this
file in the same change.

See also: [`PRESET_CAPABILITY_MATRIX.md`](PRESET_CAPABILITY_MATRIX.md) for the pack/
controller/input-mode breakdown and full pack-consumer coverage.

## Platforming (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `traditional-platformer` | Traditional Platformer | platform | tuning, levels | proof-validated |
| `chase-platformer` | Chase Platformer | platform | tuning, levels, pursuit | proof-validated |
| `endless-runner` | Endless Runner | platform | tuning, levels, generation, pursuit | proof-validated |
| `precision-platformer` | Precision Platformer | platform | tuning, levels, wall | proof-validated |
| `metroidvania` | Metroidvania | platform | tuning, levels, world-graph | proof-validated |
| `puzzle-platformer` | Puzzle Platformer | platform, grid | tuning, levels, puzzles | proof-validated |
| `auto-runner` | Auto Runner | platform | tuning, levels, generation, pursuit | proof-validated |
| `climbing-game` | Climbing Game | platform | tuning, levels, wall | proof-validated |
| `grappling-platformer` | Grappling Platformer | platform | tuning, levels | proof-validated |
| `collectathon-platformer` | Collectathon Platformer | platform | tuning, levels, items | proof-validated |

## Top-down action (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-adventure` | Top-Down Adventure | top-down | tuning, levels | proof-validated |
| `action-adventure` | Action Adventure | top-down | tuning, levels, melee | proof-validated |
| `twin-stick-shooter` | Twin-Stick Shooter | top-down | tuning, levels, encounters | proof-validated |
| `survivor-like` | Survivor-Like | top-down | tuning, encounters, runs | proof-validated |
| `dungeon-crawler` | Dungeon Crawler | top-down | tuning, levels, generation | proof-validated |
| `action-roguelite` | Action Roguelite | top-down | tuning, levels, generation, runs | proof-validated |
| `stealth-game` | Stealth Game | top-down | tuning, levels, perception | proof-validated |
| `heist-game` | Heist Game | top-down | tuning, levels, perception | proof-validated |
| `arena-combat` | Arena Combat | top-down | tuning, levels, melee | proof-validated |
| `boss-rush` | Boss Rush | top-down | tuning, levels, encounters | proof-validated |

## Shooter (Phase 7A)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `horizontal-shmup` | Horizontal Shmup | top-down | tuning, stage-scroll, encounters | proof-validated |
| `vertical-shmup` | Vertical Shmup | top-down | tuning, stage-scroll, encounters | proof-validated |
| `bullet-hell` | Bullet Hell | top-down | tuning, encounters | proof-validated |
| `asteroids-shooter` | Asteroids Shooter | vehicle | tuning, vehicles | proof-validated |
| `gallery-shooter` | Gallery Shooter | pointer | tuning, encounters | proof-validated |
| `run-and-gun` | Run and Gun | platform | tuning, levels, encounters | proof-validated |
| `rail-shooter` | Rail Shooter | pointer | tuning, camera, encounters | proof-validated |

## Vehicle / movement (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `top-down-racer` | Top-Down Racer | vehicle | tuning, levels, vehicles, races | proof-validated |
| `kart-racer` | Kart Racer | vehicle | tuning, levels, vehicles, races, items | proof-validated |
| `time-trial-racer` | Time Trial Racer | vehicle | tuning, levels, vehicles, races | proof-validated |
| `endless-driving` | Endless Driving | vehicle | tuning, generation, vehicles, items | proof-validated |
| `boat-flight-racer` | Boat / Flight Racer | vehicle | tuning, levels, vehicles, races | proof-validated |

## Puzzle / arcade (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `sokoban` | Sokoban | grid | tuning, puzzles | proof-validated |
| `match-puzzle` | Match Puzzle | grid | tuning, puzzles | proof-validated |
| `falling-block-puzzle` | Falling Block Puzzle | grid, ui-simulation | tuning, puzzles | proof-validated |
| `breakout` | Breakout | top-down | tuning, ball-paddle | proof-validated |
| `pong` | Pong | top-down | tuning, ball-paddle, local-play | proof-validated |
| `physics-puzzle` | Physics Puzzle | pointer | tuning, puzzles | proof-validated |
| `maze-game` | Maze Game | grid | tuning, levels, generation | proof-validated |
| `rhythm-action` | Rhythm Action | ui-simulation | tuning, timing | proof-validated |
| `reaction-timing` | Reaction Timing | ui-simulation | tuning, timing | proof-validated |
| `pinball-lite` | Pinball Lite | ui-simulation | tuning, pinball | proof-validated |

## Strategy / defense (Phase 7B)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `tower-defense` | Tower Defense | grid, pointer | tuning, levels, targeting | proof-validated |
| `lane-defense` | Lane Defense | grid, pointer | tuning, levels | proof-validated |
| `auto-battler` | Auto Battler | ui-simulation | tuning, targeting | proof-validated |
| `simple-rts` | Simple RTS | top-down | tuning, levels, territory | proof-validated |
| `turn-based-tactics` | Turn-Based Tactics | grid, ui-simulation | tuning, levels, targeting | proof-validated |
| `base-defense` | Base Defense | top-down | tuning, levels, targeting | proof-validated |
| `territory-control` | Territory Control | top-down | tuning, levels, territory | proof-validated |

## Simulation / management (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `idle-incremental` | Idle Incremental | ui-simulation | tuning | proof-validated |
| `shopkeeper` | Shopkeeper | ui-simulation | tuning, economy | proof-validated |
| `tycoon-lite` | Tycoon Lite | ui-simulation | tuning, economy | proof-validated |
| `farming-lite` | Farming Lite | ui-simulation | tuning | proof-validated |
| `pet-creature` | Pet Creature | ui-simulation | tuning, needs | proof-validated |
| `colony-lite` | Colony Lite | ui-simulation | tuning, needs | proof-validated |
| `restaurant` | Restaurant | ui-simulation | tuning, economy | proof-validated |
| `aquarium-terrarium` | Aquarium / Terrarium | ui-simulation | tuning, needs | proof-validated |

## Narrative / exploration (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `exploration-game` | Exploration Game | top-down | tuning, levels, world-graph | proof-validated |
| `visual-novel` | Visual Novel | ui-simulation | tuning, dialogue | proof-validated |
| `point-and-click` | Point and Click | pointer, ui-simulation | tuning, levels, dialogue | proof-validated |
| `interactive-fiction-hybrid` | Interactive Fiction Hybrid | ui-simulation | tuning, dialogue | proof-validated |
| `investigation-game` | Investigation Game | top-down, pointer | tuning, levels, dialogue, codex | proof-validated |
| `museum-exhibit` | Museum Exhibit | top-down, pointer | tuning, levels, exhibits, codex | proof-validated |
| `escape-room` | Escape Room | pointer, ui-simulation | tuning, puzzles | proof-validated |

## Party / toy / weird (Phase 7C)

| id | display name | controller(s) | content roles | maturity |
|---|---|---|---|---|
| `microgame-collection` | Microgame Collection | ui-simulation | tuning, microgames | proof-validated |
| `local-party-game` | Local Party Game | ui-simulation | tuning, local-play | proof-validated |
| `physics-toy` | Physics Toy | pointer | tuning | proof-validated |
| `virtual-pet` | Virtual Pet | ui-simulation | tuning, needs | proof-validated |
| `dress-up-character-toy` | Dress-Up Character Toy | pointer, ui-simulation | tuning, characters, items | proof-validated |
| `sandbox-playground` | Sandbox Playground | pointer, ui-simulation | tuning, levels | proof-validated |
| `drawing-game` | Drawing Game | pointer | tuning | proof-validated |
| `fishing-game` | Fishing Game | ui-simulation | tuning | proof-validated |
| `cooking-game` | Cooking Game | ui-simulation | tuning, recipes | proof-validated |
| `photography-game` | Photography Game | top-down, pointer | tuning, levels, camera | proof-validated |

## Key limitations by recipe

Regenerated mechanically from the live catalog (the Arena finish program found the previous
hand-maintained version had drifted badly behind the capability program). Each row is the
recipe's *first* stated limitation; see `knownLimitations` in
`packages/presets/src/catalog/*.ts` for the complete per-recipe list.

| id | most important current limitation |
|---|---|
| `traditional-platformer` | (none stated) |
| `chase-platformer` | (none stated) |
| `endless-runner` | (none stated) |
| `precision-platformer` | (none stated) |
| `metroidvania` | (none stated) |
| `puzzle-platformer` | (none stated) |
| `auto-runner` | (none stated) |
| `climbing-game` | (none stated) |
| `grappling-platformer` | (none stated) |
| `collectathon-platformer` | (none stated) |
| `top-down-adventure` | (none stated) |
| `action-adventure` | (none stated) |
| `twin-stick-shooter` | (none stated) |
| `survivor-like` | (none stated) |
| `dungeon-crawler` | (none stated) |
| `action-roguelite` | (none stated) |
| `stealth-game` | (none stated) |
| `heist-game` | (none stated) |
| `arena-combat` | (none stated) |
| `boss-rush` | (none stated) |
| `horizontal-shmup` | (none stated) |
| `vertical-shmup` | (none stated) |
| `bullet-hell` | (none stated) |
| `asteroids-shooter` | (none stated) |
| `gallery-shooter` | (none stated) |
| `run-and-gun` | (none stated) |
| `rail-shooter` | (none stated) |
| `top-down-racer` | (none stated) |
| `kart-racer` | (none stated) |
| `time-trial-racer` | (none stated) |
| `endless-driving` | (none stated) |
| `boat-flight-racer` | (none stated) |
| `sokoban` | (none stated) |
| `match-puzzle` | (none stated) |
| `falling-block-puzzle` | (none stated) |
| `breakout` | (none stated) |
| `pong` | (none stated) |
| `physics-puzzle` | (none stated) |
| `maze-game` | (none stated) |
| `rhythm-action` | (none stated) |
| `reaction-timing` | (none stated) |
| `pinball-lite` | (none stated) |
| `tower-defense` | (none stated) |
| `lane-defense` | (none stated) |
| `auto-battler` | (none stated) |
| `simple-rts` | (none stated) |
| `turn-based-tactics` | (none stated) |
| `base-defense` | (none stated) |
| `territory-control` | (none stated) |
| `idle-incremental` | (none stated) |
| `shopkeeper` | (none stated) |
| `tycoon-lite` | (none stated) |
| `farming-lite` | (none stated) |
| `pet-creature` | (none stated) |
| `colony-lite` | (none stated) |
| `restaurant` | (none stated) |
| `aquarium-terrarium` | (none stated) |
| `exploration-game` | (none stated) |
| `visual-novel` | (none stated) |
| `point-and-click` | (none stated) |
| `interactive-fiction-hybrid` | (none stated) |
| `investigation-game` | (none stated) |
| `museum-exhibit` | (none stated) |
| `escape-room` | (none stated) |
| `microgame-collection` | (none stated) |
| `local-party-game` | (none stated) |
| `physics-toy` | (none stated) |
| `virtual-pet` | (none stated) |
| `dress-up-character-toy` | (none stated) |
| `sandbox-playground` | (none stated) |
| `drawing-game` | (none stated) |
| `fishing-game` | (none stated) |
| `cooking-game` | (none stated) |
| `photography-game` | (none stated) |
