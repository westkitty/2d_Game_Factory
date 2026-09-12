# ADR-0038: Consume existing weapons in vehicle and pointer shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 11

## Context

`asteroids-shooter`, `gallery-shooter` and `rail-shooter` still carried
`LIMITATIONS.weaponsProjectiles` after Phase 3 shipped `sw2d.weapons`. The
generated platform and top-down shells already bind `bindStarterWeapon`. The
vehicle and pointer shells did not. Inventing a new shooting pack would
duplicate ADR-0020.

The three leftovers are not one machine. Asteroids is heading-fire from a
steerable ship. Gallery is cursor-aimed fire from a fixed gun. Rail-shooter's
identity gap is a rail-path camera, not another fire adapter (Wave 8 already
rejected sharing rail cameras with shmups). Overlay asteroids/gallery/rail
kits stay local.

## Decision

**Consume the existing `sw2d.weapons` pack. Do not add a pack, schema, or
capability id.**

- **`asteroids-shooter`** requires `sw2d.weapons`. The generated vehicle
  shell fires along ship heading on `PRIMARY_ACTION`. Dummy ground collision
  is skipped so the ship flies in open space. Rotational inertia stays local.
- **`gallery-shooter`** requires `sw2d.weapons`. The generated pointer shell
  fires toward the spatial-pointer cursor on `PRIMARY_ACTION` or click. The
  frozen `proofs/gallery-shooter/` target-wave game is not regenerated.
- **`rail-shooter` is not wired.** Pointer-shell fire is inert unless the
  pack is installed. Rail keeps `LIMITATIONS.weaponsProjectiles` plus the
  rail-camera leftover.

Fire is not vehicle intent (ADR-0009). The vehicle shell reads
`PRIMARY_ACTION` directly; `VehicleIntent` stays steering/throttle/boost.

## Consequences

- No new pack. Pack count stays 28. Weapons consumers: 11.
- Catalog maturity stays unchanged. Gallery remains proof-validated on the
  frozen proof.
- Overlay shooter kits stay local.

## Rejected

- **A new asteroids / gallery / rail pack.** Weapons already exist.
- **Wiring rail-shooter fire.** That would not make a rail shooter.
- **Adding `primaryPressed` to `VehicleIntent`.** Controllers do not fire.
- **A mega-pack of leftover Tier-3/4 singles.** Climbing, chase, territory,
  pinball, crop/season and rail camera still have one live consumer each.
