# ADR-0028: Order lifecycle is owned by the capability; world effects go through one adapter seam

- Status: accepted
- Date: 2026-08-29
- Phase: Post-ten capability program, Phase 14

## Context

`simple-rts` carried "box-select and command-queue UI are not implemented" and
`turn-based-tactics` carried "attack-range/line-of-fire resolution and a full
turn-action state machine are still starter-specific". Both are the same missing
capability seen from two ends: **nothing reusable owns what a unit has been told
to do.**

`sw2d.strategy` (`strategy.turns`, Phase 7A) already owns teams, turn rotation and
a single-entity cursor selection. It deliberately owns no commands, no queues, no
ranges and no costs — its own header says so.

The obvious wrong answers were available and rejected:

- **An RTS pack and a tactics pack.** Two implementations of order state that
  drift apart, and a preset that wants both gets two answers to "what is this
  unit doing".
- **One pack that also moves and damages things.** A renderer-neutral capability
  cannot know how a unit traverses a particular world, and the moment it tries it
  either duplicates `sw2d.navigation` or hard-codes a movement model.
- **A callback bag.** `onMove`, `onAttack`, `onArrive`, … is the same seam with
  worse types and no place to report failure.

## Decision

**One pack, `sw2d.strategy-actions`, providing two capabilities, with a single
typed adapter as the only route to the world.**

- **`strategy.orders`** owns *command lifecycle*: order ids, per-actor queue
  order, `queued` → `active` → `completed | cancelled | failed`, `replace` /
  `append` / `front` policy, priority, cancellation, named actor groups, the tick
  counter, and the failure vocabulary (`invalid-target`, `target-lost`,
  `actor-removed`, `out-of-range`, `unreachable`, `insufficient-resource`,
  `on-cooldown`, `not-permitted`, `superseded`).
- **`strategy.tactics`** owns *bounded discrete actions* read from
  `content/strategy-actions.json` (`urn:sw2d:schema:content-strategy-actions:v1`):
  targeting mode, range and minimum range, action-point cost, cooldown in ticks,
  uses per turn, team requirement and ally/enemy/self target filter. It answers
  "may this actor do this here, and what would it cost" as a `TacticalValidity`
  *before* anything happens, then issues the action's order through
  `strategy.orders` rather than reimplementing lifecycle.
- **`OrderWorldAdapter` is the whole seam.** Three methods: `actor(id)` (where a
  unit is, whether it lives, what team it is on), `begin(order)` and
  `advance(order, deltaMs)` returning `running | complete | failed` with a
  reason, and an optional `end(order, status)`. The adapter can refuse or complete
  an order; it can never author an order status, an id, a queue position or a
  failure reason, and it is never asked about queueing. Exactly one adapter at a
  time; issuing with no adapter throws rather than silently pretending.
- **`strategy.orders` is the single authority on actor position.**
  `actorSnapshot(id)` proxies the adapter, and `strategy.tactics` reads range
  through it, so there is never a second answer to "where is this unit".

### Determinism

All enforced by the service and observable from a proof:

- Order ids are `ord-<n>` from a monotonic counter that only `reset()` rewinds.
- `tick()` counts `update()` calls. Cooldowns and issued/started/resolved stamps
  are in ticks, never wall clock, so a fixed-step QA harness and a real browser
  agree.
- Within one tick, actors are advanced in **ascending actor-id order**.
- Within one `issue()`, orders are created in the caller's actor order after
  duplicate ids are dropped keeping the first occurrence; a `groupId` is merged
  after the explicit `actors` list, then deduplicated.

### Where the boundary lands

A dead or removed actor fails its active order and its whole queue with
`actor-removed`; an entity target that dies mid-order fails that order with
`target-lost`; a `replace` displaces existing orders as `cancelled` +
`superseded` rather than `failed`, because being outranked is not a failure on
the order's own merits. A `stop` order is not queued — it *is* the cancellation,
recorded in history so the log shows who asked and when.

## Consequences

- `sw2d.strategy` is untouched. Presets that want turns and nothing else keep
  installing it alone; `sw2d.strategy-actions` declares no dependency on it.
- Movement composes rather than duplicates: both proof consumers route their
  order adapters through `sw2d.navigation`'s `RouteFollower` (ADR-0022), so an
  order into a wall genuinely has no route and genuinely fails `unreachable`.
- `LIMITATIONS.rtsSelectionUi` narrows the old claim honestly: order issue,
  queue, replacement, cancellation and lifecycle are reusable now; the
  *drag-rectangle input surface* and a command-card UI stay starter-specific,
  and the `simple-rts` proof supplies exactly that half in its own shell.
- Proof consumers: `proofs/simple-rts/` (new, 13 steps) and
  `proofs/turn-based-tactics/` (upgraded — its five Phase 5 steps are unchanged
  and still asserted, plus ten Phase 14 steps), proving the capability is not
  RTS-only.
