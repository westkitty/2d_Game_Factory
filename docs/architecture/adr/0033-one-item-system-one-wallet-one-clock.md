# ADR-0033: The economy adds no second item system, no second wallet, and no second clock

- Status: Accepted
- Date: 2026-08-30
- Phase: Post-ten program Phase 19 (Economy, Production & Customer Simulation)
- Supersedes: none
- Related: [ADR-0011](0011-capability-namespacing.md), [ADR-0030](0030-ball-paddle-is-an-authored-simulation.md), [ADR-0032](0032-agent-needs-are-authored-vocabulary.md)

## Context

Four presets want an economy: `shopkeeper` and `tycoon-lite` want goods, customers and
production; `restaurant` wants the same customer/order foundation under a kitchen;
`idle-incremental` wants production that keeps going while nobody is watching. Before this
phase all four were covered by limitations saying that customer AI, a demand model, a
content-authored production chain, offline catch-up and prestige did not exist.

Every one of those is easy to build badly, and the three worst ways to build them are all
about ownership rather than mechanics.

The first is a second item system. A shop needs to know an apple has a price and a shelf,
and the tempting shape is a `Good` with an `id`, a `displayName`, a `category` — at which
point renaming an apple means editing two files, and the second one drifts.

The second is a second wallet. A shop has a till, `sw2d.progression` already has currency,
and the tempting shape is an internal balance the economy owns. Then "how much money does
the player have" has two answers.

The third is a second clock. Offline catch-up genuinely needs real time, and the tempting
shape is `Date.now()` wherever it is convenient — which makes the whole simulation
untestable, non-deterministic, and quietly wrong under a paused tab.

## Decision

`sw2d.economy` provides `simulation.economy` and `simulation.production`, and adds none of
those three things.

1. **One item definition system.** A `GoodDefinition` carries `itemId`, `stock`,
   `capacity`, `buyPrice`, `sellPrice`, `demandMultiplier`, `restockQuantity` — and nothing
   describing what the thing *is*. The schema refuses `displayName` and `category` here;
   they live in `content/items.json` (the certified Phase-2 catalog). A good is what a
   *shop* knows about an item, not what the item is.

2. **One wallet.** The shop's funds are `ProgressionService.currency()`, read and written
   through the capability. `sw2d.economy` declares `progression.state` as a hard dependency
   and refuses to install without it, rather than falling back to a private balance — a
   silent fallback is exactly how two answers to "how much money is there" appear. A
   *customer* carries their own `funds`, because a customer is not the player.

3. **One clock, injected, read once.** `WallClock` is a one-method interface supplied
   through `createGame({ wallClock })`, defaulting to `BrowserWallClock` (`Date.now()`).
   Nothing in `@sw2d/contracts` or `@sw2d/packs` calls `Date.now()` directly. It is read
   only at the load/resume boundary; the live simulation runs on `deltaMs` from first frame
   to last. `offlineElapsedMs` clamps a backwards-moving clock to zero credit, because a
   timezone change or a corrected system clock must not wrap around into a windfall.

4. **One input policy: consume at start.** A production job removes its inputs when it
   starts and adds its outputs once when it completes. It never consumes at both ends and
   never re-checks inputs mid-flight. Cancelling refunds exactly what was consumed — the
   counterpart of consume-at-start, not a second consumption.

5. **A transaction is atomic or it does not happen.** `evaluateTransaction` is a pure
   function of the state a transaction needs; the service applies its verdict and never
   re-derives it. A refused transaction moves no stock, no money, and emits no event, and
   it names its reason (`insufficient-stock`, `insufficient-funds`,
   `insufficient-capacity`, `invalid-quantity`, `unknown-good`) rather than returning a
   bare false. There are no partial fills.

6. **Catch-up aggregates; it never replays.** Eight hours at 60fps is 1.7 million frames.
   `catchUp(elapsedMs)` computes whole completed batches directly, charges each repeat for
   its own inputs, and stops when the shelf runs dry. Output beyond shelf capacity is
   reported as `wasted` rather than silently dropped.

7. **Placement validates reachability, not a path.** A station must fit entirely inside one
   `buildable` zone, must not overlap another placed station, and — when it declares an
   `accessOffset` — that point must land in an `aisle`. Whether an agent can actually walk
   there is `world.navigation`'s question, and this contract does not pretend to answer it.

8. **Frame advancement is absent from both service interfaces.** The pack owns
   `update(deltaMs)`; consumers observe through `drainEvents()`. This is the Phase-16 rule,
   applied here from the start rather than after the same defect is found twice.

## Consequences

- The four presets narrow their limitations rather than dropping them: what remains is
  honest about customers being a phase machine on simulation time rather than agents
  walking a floor, and about large-economy balancing being authoring work rather than a
  system.
- Requiring `progression.state` means a preset cannot take the economy without also taking
  the wallet. That is the intended cost of having one answer.
- `createGame` now provides `time.wall-clock` unconditionally, which closes for this phase
  the generator gap Phase 17 had to record for `audio.transport`: every browser has exactly
  one epoch clock, so unlike an audio transport there is nothing for a game to decide.
- The customer flow is a fixed seven-phase machine (`arrive` → `choose-target` →
  `navigate` → `queue` → `service` → `transaction` → `leave`). Patience ticks during
  `navigate` and `queue` but **not** during `service`: a customer walking out mid-sale would
  make the outcome ambiguous, and the outcome is the one thing this must not blur.
- The queue is strictly FIFO — only the head is ever promoted — so a later arrival can never
  overtake an earlier one even when a slot frees. Customers are iterated in ascending id
  order for reproducibility, which is a *separate* ordering from the queue's, and the
  browser proof deliberately uses ids that sort against join order so the two cannot be
  confused for each other.
