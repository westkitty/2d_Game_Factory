# ADR-0052: Consume one-unit command vs stand-in occupy

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 25

## Context

`simple-rts` leftover is realtime box-select, not `strategy.turns`. Wave 18
already rejected restyling FLAG-seize as RTS. `territory-control` leftover is
capture-zones. Inventing box-select or capture-zone packs would duplicate
1-consumer leftovers.

They still share “issue an order, then occupy.” RTS wins by selecting one unit
and walking it to a flag. Territory wins by standing in two zones.

## Decision

**Do not add a pack, schema, or capability id. Do not claim box-select or a
capture-zone pack. Present rts vs zone in the top-down shell.**

- **`simple-rts`** generated packConfig sets `COMMAND_STARTER = 'rts'`.
  J selects one unit; WASD moves that unit; complete occupying FLAG.
- **`territory-control`** generated packConfig sets `COMMAND_STARTER = 'zone'`.
  Stand in two circles; complete when both are owned.
- **No third consumer.** Tactics stays Wave 18 FLAG-seize. Overlay RTS /
  territory kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Box-select and capture-zone packs stay leftover.

## Rejected

- **Restyling Wave 18 tactics as RTS.** Discrete grid turns are not continuous
  command.
- **A box-select pack.** Only simple-rts needs marquee selection.
- **A capture-zone pack.** Only territory-control needs zone ownership as
  identity.
