# ADR-0050: Consume vehicle.motion in road and craft shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 23

## Context

`endless-driving` already required `sw2d.vehicles`, `sw2d.arcade` and
`sw2d.generation`. The generated vehicle shell never called `arcade.addScore`,
so a factory endless-driving game was just a car in open space. `boat-flight-racer`
already emits `starter-boat` and `starter-flight`, but the shell loaded only
`definitionIds()[0]`, so flight never appeared.

Inventing a kart item-fire pack would duplicate a 1-consumer leftover. Kart
already races through `sw2d.racing`. Restyling racing as endless distance would
lie about checkpoints and laps.

They still share vehicle handling. Road wins by banking distance on
`arcade.score`. Craft wins by switching boat → flight and climbing the 2D
altitude band.

## Decision

**Do not add a pack, schema, or capability id. Do not invent a kart item-fire
or craft-switch engine. Present road vs craft in the vehicle shell.**

- **`endless-driving`** generated packConfig sets `VEHICLE_STARTER = 'road'`.
  Player throttles; `arcade.addScore` from +X distance; complete at score 80.
- **`boat-flight-racer`** generated packConfig sets `VEHICLE_STARTER = 'craft'`.
  J loads `starter-flight`; hold Up + Shift climbs; complete at altitude 80.
- **No third consumer.** Kart-racer, time-trial and asteroids keep
  `VEHICLE_STARTER = null`. Overlay vehicle kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Kart item-fire stays leftover.
- Road-chain generation still emits a NormalizedLevel; the starter drive is
  open-space (dummy ground hidden) so the proof-level strip cannot pin the car.

## Rejected

- **A kart item-fire pack.** Only kart-racer needs on-demand fire.
- **Pairing via `sw2d.racing`.** Endless driving is not laps; boat/flight is
  not a checkpoint race.
- **Loading only `starter-boat`.** The catalog already ships flight.
