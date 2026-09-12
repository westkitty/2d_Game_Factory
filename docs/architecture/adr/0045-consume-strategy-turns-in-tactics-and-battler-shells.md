# ADR-0045: Consume strategy turns in tactics and battler shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 18

## Context

`turn-based-tactics` and `auto-battler` already required `sw2d.strategy`
(teams / active turn / selection / turn advance). The generated grid and
ui-simulation shells never bound it. Tactics entered play as a dummy grid
wanderer; battler as dummy OPTIONS. Inventing a pathfinding, attack-range
or autonomous-combat pack would violate the live-catalog rule that each
leftover has one consumer, and would duplicate a turn service that already
exists.

The two leftovers are not one machine. Tactics is discrete cell movement
after selecting a unit, complete when occupying a FLAG. Battler is a menu
of fighters that strike on confirm and wait out the CPU turn. They share
the existing strategy service. Simple-rts is realtime box-select, not
turns. Territory-control is capture-zones, not turns.

## Decision

**Consume the existing `sw2d.strategy` turn/team/selection service. Do not
add a pack, schema, or capability id. Do not invent attack-range or
autonomous combat.**

- **`turn-based-tactics`** generated packConfig sets `STRATEGY_STARTER = 'tactics'`.
  The grid shell hides the wanderer. J selects the scout; arrows move the
  selected unit one cell per press. Occupying the FLAG completes. Attack
  range stays leftover.
- **`auto-battler`** generated packConfig sets `STRATEGY_STARTER = 'battler'`.
  Arrows pick FOX / BEAR / OWL. Enter strikes via `combat.health` (CPU
  health 2). The CPU turn auto-`advanceTurn`s after ~400 ms. Autonomous
  combat orchestration stays leftover.
- **No third consumer.** Simple-rts, territory-control, tower-defense and
  lane-defense keep `STRATEGY_STARTER = null`. Overlay tactics / auto-battler
  kits stay local (P3-C / P3-B).

`sw2d.strategy` is game-lifetime. The binder registers teams only if empty
and heals CPU health on rebind.

## Consequences

- No new pack. Pack count stays 28. `sw2d.strategy` required consumers
  already included these two recipes.
- Catalog maturity stays unchanged (`turn-based-tactics` remains
  proof-validated on the frozen proof).
- Overlay tactics / auto-battler kits stay local.
- Attack-range / line-of-fire, autonomous combat orchestration, RTS
  box-select and capture-zones stay leftovers.

## Rejected

- **A new tactics / auto-battler pack.** `sw2d.strategy` already exists.
- **Pairing simple-rts.** That leftover is realtime box-select and a
  command queue, not `strategy.turns`.
- **Pairing territory-control.** That leftover is capture-zones, not turns.
- **Claiming capture-zones or autonomous combat** from teams / select /
  `advanceTurn` alone.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame
  scheduler, climbing, chase, territory and rail camera still have one live
  consumer each.
