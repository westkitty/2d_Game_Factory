# Proof Contract — boat-flight-racer

Frozen before implementation. Category-C Wave 23 (`vehicle.motion` boat-to-flight presentation, ADR-0050) on the vehicle shell.

## Preset

`boat-flight-racer` (`packages/presets/src/catalog/vehicleMovement.ts`) — controller family `vehicle`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.vehicles`**. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-boat-flight-racer --preset boat-flight-racer` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.vehicles` with two definitions (`boat`, `flight`): `bindStarterVehicle` (`VEHICLE_STARTER 'craft'`) reloads the definition on PRIMARY; only the flight profile gains altitude.

## Terminal success/failure oracle

- **Success surface:** as a boat, throttle + climb moves but altitude stays 0; PRIMARY switches to `flight`; throttle + climb then gains altitude to the airborne goal (`airborne`, `complete`, altitude >= 80); restart reinstalls as a boat at altitude 0.
- **Failure surface:** `drive.{profile,speed,altitude,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.vehicles` installed; mode `craft`; profile `boat`; altitude 0.
2. Hold Up + Shift until speed > 20 -> altitude 0, still `boat`.
3. PRIMARY -> profile `flight`, `flight`.
4. Hold Up + Shift -> `airborne`, `complete`, altitude >= 80.
5. Restart: `boat`, altitude 0, `playing`.

## Acceptance

- Zero console errors, zero external requests.
