# Proof Contract — endless-driving

Frozen before implementation. Category-C Wave 23 (`vehicle.motion` endless-road presentation, ADR-0050) on the vehicle shell.

## Preset

`endless-driving` (`packages/presets/src/catalog/vehicleMovement.ts`) — controller family `vehicle`, required packs `sw2d.arcade`, `sw2d.generation`, **`sw2d.vehicles`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-endless-driving --preset endless-driving` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.vehicles` car motion (`VehicleIntent` in, motion out) presented as distance on the arcade ledger by `bindStarterVehicle` (`VEHICLE_STARTER 'road'`); `sw2d.generation` supplies the road chain.

## Terminal success/failure oracle

- **Success surface:** with no throttle the score does not move; throttle builds speed and distance; pause freezes the distance; holding throttle reaches the distance goal (`distance`, `complete`, score >= 80); restart reinstalls.
- **Failure surface:** `drive.{profile,speed,score,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.vehicles` + `sw2d.generation` installed; mode `road`; score < 80.
2. 30 frames idle -> score unchanged.
3. Hold Up 20 frames -> speed > 0, score up; pause/resume -> score advanced < 10.
4. Hold Up -> `distance`, `complete`, score >= 80.
5. Restart: `playing`, score < 80.

## Acceptance

- Zero console errors, zero external requests.
