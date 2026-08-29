# Proof Contract — top-down-racer

Frozen before implementation. Capability program Phase 10 (ADR-0027) proof consumer A.

## Preset

`top-down-racer` (`packages/presets/src/catalog/vehicleMovement.ts`) — controller family
`vehicle`, required packs `sw2d.world` + `sw2d.world-entities` + `sw2d.vehicles` + `sw2d.racing`,
content roles `tuning`, `levels`, `vehicles`, `races`. Maturity `smoke-validated`.

## Reusable capabilities exercised

- `sw2d.vehicles` (`VehicleService`, `vehicle.motion`) — `load(vehicleId, spawn)` then
  `update(deltaMs, VehicleIntent)` each frame turns steering / throttle / brake intent into
  car motion (heading, forward/lateral speed, position). The `vehicleController` stays intent
  only; no handling math in the shell.
- `sw2d.racing` (`RaceService`, `race.state`) — `startRace()`, `tick(deltaMs)`,
  `expectedCheckpoint()`, `checkpointEntered(id)`. Four ordered checkpoints, **two laps**,
  a 3 s countdown. Simulation time only.

## Game-specific code (`src/game-specific/shellPack.ts`)

- A tiny autopilot: point the wheel at `expectedCheckpoint()` and hold full throttle, so the
  browser journey is deterministic. This is NOT the vehicle model - it only produces a
  `VehicleIntent`.
- `CONFIRM` starts the race. `SECONDARY_ACTION` fires the LAST checkpoint id out of order (a
  deliberate shortcut) and records whether it counted.
- The checkpoint circle test (`hypot(carPos, cp) <= cp.radius → checkpointEntered(cp.id)`).

## Terminal success / failure oracle (debug snapshot `game.vehicle-shell`)

`phase`, `currentLap`, `expectedCheckpoint`, `finished`, `lapCount` (completed laps),
`speed` / `maxSpeed`, `heading`, `lastShortcutCounted`, `shortcutAttempts`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `CONFIRM` → race starts. `phase === 'countdown'`, `currentLap === 1`.
2. Step through the countdown → `phase === 'racing'`, `expectedCheckpoint === 'cp-1'`.
3. The car accelerates (`maxSpeed` climbs well past 100) and steers (heading changes).
4. `SECONDARY_ACTION` → `lastShortcutCounted === false`; `currentLap` and `lapCount`
   unchanged (a skipped-checkpoint shortcut never advances the race).
5. Let the autopilot run the track: after the first full ordered lap `lapCount === 1` and
   `currentLap === 2`; after the second `finished === true`, `lapCount === 2`,
   `phase === 'finished'`, `expectedCheckpoint === null`.
6. Restart the scene (`KeyP`, `KeyK`): a fresh race - `finished === false`, `lapCount === 0`,
   `currentLap` back to the pre-start value. No stale checkpoint state.

## Acceptance

- Vehicle motion is the reusable `sw2d.vehicles` service; the controller stays intent-only.
- Race state is the reusable `sw2d.racing` service; checkpoints count only in order.
- A deliberate out-of-order checkpoint never advances a lap.
- Two valid laps finish the race; restart clears all race state.
