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
| `physics-puzzle` | Physics Puzzle | pointer | tuning | proof-validated |
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
| `base-defense` | Base Defense | top-down | tuning, levels | proof-validated |
| `territory-control` | Territory Control | top-down | tuning, levels, territory | proof-validated |

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
| `dress-up-character-toy` | Dress-Up Character Toy | pointer, ui-simulation | tuning, characters | proof-validated |
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
| `pong` | Local hot-seat turns and simultaneous versus axes are reusable (sw2d.local-play); netcode, gamepads, split-screen cameras and more than two seats are not. |
| `physics-puzzle` | Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content. |
| `maze-game` | (none stated) |
| `rhythm-action` | Visual reaction cues and beat windows are reusable (sw2d.timing); a deterministic music-beat/audio-synchronization system is not. |
| `reaction-timing` | Visual reaction cues and beat windows are reusable (sw2d.timing); a deterministic music-beat/audio-synchronization system is not. |
| `pinball-lite` | (none stated) |
| `tower-defense` | Spatial hover placement via the pointer shell is available but this starter uses the keyboard grid cursor. |
| `lane-defense` | Lane-spawn scheduling and combat resolution are still starter-specific. |
| `auto-battler` | Teams, active turn, selection and turn advance are reusable (sw2d.strategy); autonomous strikes are reusable (sw2d.targeting); the lineup pick is presentation (it does not change the fighting actor) and loadout drafting stays starter-specific. |
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
