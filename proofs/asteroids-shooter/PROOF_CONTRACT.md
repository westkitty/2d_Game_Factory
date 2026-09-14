# Proof Contract — asteroids-shooter

Frozen before implementation. Category-C Wave 11 (existing `sw2d.weapons` on the vehicle shell, ADR-0038) - heading-fire in open space.

## Preset

`asteroids-shooter` (`packages/presets/src/catalog/shooter.ts`) — controller family `vehicle`, required packs `sw2d.combat`, **`sw2d.weapons`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-asteroids-shooter --preset asteroids-shooter` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `vehicleController` steering/throttle intent on an Arcade body with drag (no `sw2d.vehicles`); `bindStarterWeapon` fires the catalog sidearm along the ship's heading through the shared projectile runtime.

## Terminal success/failure oracle

- **Success surface:** steering turns the ship at rest; thrust builds speed and moves it; drag halves the speed when released; PRIMARY spawns a live projectile that later expires; fire spam is gated by the weapon cooldown; restart reinstalls (no projectiles, speed 0).
- **Failure surface:** `x`, `y`, `angle`, `speed`, `weapon.{weaponId,projectilesLive,projectilesSpawned}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

Final Product Completion Wave 3 (matrix L13 / L14): the `sw2d.vehicles` `ship` profile (rotational inertia, momentum, wrap-around) and the generated vehicle shell's rock field (`bindStarterAsteroids`).

1. Start; `sw2d.vehicles` + `sw2d.arcade` installed; mode `field`; wave 1 with 4 large rocks; 3 lives; speed 0.
2. Tap Right for 8 frames -> `angularVelocity > 0.5`; 10 frames later still turning (`heading` advanced) -> damping settles it below 0.05.
3. Hold Up 30 frames -> `speed > 60`; release 30 frames -> still coasting above half that speed and decaying.
4. Hold Up until `vehicle.wraps >= 1` -> the ship is back inside the play area.
5. Hold PRIMARY with a slow spin until a large rock splits -> `splits >= 1`, `destroyed >= 1`, `score >= 20`, two medium rocks, rocks have wrapped (`asteroids.wraps >= 1`).
6. Thrust around the field -> `lives < 3`; keep going -> `failed`, `lives 0`, `ship lost`.
7. Restart: `playing`, 3 lives, `score 0`, 4 large rocks.

## Acceptance

- Rock field, drift, wrap, projectile collision, splitting, scoring, ship collision, lives, waves and fail/restart are the generated game's real loop; the ship's rotational inertia is the reusable `sw2d.vehicles` `ship` profile - no catalog limitation remains.
- Zero console errors, zero external requests.
