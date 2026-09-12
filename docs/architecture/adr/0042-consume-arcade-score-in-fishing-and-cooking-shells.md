# ADR-0042: Consume arcade score in fishing and cooking shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 15

## Context

`fishing-game` and `cooking-game` already required `sw2d.arcade` (score /
combo / lives / elapsed). The generated ui-simulation shell never bound it,
so both recipes entered play as dummy OPTIONS. Inventing a fishing pack or a
cooking pack would violate the live-catalog rule that each leftover has one
consumer. Folding fishing into `sw2d.timing` would lie about reaction/beat
windows. A fishing+cooking mega-pack would pretend cast/bite/land and an
ordered recipe are one machine.

The two leftovers are not one machine. Fishing is a timed bite window on
elapsed plus score. Cooking is an ordered ingredient list plus score.

## Decision

**Consume the existing `sw2d.arcade` ledger. Do not add a pack, schema, or
capability id. Do not invent a casting/tension or recipe pack.**

- **`fishing-game`** generated packConfig sets `ARCADE_STARTER = 'fishing'`.
  The ui-simulation shell casts, waits on `elapsedMs`, lands in the bite
  window (or misses), and `addScore`s per catch. Complete at two fish.
- **`cooking-game`** generated packConfig sets `ARCADE_STARTER = 'cooking'`.
  Arrows pick FLOUR / EGG / MIX. Confirm matching the `[0,1,2]` recipe
  advances; a wrong pick records a mistake. Complete at three correct steps
  with `addScore(100 - 20 * mistakes)`.
- **No third consumer.** Pinball-lite, microgame-collection, rhythm and
  reaction keep `ARCADE_STARTER = null`. Overlay fishing/cooking kits stay
  local (P3-H).

`sw2d.arcade` has no `reset()`. The binder zeros score with
`addScore(-score)` and uses relative `elapsedMs` snapshots.

## Consequences

- No new pack. Pack count stays 28. `sw2d.arcade` required consumers
  already included these two recipes.
- Catalog maturity stays unchanged.
- Overlay fishing / cooking kits stay local.
- Casting/line/tension/fish behaviour and ingredient/recipe cooking stay
  leftovers.

## Rejected

- **A fishing / casting / tension pack.** Only fishing-game needs it.
- **A cooking / recipe / action-sequence pack.** Only cooking-game needs it.
- **Folding fishing into `sw2d.timing`.** Timing is reaction/beat windows,
  not a bite wait.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame
  scheduler, climbing, chase, territory and rail camera still have one live
  consumer each.
