# Proof Contract — action-roguelite

Capability program Phase 13 primary defining proof consumer.

## Preset

`action-roguelite` (`packages/presets/src/catalog/topDownAction.ts`) — controller family
`top-down`, required packs `sw2d.combat` + `sw2d.progression` + `sw2d.generation` + `sw2d.items` + `sw2d.runs` + `game.action-roguelite-shell`.

## Reusable capabilities exercised

- `sw2d.runs` (`RunService`) — provides `progression.runs`.
  - Run lifecycle: startRun, winRun, loseRun, resetRun.
  - Deterministic seed progression across attempts (mulberry32).
  - Transient per-run state: transient currency, transient upgrades, run stats.
  - Permadeath run reset: wipes transient state while preserving progression.
- `sw2d.progression` (`ProgressionService`) — provides `progression.state`.
  - Persistent meta-currency and XP carried across runs and resets.
  - Permanent unlocks (e.g. `meta-health-boost`) persisting across attempts.
- `sw2d.generation` (`GenerationService`) — room-graph procedural dungeon.
- `sw2d.items` (`ItemsService`) — starting items, inventory pickups, consumables.

## Defining journey (automated, real-browser, 18-step verification)

1. Boot and initial idle/active run state.
2. Initial attempt = 1, initial duration = 0, initial seed derived deterministically.
3. Player spawns in the generated entrance room.
4. Player collects transient currency and items.
5. Player clears room / records room clear stats.
6. Player takes damage and deals damage (stats advance).
7. Player purchases transient upgrade with transient currency; verify effect/state.
8. Player dies (defeat condition triggers endRun).
9. Run outcome = defeat; transient currency wiped; attempt stats finalized.
10. Meta-currency earned from run carries into ProgressionService.
11. Reset run advances attempt = 2; seed advances deterministically.
12. Player purchases permanent meta-upgrade with meta-currency via ProgressionService.
13. Permanent unlock persists across resets.
14. Player starts attempt 2 with advanced seed and permanent meta-bonus.
15. Player defeats final objective / boss room.
16. Run outcome = victory; victory rewards granted to ProgressionService.
17. Resumable run save verified (if active) or cleanly cleaned up.
18. Clean scene teardown without leaked event listeners or dangling timers.
