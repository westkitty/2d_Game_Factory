# ADR-0055: Consume arcade score as microgame tap-then-mash

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 28

## Context

`microgame-collection` already required `sw2d.arcade` and entered play as dummy
OPTIONS. Wave 15 consumed fishing vs cooking on that ledger and left microgame
null so it would not invent a scheduler. Inventing a microgame
scheduler/rotation/meta-framework pack would duplicate a 1-consumer leftover.

Tap-then-mash still fits score/elapsed: wait for GO, confirm, mash J, addScore.

## Decision

**Do not add a pack, schema, or capability id. Do not claim a scheduler.
Present a third `ARCADE_STARTER` mode on the existing arcade binder.**

- **`microgame-collection`** generated packConfig sets `ARCADE_STARTER =
  'micro'`. Round 1 is ENTER on GO; round 2 mashes J five times. Complete at
  mash target. Score uses `arcade.addScore`.
- **No scheduler.** Pinball stays Wave 24 table. Overlay microgame kits stay
  local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- `No microgame scheduler/rotation/meta-framework exists.` stays the leftover.

## Rejected

- **A microgame scheduler pack.** Only this recipe needs rotation/meta.
- **Folding micro into `sw2d.timing`.** Timing is reaction/beat windows, not
  a two-round collection.
- **Pairing microgame with kart item-fire.** Different leftover contracts.
