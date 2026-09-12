# ADR-0047: Consume spatial pointer in photo and sandbox shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 20

## Context

`photography-game` entered play as a dummy top-down wanderer. `sandbox-playground`
entered play as a dummy pointer click target. Wave 16 already consumed ADR-0018
for drawing strokes and wardrobe drag/drop, and rejected these two as a third
`POINTER_STARTER` consumer: authoring and photo-framing are different machines
from draw/wardrobe, and from each other.

Inventing a camera/framing pack or a generalized authoring sandbox would
violate the live-catalog rule that each leftover has one consumer. Folding
either into `sw2d.arcade`, `sw2d.narrative`, or `sw2d.puzzle` would lie about
the genre.

They still share the existing interaction service: world cursor, hover, click.
Photography is walk-into-range capture. Sandbox is click-to-stamp two kinds.

## Decision

**Consume the existing ADR-0018 interaction service. Do not add a pack,
schema, or capability id. Do not invent a camera/framing or authoring pack.**

- **`photography-game`** generated packConfig sets `TOY_STARTER = 'photo'`.
  The top-down shell hides dummy wander fire. Walk to BIRD then TREE; J (or
  a click while in range) captures. Too-far shots are rejected. Complete at
  two shots.
- **`sandbox-playground`** generated packConfig sets `TOY_STARTER = 'sandbox'`.
  The pointer shell hides the dummy target. Click the stage to stamp the
  selected BLOCK or BALL; arrows or palette clicks pick the kind; clicking a
  stamp removes it. Complete when at least one of each kind exists.
- **No third consumer.** Drawing, dress-up, physics-toy, gallery, rail and
  museum keep `TOY_STARTER = null`. Overlay photography / sandbox kits stay
  local (P3-H).

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Overlay photography / sandbox kits stay local.
- Camera/framing/scoring and generalized authoring/editing stay leftovers.

## Rejected

- **A camera / framing / photo-capture pack.** Only photography-game needs it.
- **A generalized authoring/editing sandbox pack.** Only sandbox-playground
  needs it.
- **Extending `POINTER_STARTER`.** Wave 16's draw/wardrobe contract stays.
- **Pairing museum-exhibit.** That leftover is an exhibit/codex framework,
  and folding museum into dialogue/narrative was already rejected.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame scheduler,
  climbing, chase, territory and rail camera still have one live consumer each.
