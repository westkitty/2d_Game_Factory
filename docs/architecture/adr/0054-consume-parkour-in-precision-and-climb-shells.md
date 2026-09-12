# ADR-0054: Consume player-controlled parkour vs climb

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 27

## Context

`precision-platformer` entered play as dummy walk-and-jump on a proof-level
strip. `climbing-game` leftover is wall-slide / wall-jump / ledge-grab. Wave
22 already consumed auto-run for auto-runner / endless-runner and rejected
pairing climbing. Inventing a wall-slide pack would duplicate a 1-consumer
leftover. Chase stays unpaired.

They still share player-controlled jumps on authored pads. Precision wins by
jumping a gap to a flag. Climb wins by jumping up stacked pads.

## Decision

**Do not add a pack, schema, or capability id. Do not claim wall-slide. Present
precision vs climb in the platform shell.**

- **`precision-platformer`** generated packConfig sets `PARKOUR_STARTER =
  'precision'`. Player holds right and jumps the gap; complete occupying FLAG.
- **`climbing-game`** generated packConfig sets `PARKOUR_STARTER = 'climb'`.
  Jump up stacked pads; complete on the top pad.
- **No third consumer.** Auto-runner stays Wave 22 auto-run. Chase stays
  leftover. Overlay platform kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Wall-slide / wall-jump / ledge-grab stay leftover.

## Rejected

- **A climbing/wall-slide pack.** Only climbing-game needs that identity.
- **Pairing climbing with chase.** Different leftover contracts.
- **Restyling Wave 22 auto-run as precision.** Auto-run is not player-controlled.
