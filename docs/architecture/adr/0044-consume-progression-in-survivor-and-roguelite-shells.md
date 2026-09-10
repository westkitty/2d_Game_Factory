# ADR-0044: Consume progression in survivor and roguelite shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 17

## Context

`survivor-like` and `action-roguelite` already required `sw2d.progression`
(currency / XP / unlock flags / item counts). The generated top-down shell
never bound it. Survivor already fights authored encounter waves;
roguelite already builds a seeded room graph. Inventing a new run-meta or
difficulty-scaling pack would violate the live-catalog rule that each leftover
has one consumer, and would duplicate a ledger that already exists.

The two leftovers are not one machine. Survivor is in-run XP that accrues
while the encounter loop is alive. Roguelite is walking to relics that grant
currency and items. They share the existing progression service.

## Decision

**Consume the existing `sw2d.progression` ledger. Do not add a pack, schema,
or capability id. Do not invent a difficulty-scaling or permadeath pack.**

- **`survivor-like`** generated packConfig sets `PROGRESSION_STARTER = 'survive'`.
  The top-down shell ticks `addXp(1)` every 400ms while the encounter fight
  continues. Complete at 2 XP and `unlock('surge')`. Fire stays on J/X.
- **`action-roguelite`** generated packConfig sets `PROGRESSION_STARTER = 'run'`.
  Two relics sit on the field. J near a relic `addItem`s, `addCurrency(1)` and
  `addXp(5)`. Complete when both are taken and `unlock('run-cleared')`.
- **No third consumer.** Dungeon-crawler, twin-stick, heist and adventure keep
  `PROGRESSION_STARTER = null`. Overlay survivor / roguelite kits stay local
  (P3-C).

`sw2d.progression` has no `reset()`. The binder zeros XP and currency with
negative deltas.

## Consequences

- No new pack. Pack count stays 28. `sw2d.progression` required consumers
  already included these two recipes.
- Catalog maturity stays unchanged.
- Overlay survivor / roguelite kits stay local.
- Endless difficulty scaling and run-based permadeath stay leftovers.

## Rejected

- **A new run-meta / permadeath pack.** `sw2d.progression` already exists.
- **Pairing auto-battler or simple-rts.** Those leftovers are autonomous
  combat and box-select, not XP/currency.
- **Wiring `strategy.turns` into survivor.** Survivor is realtime waves.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame scheduler,
  climbing, chase, territory and rail camera still have one live consumer each.
