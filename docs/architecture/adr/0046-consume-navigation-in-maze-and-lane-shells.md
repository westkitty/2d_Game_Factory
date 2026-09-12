# ADR-0046: Consume navigation in maze and lane shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 19

## Context

`sw2d.navigation` already ships deterministic grid pathfinding, walkable
occupancy, dynamic blockers and `RouteFollower` (ADR-0022). Three recipes
already required it (`tower-defense`, `lane-defense`, `turn-based-tactics`)
and a committed proof covers the pack. Factory-generated games still ignored
it: `maze-game` was a dummy grid wanderer that did not even require the pack,
and generated `lane-defense` wandered the same dummy grid despite installing
navigation.

Inventing a fog-of-war, spawn-scheduler or combat pack would violate the
live-catalog rule that those leftovers have one consumer each. Restyling
Wave 18 tactics as pathfinding would change a FLAG-seize game without a new
contract. Pairing simple-rts would lie: that leftover is realtime box-select,
and continuous top-down is not this grid.

The two leftovers are not one machine. Maze is player-controlled occupancy
of walkable cells, complete at the exit. Lane is an autonomous follower
along `findPath` that re-paths when the player places a blocker.

## Decision

**Consume the existing `sw2d.navigation` grid/path service. Do not add a
pack, schema, or capability id. Do not invent fog-of-war, spawn scheduling
or combat.**

- **`maze-game`** now requires `sw2d.navigation`. Generated packConfig sets
  `NAV_STARTER = 'maze'`. The grid shell hides the wanderer. Arrows step
  only onto `isWalkable` cells. Occupying the EXIT completes. Fog-of-war,
  minimap and authored maze generation stay leftover.
- **`lane-defense`** generated packConfig sets `NAV_STARTER = 'lane'`. A
  runner follows `createRouteFollower` to BASE. J places a blocker at the
  cursor; a placement that would trap the runner is rolled back. Spawn
  scheduling and combat resolution stay leftover.
- **No third consumer.** Tower-defense, turn-based-tactics and simple-rts
  keep `NAV_STARTER = null`. Overlay maze / lane-defense kits stay local.

`sw2d.navigation` is game-lifetime. The binder removes and redefines its
starter grid on each scene install.

## Consequences

- No new pack. Pack count stays 28. `maze-game` becomes a fourth required
  consumer of `sw2d.navigation`.
- Catalog maturity stays unchanged (`lane-defense` remains proof-validated
  on the frozen proof).
- Overlay maze / lane-defense kits stay local.
- Fog-of-war, authored maze generation, lane-spawn scheduling, combat
  resolution, tower target-selection and RTS box-select stay leftovers.

## Rejected

- **A new maze / lane-defense pack.** `sw2d.navigation` already exists.
- **Pairing tower-defense.** That leftover is target-selection / upgrades,
  not unused pathfinding, and the committed proof already consumes the pack.
- **Pairing simple-rts.** That leftover is realtime box-select, not a grid
  occupancy / route-follow loop.
- **Restyling Wave 18 tactics.** FLAG seize stays the Wave 18 contract.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame
  scheduler, climbing, chase, territory and rail camera still have one live
  consumer each.
