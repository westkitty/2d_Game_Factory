# ADR-0053: Consume look as museum plaques vs approaching rail targets

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 26

## Context

`museum-exhibit` leftover is an exhibit/codex framework. `rail-shooter`
leftover is a rail-path camera; Wave 11 already refused to wire weapons there.
Inventing either pack would duplicate 1-consumer leftovers.

They still share “look at a thing and confirm.” Museum wins by walking to
plaques and inspecting. Rail wins by damaging approaching combat targets
through existing `combat.health`.

## Decision

**Do not add a pack, schema, or capability id. Do not claim exhibit/codex or a
rail-path camera. Present museum vs rail in the top-down and pointer shells.**

- **`museum-exhibit`** generated packConfig sets `LOOK_STARTER = 'museum'`.
  Walk to two plaques; J inspects in range; complete at 2 reads.
- **`rail-shooter`** generated packConfig sets `LOOK_STARTER = 'rail'`.
  J damages approaching foes through `combat.health`; complete when both die.
- **No third consumer.** Gallery stays cursor-fire (Wave 11). Overlay kits
  stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Exhibit/codex and rail-path camera stay leftover. Rail still does not wire
  `sw2d.weapons`.

## Rejected

- **An exhibit/codex pack.** Only museum-exhibit needs that identity.
- **A rail-path camera pack.** Only rail-shooter needs a locked path.
- **Wiring weapons on rail.** Wave 11 already refused that adapter.
