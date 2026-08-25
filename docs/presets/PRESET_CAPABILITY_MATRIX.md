# Preset Capability Matrix

Which real `@sw2d/packs` packs, controller families, input modes and validation profile
each of the 27 Phase 7A recipes actually composes. Pack ids are shown without the
`sw2d.` prefix for width; `PACK_IDS`/`CAPABILITY_IDS` in `packages/packs/src/ids.ts` carry
the real values. Mechanically checked against the catalog by
`packages/presets/test/catalogPackIntegrity.test.ts` (every pack id here is real and
every selection set resolves through the real `resolveInstallOrder`).

## Platforming

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

## Top-down action

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

## Shooter

| id | required packs | optional packs | controller(s) | input modes | validation profile |
|---|---|---|---|---|---|
| `horizontal-shmup` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `vertical-shmup` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `bullet-hell` | combat | arcade | top-down | keyboard, touch | shooter-recipe |
| `asteroids-shooter` | combat | arcade | vehicle | keyboard, touch | shooter-recipe |
| `gallery-shooter` | combat | arcade | pointer | keyboard, pointer, touch | shooter-recipe |
| `run-and-gun` | combat, world, world-entities | arcade | platform | keyboard, touch | shooter-recipe |
| `rail-shooter` | combat | arcade | pointer | keyboard, pointer, touch | shooter-recipe |

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

`sw2d.simulation` and `sw2d.strategy` are not referenced by any Family A-C recipe - both
belong to genres Phase 7B/7C register (simulation/management, strategy/defense).

## Validation profiles

Three, one per family (MASTER_PROJECT.md section 14 - a bounded set, not one per recipe):
`platform-recipe`, `top-down-action-recipe`, `shooter-recipe`.
