# Proof Contract — kart-racer

Frozen before implementation. Category-C Wave 29 (game-specific kart item-fire, ADR-0056) over the Phase 10 `sw2d.vehicles` kart profile + `sw2d.racing`.

## Preset

`kart-racer` (`packages/presets/src/catalog/vehicleMovement.ts`) — controller family `vehicle`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.vehicles`** (kart), **`sw2d.racing`**. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-kart-racer --preset kart-racer` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.racing` countdown / ordered checkpoints (`content/races.json`, 2 laps) on the kart profile of `sw2d.vehicles`; `bindStarterKartItem` (`KART_STARTER 'item'`): an item box on the first straight grants a shell, PRIMARY fires it along the heading.

## Terminal success/failure oracle

- **Success surface:** firing with no item is `empty`; CONFIRM starts the race (`countdown` then `racing`, `cp-1` expected); driving the first straight picks up the item (`pickup`) and passes `cp-1` (`cp-2` expected); PRIMARY fires (`fired 1`, `complete`); keyboard steering reaches `cp-2` (`cp-3` expected); restart reinstalls (`idle`, no item).
- **Failure surface:** `race.phase`, `expectedCheckpoint`, `vehicle.{x,y,heading,speed}`, `kartItem.{held,fired,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.vehicles` + `sw2d.racing` installed; kart item active, not held; race `idle`.
2. PRIMARY -> `empty`.
3. CONFIRM -> `countdown`; wait -> `racing`, expected `cp-1`.
4. Hold Up until `held` (`pickup`); steer toward cp-1 until expected becomes `cp-2`; PRIMARY -> `fired`, `fired 1`, `complete`.
5. Steer toward cp-2 until expected becomes `cp-3`.
6. Restart: race `idle`, `fired 0`, not held.

## Acceptance

- Item boxes as canonical `sw2d.items` entries and drift tuning are the reusable parts; on-demand item fire is game-specific (catalog limitation).
- Zero console errors, zero external requests.
