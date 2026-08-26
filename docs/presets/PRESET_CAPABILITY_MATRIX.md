# Preset Capability Matrix

Which real `@sw2d/packs` packs, controller families, input modes and validation profile
each of the 49 registered recipes actually composes. Pack ids are shown without the
`sw2d.` prefix for width; `PACK_IDS`/`CAPABILITY_IDS` in `packages/packs/src/ids.ts` carry
the real values. Mechanically checked against the catalog by
`packages/presets/test/catalogPackIntegrity.test.ts` (every pack id here is real and
every selection set resolves through the real `resolveInstallOrder`) and
`packages/presets/test/docsSync.test.ts`.

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

## Real pack ids referenced above

| short id | real pack id | capability id |
|---|---|---|
| combat | `sw2d.combat` | `combat.health` |
| ai | `sw2d.ai` | `ai.state` |
| world | `sw2d.world` | `world.state` |
| world-entities | `sw2d.world-entities` | `world.entities` |
| progression | `sw2d.progression` | `progression.state` |
| arcade | `sw2d.arcade` | `arcade.score` |
| puzzle | `sw2d.puzzle` | `puzzle.state` |
| narrative | `sw2d.narrative` | `narrative.state` |
| strategy | `sw2d.strategy` | `strategy.turns` |

`sw2d.simulation` is not referenced by any Family A-F recipe - it belongs to genres
Phase 7C registers (simulation/management).

## Validation profiles

Six, one per registered family (MASTER_PROJECT.md section 14 - a bounded set, not one
per recipe): `platform-recipe`, `top-down-action-recipe`, `shooter-recipe` (Phase 7A),
`vehicle-movement-recipe`, `puzzle-arcade-recipe`, `strategy-defense-recipe` (Phase 7B).
