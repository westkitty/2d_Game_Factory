# Proof Contract — run-and-gun

Frozen before implementation. Phase 3 of the capability-completion program (weapons & projectiles, ADR-0020). The **cross-controller** consumer that proves the reusable weapon/projectile layer on a platform preset, not just top-down.

## Preset

`run-and-gun` (`packages/presets/src/catalog/shooter.ts`) — controller family `platform`, required packs `sw2d.combat`, `sw2d.world`, `sw2d.world-entities`, **`sw2d.weapons`**. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-run-and-gun --preset run-and-gun`; the preset now requires `sw2d.weapons`, so the generated game ships `content/weapons.json` and installs the pack. Customized in `content/levels/main.json` (a ground row + two `Enemy` turret targets) and `src/game-specific/shellPack.ts` (the platform shell's `bindStarterWeapon` is swapped for a full `createProjectileRuntime` wired to the enemy group).

## Reusable capability exercised

- `sw2d.weapons` (`WeaponsService`) — the `sidearm` weapon from validated `content/weapons.json`; `equip` / `tryFire` own cooldown and muzzle offset.
- `createProjectileRuntime` (`@sw2d/runtime/game-support`) — renders the deterministic `ProjectileSpawn`s, per-projectile overlap against the enemy group, resolves damage through `combat.health`, tracks pierce/lifetime/out-of-bounds and `hitsResolved`.
- `combat.health` (`CombatService`) — player and each turret registered; projectile damage flows through `combat.damage`; **enemy death is a `combat:entityDied` reaction**, not projectile bookkeeping.

## Content

- `content/weapons.json`: `sidearm` — `single` fire, `cooldownMs` 220, `muzzleOffset` 18, projectile speed 460 / lifetime 1200 / damage 10, team `player`.
- `content/levels/main.json`: a full-width ground `Solid`, a `PlayerSpawn`, and two `Enemy` objects (`turret-a` at x≈500, `turret-b` at x≈720, health 20 each) on the ground row.

## Terminal success/failure oracle

- **Success surface:** after the automated sweep, shell debug `game.platform-shell` reads `enemiesAlive === 0`, `hitsResolved >= 4`, and `projectilesExpired + projectilesLive === projectilesSpawned`.
- **Failure surface:** `enemiesAlive`, `enemyHealth`, `projectilesLive/Spawned/Expired`, `hitsResolved`, `weaponId`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); scene `sw2d.play`; `sw2d.weapons` installed; `weaponId === 'sidearm'`; `enemiesAlive === 2`; `projectilesSpawned === 0`.
2. Move right to close distance, then face right.
3. Fire `PRIMARY_ACTION` repeatedly (each shot gated by the weapon's own 220ms cooldown). Each turret takes two 10-damage hits; `combat:entityDied` removes it. Sweep ends with `enemiesAlive === 0`, `hitsResolved >= 4`, and the projectile-lifecycle invariant `spawned = live + expired` holding at every sample.
4. Pause (`PAUSE`): projectile count and player position are frozen across a stepped interval; resume (`CONFIRM`) does not immediately re-pause.
5. Restart (pause, then `SECONDARY_ACTION`): the play scene reinstalls — both turrets alive again, `projectilesSpawned` / `hitsResolved` back to 0.

## Acceptance

- The reusable weapon model + shared projectile runtime work on a platform (not just top-down) shell.
- Damage is resolved through `combat.health`; enemy death is an ordinary combat-event reaction.
- Projectile lifecycle is leak-free (`spawned = live + expired`); a weapon cooldown gates fire rate.
- Restart genuinely reinstalls.
- Zero console errors, zero external requests.
