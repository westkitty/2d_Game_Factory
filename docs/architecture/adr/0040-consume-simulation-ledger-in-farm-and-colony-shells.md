# ADR-0040: Consume the simulation ledger in farm and colony shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 13

## Context

`farming-lite` and `colony-lite` already required `sw2d.simulation` (resource
ledger + timed jobs). The generated ui-simulation shell never bound it, so
both recipes entered play as dummy OPTIONS. Inventing a crop/season pack
would violate the live-catalog rule that crop-growth has one consumer.
Extending `sw2d.simulation` into farms/colonies would violate the program
rule against genre monoliths.

The two leftovers are not one machine. Farming is plant / grow / harvest
plots to a crop target. Colony is assign workers to gather, then spend
materials on one construction job.

## Decision

**Consume the existing `sw2d.simulation` ledger and jobs. Do not add a pack,
schema, or capability id. Do not invent a crop/season or colony-AI pack.**

- **`farming-lite`** generated packConfig sets `SIMULATION_STARTER = 'farm'`.
  The ui-simulation shell plants a plot (`queueJob`), waits for the job,
  harvests (`addResource('crops')`). Complete at 3 crops.
- **`colony-lite`** generated packConfig sets `SIMULATION_STARTER = 'colony'`.
  Workers gather (`queueJob` + `addResource('materials')`). Build consumes
  2 materials and queues a construct job. Complete when the hall is built.
- **No third consumer.** Idle-incremental stays on its frozen proof.
  Shop/kitchen/factory stay on `sw2d.economy`. Pets stay on `sw2d.needs`.

Plot slots, worker slots and the harvest/build goals are game-specific
presentation in `bindStarterSimulation`. Overlay farming/colony kits stay
local (P3-J).

## Consequences

- No new pack. Pack count stays 28. `sw2d.simulation` required consumers
  already included these two recipes.
- Catalog maturity stays unchanged.
- Overlay farming/colony kits stay local.

## Rejected

- **A crop-growth / season / plot pack.** Only farming-lite needs seasons.
- **Extending `sw2d.simulation` with farm/colony config.** The pack's own
  comment names farms and colonies as what it is *not*.
- **A mega-pack of leftover Tier-3/4 singles.** Climbing, chase, territory,
  pinball, rail camera and run-meta still have one live consumer each.
