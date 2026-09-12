# ADR-0033: Melee strike, knockback and hit-stun are one reusable close-combat capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 6

## Context

`action-adventure` and `arena-combat` carried the limitation that melee /
knockback was not a reusable capability. Both recipes need the same
underlying machine (attack window, nearest-foe hit, health via
`combat.health`, knockback, hit-stun, contact damage) with different
rosters: a single elite foe versus several fodder. Folding that into
`sw2d.combat` would have turned a health ledger into a genre monolith.
Combo strings, directional attacks and targeting UI do not fit this
contract. Run-and-gun stays a frozen projectile proof.

## Decision

**One renderer-neutral melee capability with two bounded modes. Not two
engines, and not a second health authority.**

- **`sw2d.melee` → `combat.melee`.** Depends on `combat.health`.
  `MeleeService` owns strike range, nearest-foe hit, knockback impulse,
  hit-stun, and contact cadence. Damage and invulnerability go through
  `combat.health`. No Phaser, no wall clock, no RNG.
- **Two modes of one machine:**
  - `skirmish` — one elite foe (HP 3), overlay then continues to loot/exit.
  - `arena` — three fodder (HP 2), clear-to-win.
- **`content/melee.json`** (schema `melee-catalog`, document `melee`),
  always emitted. Empty/inert unless the preset installs the pack.
- **The generated `topDownShellPack`** calls `bindStarterMelee`. When
  active it feeds `setPlayer` / `strike` / `tick` and parks weapon fire
  and encounter waves.
- **Workbench:** `POST /api/melee/inspect` + a compact inspector.

## Consequences

- Consumers: `action-adventure` (skirmish), `arena-combat` (arena). Both
  require `sw2d.melee` and content role `melee`.
- `LIMITATIONS.meleeCombat` names what is reusable and what is not.
  Twenty-five packs now have a preset consumer.
- Duplicate fighter ids throw at install. A missing document yields an
  inert service, not a crash.
- `bindStarterMelee` resets the fight on bind so a PlayScene restart is a
  new bout.
- Catalog maturity stays unchanged. Combos / directional attacks / lock-on
  stay game-specific.

## Rejected

- **Folding this into `sw2d.combat`.** That pack is entity-keyed health
  and explicitly is not melee collision.
- **Wiring run-and-gun.** Its committed proof is a frozen projectile
  shell; melee would be a third consumer only if the contract still
  needed it, which it does not.
