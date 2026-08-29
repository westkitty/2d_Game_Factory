# ADR-0027: Vehicle handling and race state are two separate pure capabilities

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 10 (Sonnet 5)

## Context

`top-down-racer`, `kart-racer`, `time-trial-racer`, `endless-driving` and
`boat-flight-racer` carried `LIMITATIONS.vehicleIntentOnly` +
`LIMITATIONS.raceOrchestration`: "the vehicle controller supplies intent only;
no reusable vehicle-physics / drift / handling system exists" and "lap /
checkpoint / time-trial orchestration is not a dedicated reusable system".

## Decision

**Two separate renderer-neutral, pure, simulation-time capabilities. The
`vehicleController` (ADR-0009) stays INPUT INTENT ONLY.**

- **`sw2d.vehicles` → `vehicle.motion`.** `VehicleService.load(vehicleId,
  spawn)` then `update(deltaMs, VehicleIntent, surfaceTag?) → VehicleState`.
  One reusable update with **four bounded profiles** (`car` / `kart` / `boat` /
  `flight` - not four engines), each a `VehicleDefinition` of bounded tuning
  (acceleration / braking / reverse / max speeds / steering rate /
  speed-sensitive steering / drag / lateral grip / traction / drift factor /
  boost force+duration+cooldown, plus flight altitude band). Tagged surfaces
  apply bounded multipliers (`traction` / `drag` / `maxSpeed` / `steering`).
  Boost uses **simulation time** (`deltaMs`), never `Date.now`. Pure and
  deterministic - lives in `@sw2d/packs` (no Phaser).
- **`sw2d.racing` → `race.state`.** `RaceService.load` / `startRace` /
  `tick(deltaMs)` / `checkpointEntered(id)` / `expectedCheckpoint` /
  `raceState`. Ordered checkpoints; entering one out of order **never** advances
  the race, so a shortcut cannot complete a lap. `race` and `time-trial` modes;
  a countdown and an elapsed timer, both on simulation time. Best lap / best
  total persist through `context.saves` when `config.persist` is set (ids +
  times only). Also pure, in `@sw2d/packs`.
- **`content/vehicles.json`** (schema `vehicle-catalog`, document `vehicles`)
  and **`content/races.json`** (schema `race-catalog`, document `races`), always
  emitted. `PresetDefinition.vehicleProfile` selects the starter vehicle's
  profile; the generator writes both documents.
- **The generated `vehicleShellPack`** installs both services when present:
  `VehicleIntent` → `VehicleService.update` → the sprite; `CONFIRM` starts the
  race; a checkpoint circle test reports crossings. An arcade fallback keeps the
  shell runnable without the packs.
- **Kart items are Phase-2 items.** No `KartItemDefinition`; item boxes are
  `Collectible` Tiled objects that grant canonical `sw2d.items` entries.
- **Endless Driving** consumes Phase-7 road generation + Phase-10 vehicle
  handling; **Boat/Flight** ships the bounded boat and flight profiles.
- **Workbench**: `POST /api/racing/inspect` + an inspector panel (vehicle
  profile + handling numbers + surface tags; race mode, laps, countdown,
  ordered checkpoint ids).

## Consequences

- Proof consumers: `proofs/top-down-racer/` (the car is `sw2d.vehicles`; the
  race is `sw2d.racing` - four ordered checkpoints, two laps; an out-of-order
  checkpoint never advances a lap; two valid laps finish; restart clears all
  race state) and `proofs/time-trial-racer/` (same services, `time-trial` mode -
  a countdown, a live elapsed timer, an invalid-shortcut rejection, a finish, a
  restart that resets the attempt, and a second faster attempt that updates the
  persisted best). `qa:proof` 21/21 → 23/23.
- All five vehicle recipes require `sw2d.vehicles` (`top-down-racer`,
  `kart-racer`, `time-trial-racer` also require `sw2d.racing`).
  `LIMITATIONS.vehicleIntentOnly` and `LIMITATIONS.raceOrchestration` **removed**
  (both constants deleted). `kart-racer` keeps a narrow "hold/fire a kart item
  on demand is game-specific code" limitation; `boat-flight-racer` keeps "the
  boat/flight profiles are bounded arcade handling, not fluid/aerodynamic
  simulation". Nineteen packs now have a preset consumer.

## Rejected

- **One combined vehicle+racing capability.** Movement and race rules are
  genuinely separate concerns with separate persistence and separate consumers
  (endless-driving needs the vehicle, not a race).
- **Moving handling into `vehicleController`.** The controller is intent only
  (ADR-0009); handling is a service that consumes that intent.
- **Four vehicle engines.** Four bounded tuning profiles of one update.
- **A `KartItemDefinition` schema.** Phase 2's `sw2d.items` already owns item
  definitions and effects.
- **A track format separate from normalized levels.** Track collision and
  surface tags are normalized level data; race definitions reference checkpoint
  positions directly.
- **Wall-clock race timing.** `tick(deltaMs)` accumulates simulation time.
