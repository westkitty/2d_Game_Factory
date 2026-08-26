# ADR-0016: Aim is a fourth digital axis, not spatial pointer

- Status: accepted
- Date: 2026-08-26
- Phase: 8 (Sonnet 5)

## Context

Phase 5 deliberately deferred spatial (world-space) pointer/aim input until a real consumer
existed - the semantic `ActionInput` boundary only carries discrete/digital actions
(`justPressed`/`consumePress`/`axis`), and inventing a pointer-position, hover-target, or
click-coordinate service ahead of a demo that actually needs it would have been speculative
surface area with no proof it fits the existing input-ownership model (ADR-0003: one frame owner,
presses are claimed).

Phase 8's `twin-stick-shooter` demo is that real consumer: its smoke contract explicitly requires
independent movement *and* aim ("Do not call last-move-direction independent aim"). `bullet-hell`
and `tower-defense` also benefit from a real aim/targeting vector, and `topDownController` already
exposes a `moveX`/`moveY` pair computed from two digital axes (`MOVE_LEFT`/`MOVE_RIGHT`,
`MOVE_UP`/`MOVE_DOWN`) via `ActionInput.axis()` - the same clamped, per-frame, edge-detected
pattern movement already uses.

Two shapes were possible for "aim": a genuine spatial pointer (world-space position, hover
targets, click-to-aim) or a second digital axis pair, structurally identical to movement.  A
spatial pointer service would touch input ownership, hit-testing, and coordinate-space
conversion - real new surface area, not a small extension - for a Phase 8 need that a digital
axis fully satisfies (twin-stick shooters have shipped for decades on exactly this input model:
one analog/digital stick for movement, a second for aim).

## Decision

**Aim is a second digital axis pair, not spatial pointer.** Four new action ids -
`AIM_LEFT`/`AIM_RIGHT`/`AIM_UP`/`AIM_DOWN` - were added to `ACTION_IDS`
(`packages/contracts/src/actions.ts`), bound by default to the numpad
(`Numpad4`/`Numpad6`/`Numpad8`/`Numpad2` - `IJKL` was unavailable, already claimed by
`PRIMARY_ACTION`/`SECONDARY_ACTION`). `TopDownIntent` gained `aimX`/`aimY`/`aimMagnitude`,
computed in `topDownController.ts` via the exact same `input.axis(...)` + magnitude-clamp
`moveX`/`moveY` already use - no new input-reading code path, no new frame-ownership question.

Spatial pointer/hover/click targeting remains deferred. No preset may claim it; `tower-defense`'s
tower placement instead uses `gridController`'s existing keyboard-driven cursor (documented in its
own preset `knownLimitations`), the same "keyboard/grid-selected placement is acceptable while
spatial pointer stays deferred" path the Phase 8 directive names explicitly.

## Consequences

- `twin-stick-shooter`'s demo proves genuinely independent movement and aim: `moveX`/`moveY` come
  from `MOVE_*`, `aimX`/`aimY` from `AIM_*`, and the smoke test asserts a purely-aimed shot
  (`aimY: 0`) hits a target aligned only on the aim axis, not the move axis.
- `consumePress` semantics, one-frame ownership, and the schema-validated action-bindings shape
  (`packages/schemas/schemas/action-bindings.schema.json`) all extended by four properties with no
  structural change - the same reason ADR-0009 keeps controllers as intent-only interpreters paid
  off here without modification.
- Spatial pointer targeting is still not implemented anywhere in the factory. Any preset that
  needs real hover/click/drag input (`point-and-click`, `drawing-game`, several others already
  named in their own `knownLimitations`) still honestly cannot claim it.

## Rejected

- **A spatial pointer/world-coordinate aim service.** Real new input-ownership surface for a need
  a digital axis already satisfies; deferred again to whichever phase has a preset that cannot be
  honestly built without it (point-and-click, drawing-game).
- **Reusing `moveX`/`moveY` as aim ("last-move-direction aim").** The Phase 8 directive explicitly
  forbids this for `twin-stick-shooter`'s smoke contract - it is not independent aim, it is
  movement direction relabeled, and does not prove what the demo claims to prove.
- **IJKL for aim bindings.** Already claimed by `PRIMARY_ACTION` (`KeyJ`/`KeyX`) and
  `SECONDARY_ACTION` (`KeyK`/`KeyC`) in `defaultBindings.ts`; numpad avoids the collision without
  displacing an existing binding.
