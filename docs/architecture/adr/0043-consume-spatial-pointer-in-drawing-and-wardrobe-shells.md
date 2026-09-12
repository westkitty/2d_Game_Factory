# ADR-0043: Consume spatial pointer in drawing and wardrobe shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 16

## Context

`drawing-game` and `dress-up-character-toy` already sit on the pointer shell,
which owns `context.spatialPointer` and `context.interaction` (ADR-0018). Both
recipes entered play as a dummy click target. Inventing a drawing-canvas pack
or a wardrobe/attachment pack would violate the live-catalog rule that each
leftover has one consumer. Folding either into `sw2d.puzzle` or `sw2d.arcade`
would lie about the genre.

The two leftovers are not one machine. Drawing is stroke polylines on a page.
Dress-up is drag/drop onto a figure. They share the existing interaction
service: world cursor, hover, drag capture, drop zones.

## Decision

**Consume the existing ADR-0018 interaction service. Do not add a pack,
schema, or capability id. Do not invent a drawing-canvas or wardrobe pack.**

- **`drawing-game`** generated packConfig sets `POINTER_STARTER = 'draw'`.
  Drag on the page records a polyline. A stroke counts when its length is at
  least 80px. Complete at two strokes.
- **`dress-up-character-toy`** generated packConfig sets
  `POINTER_STARTER = 'wardrobe'`. Hat and shirt are draggable targets; the
  figure is a drop zone. Complete when both pieces are attached.
- **No third consumer.** Sandbox, photography, physics-toy, gallery and rail
  keep `POINTER_STARTER = null`. Overlay drawing / dress-up kits stay local
  (P3-H).

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged.
- Overlay drawing / dress-up kits stay local.
- Pressure/layers/export and attachment/skeleton wardrobe stay leftovers.

## Rejected

- **A drawing-canvas / stroke-capture pack.** Only drawing-game needs it.
- **A wardrobe / attachment / skeleton pack.** Only dress-up-character-toy
  needs it.
- **Pairing sandbox or photography as a third consumer.** Authoring and
  photo-framing are different machines.
- **A mega-pack of leftover Tier-3/4 singles.** Pinball, microgame scheduler,
  climbing, territory and rail camera still have one live consumer each.
