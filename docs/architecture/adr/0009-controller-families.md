# ADR-0009: Controllers interpret intent; they never touch physical input or gameplay

- Status: accepted
- Date: 2026-08-25
- Phase: 3 (Sonnet 5)

## Context

`MASTER_PROJECT.md` §10 requires six controller families (platform, top-down, vehicle, grid,
pointer, UI/simulation) sitting between the semantic input layer (`ActionInput`, Phase 1) and
future movement/gameplay system packs (Phase 4+). Two failure modes were live risks:

1. A controller becomes a second input system - reading `KeyboardEvent.code`, owning listeners,
   or advancing its own notion of a frame - which would duplicate `ActionInputHost` and
   reopen the exact double-consumption bug [ADR-0003](0003-semantic-input-ownership.md) fixed.
2. A controller absorbs gameplay - gravity, collision, vehicle physics, turn systems - which
   would make "controller" mean nothing and leave Phase 4's system packs with no clean interface
   to build against.

## Decision

**A controller is `{ read(input: ActionInput): TIntent }` - a stateless, pure interpretation.**
No class, no constructor, no `Disposable`. It is typed against `ActionInput` (the read-only
interface), not `ActionInputHost` (the concrete frame-advancing class), so it cannot call
`update()` even by accident. `Controller<TIntent>` and the six intent types live in
`@sw2d/contracts` - no Phaser, no dependency beyond `ActionInput` itself.

**Claimed reads are the exception, not the default.** Most intent fields are plain,
non-mutating reads (`isDown`, `justPressed`, `axis`, `value`) so any number of systems may
observe them in the same frame without racing. A small, named set claims its edge via
`consumePress`, because it represents the same discrete, single-owner, mode-changing class of
decision ADR-0003 names explicitly: `PlatformIntent.jumpPressed`, and
`UiSimulationIntent.confirmPressed` / `cancelPressed` / `pausePressed`. Nothing else claims.

**A controller answers "what does the player intend?", never "how does the world respond?"**
No gravity, collision, coyote time, jump buffering, vehicle physics, pathfinding, turn systems,
menus, or scene routing lives in a controller. `platformController` returns `moveAxis` and
`jumpPressed`; `starter/src/game-specific/placeholderMoverPack.ts` decides what velocity that
becomes and whether the actor is grounded.

**Pointer stays honest about what it supports.** `pointerActionController` exposes only the
press-style actions `ActionInput` has today (`primaryPressed`, `secondaryPressed`,
`interactPressed`, `confirmPressed`, `cancelPressed`). It does not invent cursor coordinates,
hover state or drag deltas. A spatial pointer service is a real, bounded future capability for
whichever phase needs placement/drag-drop mechanics - not something to fake with always-zero
fields now.

## Consequences

- Every controller is trivially unit-testable against a real `ActionInputHost` with no DOM, no
  Phaser, no renderer - the same testability property `resolveInstallOrder` established for
  pack composition in Phase 1.
- Nothing about this layer can leak a listener or a timer, because nothing in it allocates one.
- `platformController` has a real consumer (the starter's placeholder mover); the other five are
  proven by focused fixtures only, per `MASTER_PROJECT.md`'s own Phase 3 acceptance contract.
  Do not read "tested" as "exercised by a real game" for those five.
- `pointerActionController`'s honesty about missing spatial state is a promise to the next phase
  that needs it: build the spatial service deliberately, don't discover fake fields later.

## Rejected

- **A parallel edge tracker inside `gridController`.** `ActionInputHost.justPressed` already
  guarantees exactly one true frame per physical press; a second tracker would be the "second
  edge state machine" `MASTER_PROJECT.md` §11 explicitly forbids, for no benefit.
- **Per-axis clamping in `topDownController`.** Clamping `moveX` and `moveY` independently to
  [-1, 1] still allows `sqrt(2)` diagonal magnitude. The vector as a whole is scaled instead, so
  `length <= 1` holds for any input.
- **A spatial pointer service, built now to make the pointer family feel complete.** See
  "Decision" above. Not an Opus escalation: the existing `ActionInput` contract does not block
  Phase 3's actual scope (press-style controllers), only a not-yet-required future one.
