# ADR-0058: Wave 31 leftover presentations

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 31

## Context

Wave 30 landed the six leftover **packs**. Named leftovers still unfinished:
chase, box-select, generalized sandbox authoring, `parkour.dispose()`. Crop/season
is already presentation of `sw2d.simulation` jobs. Kart item-fire is already
game-specific (Wave 29). Chase still has no second pairing-legal consumer
(frozen `proofs/chase-platformer`).

## Decision

**Do not add a pack, schema, or capability id.** Present the leftovers as
generated-game code.

- **Chase.** `chase-platformer` packConfig sets `CHASE_STARTER = 'pursuit'`.
  Closing wall from the left; player-controlled run to FLAG. Overlay
  chase-platformer stays the frozen-proof kit.
- **Box-select.** `simple-rts` keeps two units. J still selects unit A (Wave 25
  FLAG path). Drag on the spatial pointer box-selects both. Command-queue UI
  is not.
- **Sandbox authoring.** Click a stamp to pick it up, click the stage to move
  it, K deletes. Wave 20 stamp-block-then-ball still wins.
- **`parkour.dispose()`** is called from the platform shell.

## Consequences

- No new pack. Pack count stays 34.
- Catalog maturity stays 23/3/48.
- Overlay kits stay local. Frozen proofs are not regenerated. No merge to main.

## Rejected

- **A reusable chase pack.** Only one pairing-legal consumer.
- **A command-queue / box-select pack.** Two units on ADR-0018 is enough.
- **A generalized authoring pack.** Pick/move/delete is still presentation.
- **Remanufacturing `proofs/chase-platformer`.** Evidence rule.
