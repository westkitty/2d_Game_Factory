# ADR-0019: Data-driven items and effects are one pack, one bounded effect union

- Status: accepted
- Date: 2026-08-28
- Phase: Capability program, Phase 2 (Sonnet 5)

## Context

Before Phase 2 the factory had `Collectible` Tiled objects and `progression`'s
`itemCount`/`addItem` (meta counters), but no canonical item model. Every
collectathon, key, power-up and future kart item would have invented its own
shape. `collectathon-platformer` already declared a `items` content role with
nothing behind it.

## Decision

**A new narrow pack, `sw2d.items`, publishing `items.state`.** Not folded into
`progression` (ADR: "do not turn core packs into monoliths") - progression's
counters are meta-game; item inventory + effect execution is its own lifecycle.
`dependencies: []`: an effect whose target capability is absent is skipped and
reported, never a hard dependency and never a throw.

**Definitions are validated content, not code.** `content/items.json`, schema
`item-catalog` (registered in `@sw2d/schemas` alongside `tuning`/`levels`).
Always emitted by the generator (empty `items: []` when a preset has no `items`
role) so `content.ts` can always load and validate it.

**Effects are a bounded discriminated union**, not an embedded language: eight
leaf kinds (`combat.heal`, `combat.invulnerable`, `progression.currency`,
`progression.xp`, `progression.item`, `arcade.score`, `simulation.resource`,
`world.flag`) plus a single non-nesting `chain`. Each leaf names the capability
id it needs (`EFFECT_CAPABILITY_REQUIREMENT` in `@sw2d/contracts`).
`applyEffects` returns `{ applied, skipped }` - missing capability or missing
context (no combat target) is a reported skip, deterministic and observable.

**Pickup glue is a runtime helper, not shell code.** `bindCollectiblePickups`
(`@sw2d/runtime/game-support`, the `ProjectilePool` precedent) turns
`Collectible` level objects whose `itemId` names a catalog entry into sensor
sprites that grant the item on player overlap. The shared `platform` and
`top-down` shell templates call it once, capability-guarded, so a generated
game consumes items with **zero per-pickup code**; a preset without `sw2d.items`
is byte-unaffected at runtime (the helper returns an inert binding).
On-pickup effects fire for non-consumable items; a consumable's effects belong
to its `consume()` call.

**Persistence is opt-in** (`sw2d.items` config `{ persist?: boolean }`,
`items-config` schema). Default: in-memory inventory that resets on a run
restart. `persist: true` backs it with `context.saves` so counts survive a
browser reload. Whether held items are save-worthy is a game decision, so the
default does not silently write to storage.

## Consequences

- `collectathon-platformer` gains `sw2d.items` as a required pack; its
  `itemDefinitions` limitation is removed (its generated starter now consumes
  the capability through the shared shell). `LIMITATIONS.itemDefinitions` is
  deleted.
- Two proof consumers: `proofs/collectathon-platformer/` (platform, arcade +
  world-flag chain effects, no game-specific pickup code) and
  `proofs/top-down-adventure/` (top-down, world-flag + progression currency/xp,
  a real `consume()` path). Both real generated games in `npm run qa:proof`.
- `sw2d.items` is deliberately **not** added to `honesty.test.ts`'s
  `foundational` set: a preset requiring it does not automatically have an
  unstated gap - a collectathon is exactly what the pack delivers.

## Rejected

- **Extending `progression` with item definitions/effects.** Monolith; wrong
  lifecycle.
- **A JSON mini-language for effects.** A universal DSL by another name. The
  bounded union covers every effect the current subsystems can honestly execute
  and extends by adding a branch.
- **Nesting `chain` inside `chain`.** No proof needs it; a flat chain keeps the
  schema and the executor bounded.
- **Persisting inventory by default.** Writes to storage a game may not want;
  made opt-in instead.
- **A `sw2d.items` scene pack that registers its own `Collectible` factory.**
  Pickups need the player sprite, which the shell owns; the runtime helper +
  one guarded shell call is smaller and keeps `@sw2d/packs` renderer-free.
