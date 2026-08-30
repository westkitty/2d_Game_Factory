# Proof Contract — shopkeeper

Frozen before implementation. Post-ten program Phase 19 (economy, production & customer simulation, ADR-0033).

## Preset

`shopkeeper` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family
`ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.economy`**.
Content roles `tuning`, **`economy`**.

## Reusable capability exercised

`simulation.economy` and `simulation.production`, driven entirely by the validated
`content/economy.json` (`urn:sw2d:schema:content-economy:v1`): goods with stock, capacity
and both prices; demand; atomic transactions in both directions; production recipes with
consume-at-start inputs; station capacity and unlock gating; placement validation against
authored zones; the seven-phase customer flow; a FIFO queue with capacity, service slots
and patience; bounded offline catch-up against an injected wall clock; and prestige with
authored reset and retain scopes.

Every `itemId` in the document points at the canonical item vocabulary. The document defines
no item, opens no wallet, and reads no clock of its own.

## What is deliberately game-specific

Presentation, and nothing else. The shell holds no stock, no price, no queue and no till;
every number the proof asserts is read back out of a capability. It **cannot advance the
simulation** — neither service exposes `update()` — so it observes through `drainEvents()`.

`src/main.ts` injects a `ManualWallClock` through `createGame({ wallClock })`. That is a
test control, and it is the same one-method interface the browser clock implements, so the
economy cannot tell the difference — which is the point of injecting it rather than reaching
into the pack.

## Terminal success/failure oracle

- **Success surface:** every good's full state (stock, capacity, both prices, demand, the
  effective unit price), the shop's funds, every station (type, capacity, position,
  footprint, occupancy), every running job, every queue's waiting list and service slots,
  every customer's phase and purse, the prestige state, the complete phase log, the
  departure log with outcomes, the transaction log, and the last offline report.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 18-step verification)

1. Boot: `sw2d.economy` installed, exactly the three authored goods at their authored stock,
   capacity and prices, and funds equal to the progression currency `game.json` seeds.
2. A sale moves stock one way and money the other in one indivisible step, and logs exactly
   one transaction.
3. A refused sale — first beyond stock, then beyond the buyer's purse — changes **nothing**:
   no partial fill, no half-charged buyer, and no transaction on the record.
4. Demand scales what a customer pays and leaves what a supplier charges alone; a restock
   spends the shop's own funds at the buy price, in the authored `restockQuantity`.
5. A restock beyond shelf capacity is refused whole rather than topped up to the brim.
6. Production consumes its inputs the moment the job starts and produces its output exactly
   once on completion — the input stock is unchanged between start and finish.
7. A job cancelled a hair before finishing refunds exactly what it consumed and produces
   nothing, even after the frames it would have needed have passed.
8. A recipe with an authored unlock condition is locked, and says `locked` rather than
   failing for some other reason.
9. Placement is validated, not merely recorded: outside the buildable zone, overlapping a
   placed station, and an access point that lands somewhere unstandable each fail **by name**.
10. A customer walks the whole authored seven-phase flow in order and buys something. The
    shell never moved them between phases; it recorded what the capability announced.
11. The queue is strictly FIFO. The three customers are deliberately named so that *id
    order is the reverse of join order* — the economy iterates customers by ascending id for
    reproducibility, and with ids that happened to sort in join order this step would pass
    even against a broken queue.
12. An arrival beyond the queue's authored capacity leaves rather than waiting invisibly.
13. Patience runs out while walking and waiting, the hurried customer leaves cleanly, and
    everyone behind them is still served.
14. Out-of-stock and unaffordable are different facts: the same one-coin customer reports
    `out-of-stock` with an empty shelf and `unaffordable` once the pie exists.
15. Offline catch-up aggregates whole completed batches — the in-flight one plus as many
    more as the absence and the shelf can pay for — and never replays frames.
16. A very long absence is clamped to the authored maximum and says so; a clock that moved
    backwards credits nothing at all.
17. Prestige is ineligible until the authored condition holds, then resets the scopes it
    declares, keeps the one it retains, and grants its reward *after* the currency wipe so
    the reward survives it.
18. The prestige multiplier is load-bearing: the same recipe completes in half the frames.

## Negative controls

| Sabotage | Expected |
| --- | --- |
| A refused transaction still moves the stock | steps 3–7 FAIL |
| Offline catch-up is not clamped to the authored maximum | step 16 FAILS |
| A cancelled job does not refund what it consumed | step 7 FAILS |
| The queue promotes whoever it reaches instead of the head | step 11 FAILS |
| Patience never expires | step 13 FAILS |
| The prestige reward is granted before the currency wipe | step 17 FAILS |

The FIFO control is the one worth reading: it initially **passed** against a broken queue,
because the customer ids happened to sort in join order. Step 11 was rewritten with ids that
sort against it, and the control then failed as it should.
