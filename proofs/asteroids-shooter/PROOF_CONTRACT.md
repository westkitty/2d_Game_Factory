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

1. Start; `sw2d.weapons` + `sw2d.combat` installed; `sidearm`; `projectilesSpawned 0`; speed 0.
2. Hold Left 10 frames -> angle changed, speed 0.
3. Hold Up 20 frames -> speed > 8, moved > 8 px; release -> speed falls below half.
4. PRIMARY -> `projectilesSpawned >= 1`, live >= 1; PRIMARY ×4 -> spawned < 5; wait -> live 0.
5. Restart: `projectilesSpawned 0`, speed 0.

## Acceptance

- Drifting rock fields and wrap-around collision stay game-specific (catalog limitation) - this proof proves steer-and-fire, not a rock field.
- Zero console errors, zero external requests.
