# Preset Capability Matrix

Which real `@sw2d/packs` packs, controller families, input modes and validation profile
each of the 74 registered recipes actually composes - the complete catalog
(MASTER_PROJECT.md section 21). Pack ids are shown without the `sw2d.` prefix for width;
`PACK_IDS`/`CAPABILITY_IDS` in `packages/packs/src/ids.ts` carry the real values.
Mechanically checked against the catalog by
`packages/presets/test/catalogPackIntegrity.test.ts` (every pack id here is real and
every selection set resolves through the real `resolveInstallOrder`) and
`packages/presets/test/docsSync.test.ts`.

Maturity (`recipe` vs. `smoke-validated`) is not shown here - see
[`PRESET_CATALOG.md`](PRESET_CATALOG.md) for that, and
[`DEMO_MATRIX.md`](../demos/DEMO_MATRIX.md) for the twelve Phase 8 demos this matrix's
pack/controller selections were actually exercised through.

## Platforming (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `traditional-platformer` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `chase-platformer` | world, world-entities | combat, arcade | platform | keyboard, touch | platform-recipe |
| `endless-runner` | arcade | world, world-entities | platform | keyboard, touch | platform-recipe |
| `precision-platformer` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `metroidvania` | world, world-entities, progression | combat, ai | platform | keyboard, touch | platform-recipe |
| `puzzle-platformer` | puzzle, world, world-entities | - | platform, grid | keyboard, touch | platform-recipe |
| `auto-runner` | arcade | world, world-entities | platform | keyboard, touch | platform-recipe |
| `climbing-game` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `grappling-platformer` | world, world-entities | arcade | platform | keyboard, touch | platform-recipe |
| `collectathon-platformer` | world, world-entities, arcade | progression | platform | keyboard, touch | platform-recipe |

## Top-down action (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `top-down-adventure` | world, world-entities | narrative, progression | top-down | keyboard, touch | top-down-action-recipe |
| `action-adventure` | world, world-entities, combat | ai, progression | top-down | keyboard, touch | top-down-action-recipe |
| `twin-stick-shooter` | combat | world, world-entities, arcade | top-down | keyboard, touch | top-down-action-recipe |
| `survivor-like` | combat, ai, progression | arcade, world | top-down | keyboard, touch | top-down-action-recipe |
| `dungeon-crawler` | world, world-entities, combat | ai, progression | top-down | keyboard, touch | top-down-action-recipe |
| `action-roguelite` | combat, progression | ai, world, world-entities | top-down | keyboard, touch | top-down-action-recipe |
| `stealth-game` | ai, combat, world | world-entities | top-down | keyboard, touch | top-down-action-recipe |
| `heist-game` | ai, combat, world | world-entities, progression | top-down | keyboard, touch | top-down-action-recipe |
| `arena-combat` | combat | ai, arcade | top-down | keyboard, touch | top-down-action-recipe |
| `boss-rush` | combat, ai | arcade | top-down | keyboard, touch | top-down-action-recipe |

## Shooter (Phase 7A)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `horizontal-shmup` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `vertical-shmup` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `bullet-hell` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `asteroids-shooter` | combat | arcade | vehicle | keyboard, touch | shooter-recipe |
| `gallery-shooter` | combat | arcade | pointer | keyboard, pointer, touch | shooter-recipe |
| `run-and-gun` | combat, world, world-entities | arcade | platform | keyboard, touch | shooter-recipe |
| `rail-shooter` | combat | arcade | pointer | keyboard, pointer, touch | shooter-recipe |

## Vehicle / movement (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `top-down-racer` | world, world-entities | arcade | vehicle | keyboard, touch | vehicle-movement-recipe |
| `kart-racer` | world, world-entities | arcade | vehicle | keyboard, touch | vehicle-movement-recipe |
| `time-trial-racer` | world, world-entities, arcade | - | vehicle | keyboard, touch | vehicle-movement-recipe |
| `endless-driving` | arcade | world, world-entities | vehicle | keyboard, touch | vehicle-movement-recipe |
| `boat-flight-racer` | world, world-entities | arcade | vehicle | keyboard, touch | vehicle-movement-recipe |

## Puzzle / arcade (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `sokoban` | puzzle | - | grid | keyboard, touch | puzzle-arcade-recipe |
| `match-puzzle` | puzzle | arcade | grid | keyboard, touch | puzzle-arcade-recipe |
| `falling-block-puzzle` | puzzle | arcade | grid, ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `breakout` | arcade | - | top-down | keyboard, touch | puzzle-arcade-recipe |
| `pong` | arcade | - | top-down | keyboard, touch | puzzle-arcade-recipe |
| `physics-puzzle` | puzzle | - | pointer | keyboard, pointer, touch | puzzle-arcade-recipe |
| `maze-game` | world, world-entities | arcade | grid | keyboard, touch | puzzle-arcade-recipe |
| `rhythm-action` | arcade | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `reaction-timing` | arcade | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |
| `pinball-lite` | arcade | - | ui-simulation | keyboard, touch | puzzle-arcade-recipe |

## Strategy / defense (Phase 7B)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `tower-defense` | world, world-entities, progression, combat | ai | grid, pointer | keyboard, pointer, touch | strategy-defense-recipe |
| `lane-defense` | world, world-entities, progression | combat | grid, pointer | keyboard, pointer, touch | strategy-defense-recipe |
| `auto-battler` | strategy, combat, ai | progression | ui-simulation | keyboard, touch | strategy-defense-recipe |
| `simple-rts` | strategy, combat | ai, world, world-entities | top-down | keyboard, touch | strategy-defense-recipe |
| `turn-based-tactics` | strategy, combat | ai, world, world-entities | grid, ui-simulation | keyboard, touch | strategy-defense-recipe |
| `base-defense` | world, world-entities, combat | ai, progression | top-down | keyboard, touch | strategy-defense-recipe |
| `territory-control` | world, world-entities, strategy, combat | ai | top-down | keyboard, touch | strategy-defense-recipe |

## Simulation / management (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `idle-incremental` | simulation, progression | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `shopkeeper` | simulation, progression | world | ui-simulation | keyboard, touch | simulation-management-recipe |
| `tycoon-lite` | simulation, progression | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `farming-lite` | simulation, world | progression | ui-simulation | keyboard, touch | simulation-management-recipe |
| `pet-creature` | simulation, progression | world | ui-simulation | keyboard, touch | simulation-management-recipe |
| `colony-lite` | simulation, world | progression | ui-simulation | keyboard, touch | simulation-management-recipe |
| `restaurant` | simulation, progression | arcade | ui-simulation | keyboard, touch | simulation-management-recipe |
| `aquarium-terrarium` | simulation | progression | ui-simulation | keyboard, touch | simulation-management-recipe |

## Narrative / exploration (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `exploration-game` | world, world-entities | narrative | top-down | keyboard, touch | narrative-exploration-recipe |
| `visual-novel` | narrative | progression | ui-simulation | keyboard, touch | narrative-exploration-recipe |
| `point-and-click` | narrative, world, world-entities | puzzle | pointer, ui-simulation | keyboard, pointer, touch | narrative-exploration-recipe |
| `interactive-fiction-hybrid` | narrative | world | ui-simulation | keyboard, touch | narrative-exploration-recipe |
| `investigation-game` | narrative, world, world-entities | puzzle | top-down, pointer | keyboard, pointer, touch | narrative-exploration-recipe |
| `museum-exhibit` | world, world-entities | narrative | top-down, pointer | keyboard, pointer, touch | narrative-exploration-recipe |
| `escape-room` | puzzle | narrative, world | pointer, ui-simulation | keyboard, pointer, touch | narrative-exploration-recipe |

## Party / toy / weird (Phase 7C)

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `microgame-collection` | arcade | progression | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `local-party-game` | arcade | combat | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `physics-toy` | - | puzzle | pointer | keyboard, pointer, touch | party-toy-weird-recipe |
| `virtual-pet` | simulation, progression | world | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `dress-up-character-toy` | - | progression | pointer, ui-simulation | keyboard, pointer, touch | party-toy-weird-recipe |
| `sandbox-playground` | world, world-entities | puzzle | pointer, ui-simulation | keyboard, pointer, touch | party-toy-weird-recipe |
| `drawing-game` | - | arcade | pointer | keyboard, pointer, touch | party-toy-weird-recipe |
| `fishing-game` | arcade | progression | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `cooking-game` | arcade | progression, simulation | ui-simulation | keyboard, touch | party-toy-weird-recipe |
| `photography-game` | world, world-entities | arcade | top-down, pointer | keyboard, pointer, touch | party-toy-weird-recipe |

## Full pack-consumer coverage (all 74 recipes)

| short id | real pack id | capability id | recipes requiring it | recipes referencing it (required or optional) |
|---|---|---|---|---|
| combat | `sw2d.combat` | `combat.health` | 22 | 26 |
| ai | `sw2d.ai` | `ai.state` | 5 | 15 |
| world | `sw2d.world` | `world.state` | 31 | 44 |
| world-entities | `sw2d.world-entities` | `world.entities` | 27 | 36 |
| progression | `sw2d.progression` | `progression.state` | 11 | 26 |
| arcade | `sw2d.arcade` | `arcade.score` | 14 | 41 |
| puzzle | `sw2d.puzzle` | `puzzle.state` | 6 | 10 |
| simulation | `sw2d.simulation` | `simulation.resources` | 9 | 10 |
| narrative | `sw2d.narrative` | `narrative.state` | 4 | 8 |
| strategy | `sw2d.strategy` | `strategy.turns` | 4 | 4 |

**All ten current packs have at least one preset consumer** as of Phase 7C - the last
gap (`sw2d.simulation`) is closed by Family G, whose recipes are built around a
resource ledger by genuine identity, not to manufacture coverage (see
`packages/presets/src/catalog/simulationManagement.ts`).

## Validation profiles

Nine, one per registered family (MASTER_PROJECT.md section 14/6/8 - a bounded set, not
one per recipe): `platform-recipe`, `top-down-action-recipe`, `shooter-recipe` (Phase 7A),
`vehicle-movement-recipe`, `puzzle-arcade-recipe`, `strategy-defense-recipe` (Phase 7B),
`simulation-management-recipe`, `narrative-exploration-recipe`, `party-toy-weird-recipe`
(Phase 7C).
