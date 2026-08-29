# ADR-0021: Encounter orchestration is a bounded data model plus a runtime bridge

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 4 (Sonnet 5)

## Context

Phase 3 gave weapons/projectiles. The layer above - waves, enemy spawn
scheduling, bullet-pattern choreography, boss phases - was still starter-specific
(`twin-stick-shooter`'s hand-rolled wave sequencing; `bullet-hell` / `boss-rush`
carrying limitations). The risk was a "universal boss scripting language" bolted
into JSON, or burying orchestration inside the weapon service.

## Decision

**Same split as Phase 3: a renderer-neutral model in a pack, a bridge in the
runtime.**

- **`sw2d.encounters` → `combat.encounters`** (`@sw2d/packs`). Reads
  `content/encounters.json` (schema `encounter-catalog`). An `EncounterDefinition`
  is **phases** in order; each phase has optional **spawn groups** (archetype,
  count, a `point`/`rect`/`edge` spawn point, stagger), optional **emitters**
  (a Phase 3 `weaponId` + a bounded `FirePattern` + `everyMs` + `maxEmissions`),
  and one bounded `completeWhen` condition (`elapsed`, `spawns-cleared`,
  `entity-health-below`, `flag`). `EncounterService.update(dt, ctx)` returns a
  deterministic per-tick `{ spawns, fires, enteredPhaseId, completed }`; the game
  feeds back state through an `EncounterUpdateContext` (aim-at-player, health
  fraction, flags, entity origins, viewport). `reportDeath(requestId)` drives
  `spawns-cleared`. No Phaser, no wall clock, no RNG.
- **`FirePattern`** is a **bounded discriminated union** - `aimed`, `fixed`,
  `fan`, `ring`, `spiral`, `sweep` - expanded by the pure `expandFirePattern`
  into a deterministic list of unit directions. `emissionIndex` advances the
  rotating patterns. Not a DSL; adding a pattern is adding a `case`.
- **`createEncounterRuntime`** (`@sw2d/runtime/game-support`) - builds the
  context from live game state, materialises spawn requests through a
  game-supplied `spawnEnemy` callback, fires patterns through Phase 3's
  `createProjectileRuntime` (via the new `spawnRaw`), and applies a phase's
  `onEnterInvulnMs` / `onEnterFlag` from the encounter's own definition. Renderer
  glue only; no capability id, the `ProjectilePool` precedent.

**Runtime spawns are `EncounterSpawnRequest`s, not fake Tiled objects.** The
`world.entities` registry stays what it is - dispatch of *level-authored* Tiled
objects. A runtime encounter spawn is a separate, renderer-neutral descriptor the
bridge materialises; a game's `spawnEnemy` callback is free to build the sprite
however it builds level enemies.

## Consequences

- `bullet-hell` (bounded, deterministic ring+spiral choreography, exact bullet
  count) and `boss-rush` (one boss, three mechanically distinct phases,
  health-threshold transitions, invuln windows, a final-phase flag) are the two
  proof consumers. `qa:proof` 10/10 → 12/12.
- `LIMITATIONS.bossOrchestration` deleted. `weaponsProjectiles`-era wording on
  `bullet-hell`, `boss-rush`, `arena-combat`, `horizontal-shmup`,
  `vertical-shmup`, `survivor-like`, `base-defense` narrowed to their real
  remaining gaps (GPU-scale pooling, multi-boss sequencing, shell wiring,
  base-damage priority). Maturity split unchanged (5/7/62).
- Entity-carried emitters (each spawned mook shoots its own pattern) are
  implemented in the service but not exercised by a proof yet; phase-level
  emitters cover the two proofs.

## Rejected

- **A JSON scripting language for encounters.** The bounded phase / condition /
  pattern unions cover the two proofs and extend by adding a `case`.
- **Nesting orchestration inside `sw2d.weapons`.** Weapons stay a per-owner
  fire model; encounters schedule *when and what* fires.
- **Spawning runtime enemies as synthetic Tiled objects.** A separate
  renderer-neutral `EncounterSpawnRequest` keeps `world.entities` honest.
- **A `combat.patterns` capability id.** Pattern expansion is a pure function in
  contracts; it needs no pack, no lifecycle.
