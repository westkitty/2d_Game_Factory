# Proof Contract — time-trial-racer

Frozen before implementation. Capability program Phase 10 (ADR-0027) proof consumer B.

## Preset

`time-trial-racer` (`packages/presets/src/catalog/vehicleMovement.ts`) — controller family
`vehicle`, required packs `sw2d.world` + `sw2d.world-entities` + `sw2d.arcade` +
`sw2d.vehicles` + `sw2d.racing`, content roles `tuning`, `levels`, `vehicles`, `races`.

## Reusable capabilities exercised

- Same `sw2d.vehicles` (`VehicleService`) and `sw2d.racing` (`RaceService`) as the
  top-down-racer proof, in **`time-trial` mode**: one timed lap, a 1.5 s countdown, best-lap /
  best-total persistence through `context.saves` (`racingPack` `config.persist`).

## Game-specific code (`src/game-specific/shellPack.ts`)

- The same autopilot. `CONFIRM` starts the run; `PRIMARY_ACTION` restarts the attempt;
  `SECONDARY_ACTION` fires an out-of-order checkpoint; holding `INTERACT` throttles the
  autopilot down to 0.35 so the first attempt is deliberately slow.

## Terminal success / failure oracle (debug snapshot `game.vehicle-shell`)

`phase`, `countdownRemainingMs`, `elapsedMs`, `expectedCheckpoint`, `finished`, `lapCount`,
`bestTotalMs`, `bestLapMs`, `lastShortcutCounted`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; hold `INTERACT` (slow autopilot); `CONFIRM` → run starts. `phase === 'countdown'`.
2. Countdown elapses → `phase === 'racing'`, `elapsedMs` starts climbing (a live timer, not
   wall-clock).
3. `SECONDARY_ACTION` → `lastShortcutCounted === false`; the run is not registered as
   complete.
4. The slow autopilot completes the ordered lap → `finished === true`, `lapCount === 1`,
   `bestTotalMs` set to this (slow) time.
5. `PRIMARY_ACTION` restarts: `phase === 'idle'`, `elapsedMs === 0`, `finished === false`;
   `bestTotalMs` retained.
6. Release `INTERACT` (full-speed autopilot); `CONFIRM` again; run the lap → `finished`,
   and `bestTotalMs` is now **less than** the first attempt's time (a better valid run
   updates the best; the service never accepts an invalid checkpoint sequence as a run).

## Acceptance

- One reusable vehicle system and one reusable race/checkpoint service, shared with the
  race proof.
- Countdown + an active elapsed timer on simulation time.
- Invalid shortcut rejected; the service never records an out-of-order sequence as a
  completed run.
- Restart resets the current attempt; a better later attempt updates the persisted best.
