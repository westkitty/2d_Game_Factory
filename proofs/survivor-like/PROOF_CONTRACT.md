# Proof Contract — survivor-like

Capability program Phase 13 secondary proof consumer.

## Preset

`survivor-like` (`packages/presets/src/catalog/topDownAction.ts`) — controller family
`top-down`, required packs `sw2d.combat` + `sw2d.encounters` + `sw2d.progression` + `sw2d.runs` + `game.survivor-shell`.

## Reusable capabilities exercised

- `sw2d.runs` (`RunService`) — provides `progression.runs`.
  - Arena wave clear recording (`runs.recordWaveCleared()`).
  - Kill recording and transient currency accrual (`runs.recordKill()`, `runs.addTransientCurrency()`).
  - Survival time victory condition evaluation.
  - Per-attempt reset and seed advancement.
- `sw2d.encounters` (`EncountersService`) — arena wave spawning.
- `sw2d.progression` (`ProgressionService`) — persistent meta-progression across runs.
- `sw2d.combat` (`CombatService`) — player health and combat damage.

## Defining journey (automated, real-browser, 10-step verification)

1. Boot into arena.
2. Attempt = 1, wave 1 active.
3. Wave spawns enemies via `sw2d.encounters`.
4. Player defeats wave enemies (kills recorded in `RunStats`).
5. Wave cleared recorded (`runs.recordWaveCleared()`).
6. Wave timer/duration progresses.
7. Transient currency accumulates per wave.
8. Upgrade choice offered and purchased from run upgrade pool.
9. Player survives to target duration/waves -> winRun triggered -> meta progression rewards delivered.
10. Reset -> attempt = 2, wave counter resets, meta upgrades retained.
