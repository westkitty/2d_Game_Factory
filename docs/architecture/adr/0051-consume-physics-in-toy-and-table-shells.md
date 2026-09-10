# ADR-0051: Consume AdvancedPhysics in toy and table shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 24

## Context

`physics-toy` already opts into `physicsProfile: 'matter'`. The generated
pointer shell dropped a demo ball on a floor and clicked a dummy target.
`pinball-lite` already requires `sw2d.arcade` and Matter, but entered play as
dummy OPTIONS. Inventing a pinball pack would duplicate a 1-consumer leftover.
Pinball Matter is allowed only as one side of a real 2-consumer toy/table
contract.

They still share rigid-body motion. Toy wins by launching a ball into a goal.
Table wins by flippers, bumpers and arcade bumper-score.

## Decision

**Do not add a pack, schema, or capability id. Do not claim a pinball pack.
Present toy vs table in the pointer and ui-simulation shells.**

- **`physics-toy`** generated packConfig sets `PHYSICS_STARTER = 'toy'`.
  Click or J launches; complete when the ball rests in the goal.
- **`pinball-lite`** generated packConfig sets `PHYSICS_STARTER = 'table'`.
  J/K flip; bumper contacts `arcade.addScore`; complete at score 3.
- **No third consumer.** Physics-puzzle stays on the Wave 12 code seam.
  Overlay physics kits stay local. Frozen `proofs/physics-toy` is not
  regenerated.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged. Physics-toy remains proof-validated on
  the frozen proof.
- A reusable pinball pack stays leftover.

## Rejected

- **A pinball pack.** Only pinball-lite needs flipper tables as identity.
- **Pairing via `sw2d.arcade` fishing/cooking.** Those are score windows, not
  rigid bodies.
- **Changing the frozen physics-toy proof.** Factory templates only.
