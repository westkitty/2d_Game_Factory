# Preset Capability Matrix

Which real `@sw2d/packs` packs, controller families, input modes and validation profile
each of the 74 registered recipes actually composes - the complete catalog
(MASTER_PROJECT.md section 21). Pack ids are shown without the `sw2d.` prefix for width;
`PACK_IDS`/`CAPABILITY_IDS` in `packages/packs/src/ids.ts` carry the real values.
Mechanically checked against the catalog by
`packages/presets/test/catalogPackIntegrity.test.ts` (every pack id here is real and
every selection set resolves through the real `resolveInstallOrder`) and
`packages/presets/test/docsSync.test.ts`.

Maturity (`recipe` vs. `smoke-validated` vs. `proof-validated`) is not shown here - see
[`PRESET_CATALOG.md`](PRESET_CATALOG.md) for that,
[`DEMO_MATRIX.md`](../demos/DEMO_MATRIX.md) for the twelve Phase 8 demos this matrix's
pack/controller selections were actually exercised through, and
[`PROOF_MATRIX.md`](../proofs/PROOF_MATRIX.md) for the five Phase 10 deep proofs among them.

## Platforming (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `traditional-platformer` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `chase-platformer` | world, world-entities, pursuit | combat, arcade | platform | keyboard, touch | platform-recipe |
| `endless-runner` | arcade, generation, pursuit | world, world-entities | platform | keyboard, touch | platform-recipe |
| `precision-platformer` | world, world-entities, wall | arcade | platform | keyboard, touch | platform-recipe |
| `metroidvania` | world, world-entities, progression, world-graph | combat, ai | platform | keyboard, touch | platform-recipe |
| `puzzle-platformer` | puzzle-rules, world, world-entities | - | platform, grid | keyboard, touch | platform-recipe |
| `auto-runner` | arcade, generation, pursuit | world, world-entities | platform | keyboard, touch | platform-recipe |
| `climbing-game` | world, world-entities, wall | arcade | platform | keyboard, touch | platform-recipe |
| `grappling-platformer` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `collectathon-platformer` | world, world-entities, arcade, items | progression | platform | keyboard, touch | platform-recipe |
## Top-down action (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `top-down-adventure` | world, world-entities | narrative, progression | top-down | keyboard, touch | top-down-action-recipe |
| `action-adventure` | world, world-entities, combat, weapons, melee | ai, progression | top-down | keyboard, touch | top-down-action-recipe |
| `twin-stick-shooter` | combat, weapons, encounters | world, world-entities, arcade | top-down | keyboard, touch | top-down-action-recipe |
| `survivor-like` | combat, ai, progression, weapons, encounters, runs | arcade, world | top-down | keyboard, touch | top-down-action-recipe |
| `dungeon-crawler` | world, world-entities, combat, generation, ai | progression | top-down | keyboard, touch | top-down-action-recipe |
| `action-roguelite` | combat, progression, generation, ai, runs | world, world-entities | top-down | keyboard, touch | top-down-action-recipe |
| `stealth-game` | ai, combat, world, perception | world-entities, navigation | top-down | keyboard, touch | top-down-action-recipe |
| `heist-game` | ai, combat, world, perception | world-entities, progression, navigation | top-down | keyboard, touch | top-down-action-recipe |
| `arena-combat` | combat, weapons, encounters, melee | ai, arcade | top-down | keyboard, touch | top-down-action-recipe |
| `boss-rush` | combat, ai, weapons, encounters | arcade | top-down | keyboard, touch | top-down-action-recipe |
## Shooter (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `horizontal-shmup` | combat, weapons, encounters, stage-scroll | arcade | top-down | keyboard, touch | shooter-recipe |
| `vertical-shmup` | combat, weapons, encounters, stage-scroll | arcade | top-down | keyboard, touch | shooter-recipe |
| `bullet-hell` | combat, weapons, encounters | arcade | top-down | keyboard, touch | shooter-recipe |
| `asteroids-shooter` | combat, weapons, vehicles, arcade | - | vehicle | keyboard, touch | shooter-recipe |
| `gallery-shooter` | combat, weapons, encounters, arcade | - | pointer | keyboard, pointer, touch | shooter-recipe |
| `run-and-gun` | combat, world, world-entities, weapons, encounters | arcade | platform | keyboard, touch | shooter-recipe |
| `rail-shooter` | combat, camera, weapons, encounters, arcade | - | pointer | keyboard, pointer, touch | shooter-recipe |
## Vehicle / movement (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `top-down-racer` | world, world-entities, vehicles, racing | arcade | vehicle | keyboard, touch | vehicle-movement-recipe |
| `kart-racer` | world, world-entities, vehicles, racing | arcade, items | vehicle | keyboard, touch | vehicle-movement-recipe |
| `time-trial-racer` | world, world-entities, arcade, vehicles, racing | - | vehicle | keyboard, touch | vehicle-movement-recipe |
| `endless-driving` | arcade, generation, vehicles | world, world-entities | vehicle | keyboard, touch | vehicle-movement-recipe |
| `boat-flight-racer` | world, world-entities, vehicles | arcade, racing | vehicle | keyboard, touch | vehicle-movement-recipe |
## Puzzle / arcade (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `sokoban` | puzzle-rules | - | grid | keyboard, touch | puzzle-arcade-recipe |
| `match-puzzle` | puzzle-rules | arcade | grid | keyboard, touch | puzzle-arcade-recipe |
| `falling-block-puzzle` | puzzle-rules | arcade | grid, ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `breakout` | arcade, ball-paddle | - | top-down | keyboard, touch | puzzle-arcade-recipe |
| `pong` | arcade, ball-paddle, local-play | - | top-down | keyboard, touch | puzzle-arcade-recipe |
| `physics-puzzle` | puzzle | - | pointer | keyboard, pointer, touch | puzzle-arcade-recipe |
| `maze-game` | world, world-entities, navigation | arcade | grid | keyboard, touch | puzzle-arcade-recipe |
| `rhythm-action` | arcade, timing | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `reaction-timing` | arcade, timing | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `pinball-lite` | arcade, pinball | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |
## Strategy / defense (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `tower-defense` | world, world-entities, progression, combat, navigation, targeting | ai | grid, pointer | keyboard, pointer, touch | strategy-defense-recipe |
| `lane-defense` | world, world-entities, progression, navigation | combat | grid, pointer | keyboard, pointer, touch | strategy-defense-recipe |
| `auto-battler` | strategy, combat, ai, targeting | progression | ui-simulation | keyboard, touch | strategy-defense-recipe |
| `simple-rts` | strategy, combat, territory | ai, world, world-entities, navigation | top-down | keyboard, touch | strategy-defense-recipe |
| `turn-based-tactics` | strategy, combat, navigation, targeting | ai, world, world-entities | grid, ui-simulation | keyboard, touch | strategy-defense-recipe |
| `base-defense` | world, world-entities, combat | ai, progression, encounters | top-down | keyboard, touch | strategy-defense-recipe |
| `territory-control` | world, world-entities, strategy, combat, territory | ai | top-down | keyboard, touch | strategy-defense-recipe |
## Simulation / management (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `idle-incremental` | simulation, progression | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `shopkeeper` | simulation, progression, economy | world | ui-simulation | keyboard, touch | simulation-management-recipe |
| `tycoon-lite` | simulation, progression, economy | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `farming-lite` | simulation, world | progression | ui-simulation | keyboard, touch | simulation-management-recipe |
| `pet-creature` | simulation, progression, needs | world | ui-simulation | keyboard, touch | simulation-management-recipe |
| `colony-lite` | simulation, world | progression, navigation | ui-simulation | keyboard, touch | simulation-management-recipe |
| `restaurant` | simulation, progression, economy | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `aquarium-terrarium` | simulation, needs | progression | ui-simulation | keyboard, touch | simulation-management-recipe |
## Narrative / exploration (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `exploration-game` | world, world-entities, world-graph | narrative | top-down | keyboard, touch | narrative-exploration-recipe |
| `visual-novel` | narrative, dialogue | progression | ui-simulation | keyboard, touch | narrative-exploration-recipe |
| `point-and-click` | narrative, world, world-entities, dialogue | puzzle | pointer, ui-simulation | keyboard, pointer, touch | narrative-exploration-recipe |
| `interactive-fiction-hybrid` | narrative | world | ui-simulation | keyboard, touch | narrative-exploration-recipe |
| `investigation-game` | narrative, world, world-entities, codex | puzzle | top-down, pointer | keyboard, pointer, touch | narrative-exploration-recipe |
| `museum-exhibit` | world, world-entities, codex | narrative | top-down, pointer | keyboard, pointer, touch | narrative-exploration-recipe |
| `escape-room` | puzzle | narrative, world | pointer, ui-simulation | keyboard, pointer, touch | narrative-exploration-recipe |
## Party / toy / weird (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `microgame-collection` | arcade | progression | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `local-party-game` | arcade, local-play | combat | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `physics-toy` | - | puzzle | pointer | keyboard, pointer, touch | party-toy-weird-recipe |
| `virtual-pet` | simulation, progression, needs | world | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `dress-up-character-toy` | - | progression | pointer, ui-simulation | keyboard, pointer, touch | party-toy-weird-recipe |
| `sandbox-playground` | world, world-entities | puzzle | pointer, ui-simulation | keyboard, pointer, touch | party-toy-weird-recipe |
| `drawing-game` | - | arcade | pointer | keyboard, pointer, touch | party-toy-weird-recipe |
| `fishing-game` | arcade | progression | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `cooking-game` | arcade | progression, simulation | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `photography-game` | world, world-entities, camera | arcade | top-down, pointer | keyboard, pointer, touch | party-toy-weird-recipe |
## Full pack-consumer coverage (all 74 recipes)

| short id | real pack id | capability id | recipes requiring it | recipes referencing it (required or optional) |
|---|---|---|---|---|
| combat | `sw2d.combat` | `combat.health` | 22 | 26 |
| ai | `sw2d.ai` | `ai.state` | 7 | 15 |
| world | `sw2d.world` | `world.state` | 31 | 44 |
| world-entities | `sw2d.world-entities` | `world.entities` | 27 | 36 |
| progression | `sw2d.progression` | `progression.state` | 11 | 26 |
| arcade | `sw2d.arcade` | `arcade.score` | 17 | 41 |
| puzzle | `sw2d.puzzle` | `puzzle.state` | 2 | 6 |
| simulation | `sw2d.simulation` | `simulation.resources` | 9 | 10 |
| narrative | `sw2d.narrative` | `narrative.state` | 4 | 8 |
| strategy | `sw2d.strategy` | `strategy.turns` | 4 | 4 |
| items | `sw2d.items` | `items.state` | 1 | 2 |
| weapons | `sw2d.weapons` | `combat.weapons` | 12 | 12 |
| encounters | `sw2d.encounters` | `combat.encounters` | 10 | 11 |
| navigation | `sw2d.navigation` | `world.navigation` | 4 | 8 |
| puzzle-rules | `sw2d.puzzle-rules` | `puzzle.rules` | 4 | 4 |
| generation | `sw2d.generation` | `world.generation` | 5 | 5 |
| world-graph | `sw2d.world-graph` | `world.graph` | 2 | 2 |
| vehicles | `sw2d.vehicles` | `vehicle.motion` | 6 | 6 |
| racing | `sw2d.racing` | `race.state` | 3 | 4 |
| economy | `sw2d.economy` | `simulation.economy` | 3 | 3 |
| needs | `sw2d.needs` | `simulation.needs` | 3 | 3 |
| dialogue | `sw2d.dialogue` | `narrative.dialogue` | 2 | 2 |
| perception | `sw2d.perception` | `ai.perception` | 2 | 2 |
| ball-paddle | `sw2d.ball-paddle` | `arcade.ball` | 2 | 2 |
| melee | `sw2d.melee` | `combat.melee` | 2 | 2 |
| local-play | `sw2d.local-play` | `arcade.seats` | 2 | 2 |
| stage-scroll | `sw2d.stage-scroll` | `world.scroll` | 2 | 2 |
| timing | `sw2d.timing` | `arcade.timing` | 2 | 2 |
| wall | `sw2d.wall` | `movement.wall` | 2 | 2 |
| territory | `sw2d.territory` | `strategy.zones` | 2 | 2 |
| pinball | `sw2d.pinball` | `arcade.table` | 1 | 1 |
| camera | `sw2d.camera` | `world.camera` | 2 | 2 |
| codex | `sw2d.codex` | `narrative.codex` | 2 | 2 |
| targeting | `sw2d.targeting` | `combat.targeting` | 3 | 3 |
| pursuit | `sw2d.pursuit` | `movement.pursuit` | 3 | 3 |
| runs | `sw2d.runs` | `progression.runs` | 2 | 2 |

**All thirty-four current packs have at least one preset consumer.** `sw2d.items` (capability
program Phase 2) is required by `collectathon-platformer`, whose generated starter consumes
the reusable item/effect service through the shared platform shell. `sw2d.puzzle-rules`
(capability program Phase 6 / Category-C Wave 9) is required by `sokoban`, `puzzle-platformer`,
`match-puzzle` and `falling-block-puzzle`, whose generated starters drive the push/goal,
switch/sequence, match-cascade and falling-piece/line-clear rulesets from the validated
`content/puzzles.json` document. `sw2d.generation` (capability program Phase 7) is required by
`endless-runner`, `auto-runner`, `dungeon-crawler`, `action-roguelite` and `endless-driving`,
whose generated shells build the playable world from a deterministic seed in
`content/generation.json`. `sw2d.world-graph` (capability program Phase 8) is required by
`metroidvania` and `exploration-game`, whose generated shells drive location transitions,
discovery/visited state and the map from `content/world-graph.json`. `sw2d.vehicles`
(`vehicle.motion`) and `sw2d.racing` (`race.state`) - capability program Phase 10 - are
required by the vehicle-movement family; the generated vehicle shell turns `vehicleController`
intent into car/kart/boat/flight motion and runs an ordered-checkpoint race from
`content/vehicles.json` + `content/races.json`. `sw2d.timing` (`arcade.timing`,
Category-C Wave 10) is required by `reaction-timing` and `rhythm-action`, whose
generated ui-simulation shells drive visual reaction cues and beat windows from
`content/timing.json`. Category-C Wave 30 adds `sw2d.wall` (`movement.wall`; `precision-platformer`, `climbing-game`), `sw2d.territory` (`strategy.zones`; `territory-control`, `simple-rts`), `sw2d.pinball` (`arcade.table`; `pinball-lite`), `sw2d.camera` (`world.camera`; `rail-shooter`, `photography-game`), `sw2d.codex` (`narrative.codex`; `museum-exhibit`, `investigation-game`) and `sw2d.targeting` (`combat.targeting`; `tower-defense`, `auto-battler`, `turn-based-tactics`).

## Validation profiles

Nine, one per registered family (MASTER_PROJECT.md section 14/6/8 - a bounded set, not
one per recipe): `platform-recipe`, `top-down-action-recipe`, `shooter-recipe` (Phase 7A),
`vehicle-movement-recipe`, `puzzle-arcade-recipe`, `strategy-defense-recipe` (Phase 7B),
`simulation-management-recipe`, `narrative-exploration-recipe`, `party-toy-weird-recipe`
(Phase 7C).
