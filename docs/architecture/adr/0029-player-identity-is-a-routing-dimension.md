# ADR-0029: Player identity is a routing dimension, not a second input vocabulary

- Status: accepted
- Date: 2026-08-29
- Phase: Post-ten capability program, Phase 15

## Context

`local-party-game` carried "No multi-player/local multi-device input routing exists" and `pong`
carried "Pong does not yet have a proven multi-player input-routing abstraction". `ActionInput`
(ADR-0009's semantic layer) has exactly one channel: one set of `ActionId`s, one edge machine, one
answer to "is JUMP down".

Three wrong answers were available and rejected:

- **Widen the vocabulary** to `P1_JUMP`, `P2_JUMP`, … Every controller family, every system pack
  and every generated shell would have to learn a player prefix, and the vocabulary would grow with
  the maximum supported player count. It also makes a two-player game and a one-player game
  structurally different, which they should not be.
- **Filter one shared host** by "whose device produced this". The host would need to know about
  devices, which is the adapters' job, and a filtered read is only as correct as the filter — a
  missed case is silent cross-talk rather than a compile error.
- **A second input stack for multiplayer.** Two edge machines that must agree about `justPressed`
  is the exact class of bug the single-owner rule in `ActionInputHost` exists to prevent.

## Decision

**Player identity is a routing dimension over the existing abstraction.**

```
physical devices -> adapters -> PlayerInputHub -> per-player ActionInput
```

- **`input.players`** (`PlayerInputHub`, `packages/runtime/src/input/`) owns the roster: slots,
  join/leave/ready, device assignment, and one channel per seated player.
- **A channel is an ordinary `ActionInputHost`** — the same certified edge machine a single-player
  game uses — with its own adapters bound to that player's device. **Isolation is therefore a
  property of ownership, not of filtering**: player two's channel has no adapter listening for
  player one's keys, so there is no code path along which cross-talk could occur. That is why the
  proof can assert player two's entire value snapshot is zero, rather than asserting that a
  particular action was suppressed.
- **`ActionInput` is untouched.** A controller family, a system pack and a generated shell all read
  the actions they already knew; the party proof moves bodies with the ordinary shared
  `topDownController`, handed each player's own channel.
- **Frame advancement keeps the single-owner rule.** The runtime advances every channel exactly
  once per step, in the same `PRE_STEP` hook that advances the global input and the spatial pointer.
- **Devices are exclusive by default.** `DeviceAssignment` is a bounded union (`keyboard-profile`,
  `gamepad-index`) precisely so the hub can deduplicate it; a device the hub cannot name is a device
  it cannot stop two slots from sharing.
- **Opt-in by authored content.** A game gets a hub, and the capability, only by shipping
  `content/players.json` (`urn:sw2d:schema:content-players:v1`). Every other game keeps exactly the
  behaviour it had before this phase.

### The gamepad seam

`GamepadSource` returns plain `GamepadSnapshot` values, never browser `Gamepad` objects. The browser
recycles and invalidates those, and retaining one across a disconnect is precisely how a stuck
"fire" survives unplugging the pad. The same seam is what lets automated QA plug, press and unplug a
controller deterministically. Bindings are by index, never by vendor label: button 0 is the bottom
face button on every standard-mapping pad, whatever the vendor prints on it.

Deadzone is **radial for a declared stick pair** and scalar elsewhere, because a diagonal push is one
vector — per-axis thresholds would make a genuine diagonal need more deflection than a cardinal one.

## Consequences

- `LIMITATIONS.localTouchMultiplayer` replaces the old "no routing exists" claim with what is
  actually true: routing is reusable; **same-device multi-touch multiplayer was not built**, and the
  supported shape is one touch-controlled player plus keyboard/gamepad players.
- `PAUSE` is deliberately unbound in the default keyboard profiles. Pausing is a system action; two
  players fighting over one pause edge is the same double-consumption failure the c_chase extraction
  documented.
- `KeyboardAdapter` now resolves its blur target defensively instead of assuming a global `window`,
  so a channel can be built in a non-DOM context. No browser behaviour changed.
- Proof consumers: `proofs/local-party-game/` (13 steps) and `proofs/pong/` (7 steps, input
  foundation only — Phase 16 consumes it).
