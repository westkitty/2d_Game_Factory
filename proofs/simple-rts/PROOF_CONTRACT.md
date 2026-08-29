# Proof Contract — simple-rts

Frozen before implementation. Phase 14 of the post-ten capability program (strategy orders & tactical actions).

## Preset

`simple-rts` (`packages/presets/src/catalog/strategyDefense.ts`) — controller family `top-down`,
required packs `sw2d.strategy`, `sw2d.combat`, `sw2d.navigation`, **`sw2d.strategy-actions`**.
Content roles `tuning`, `levels`.

Customized only in `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- `sw2d.strategy-actions` → **`strategy.orders`** (`StrategyOrdersService`): order ids, issue/queue
  order, `replace` / `append` / `front` policy, `queued` → `active` → `completed | cancelled | failed`
  transitions, `cancel` / `stop`, named actor groups, the tick counter, and the failure vocabulary
  (`invalid-target`, `target-lost`, `actor-removed`, `unreachable`, `superseded`).
- `sw2d.strategy-actions` → **`strategy.tactics`** (`StrategyTacticsService`) reading the validated
  `content/strategy-actions.json` (`urn:sw2d:schema:content-strategy-actions:v1`): range verdicts and
  the order an action raises.
- `sw2d.navigation` (`NavGrid`, `createRouteFollower`) — used *inside* the shell's `OrderWorldAdapter`,
  so a move order is genuinely routed and a destination in the wall genuinely has no route.
- `sw2d.combat` (`CombatService`) — the damage an attack order applies.

## What is deliberately game-specific

Exactly two things, and both are the things a renderer-neutral capability cannot own:

1. **The selection surface** — `selectBox(x, y, w, h)` turning a world rectangle into a set of actor ids.
2. **The `OrderWorldAdapter`** — `actor()` (where a unit is, whether it lives), `begin()`/`advance()`
   (what one tick of move/attack/attack-move does), `end()`.

The shell never authors an order status, an order id, a queue position or a failure reason.

## Terminal success/failure oracle

- **Success surface:** the shell's debug snapshot — per-unit position/cell/hp/alive, the active order
  summary and queue length per actor, `pendingCount`, `historyCount`, and the last resolved order —
  plus the `StrategyOrder` records read straight back out of the service.
- **Failure surface:** the same snapshot, plus zero console errors and zero external requests
  (shared `runSmoke` oracle).

## Defining journey (automated, real-browser, 13-step verification)

1. Boot: `sw2d.strategy-actions` and `sw2d.navigation` installed; five units at their authored cells at
   full health; no pending orders; nothing selected.
2. A drag rectangle selects exactly two of the three blue units (`blue-1`, `blue-2`), not the third.
3. A move order to both selected units produces one order each, ids `ord-1`/`ord-2` in ascending actor
   order, both `queued`, `pendingCount === 2`.
4. On the following tick the order is `active` and the unit has actually moved.
5. On arrival the order is `completed`, with `resolvedTick > startedTick`, the unit at the target cell,
   nothing pending, and two entries in history.
6. An attack order against a specific enemy is accepted for one unit and becomes the active order.
7. The target takes real `sw2d.combat` damage until it dies; the order then reports `completed` and the
   `orders:resolved` event carries the same order id.
8. Queue policy: `append` sits behind the active order; the default `replace` cancels both the active
   order and the queued one, each with `failureReason: 'superseded'`.
9. `stop` clears an actor's whole lane; `cancel` resolves a specific queued order as `cancelled`.
10. Invalid and lost targets: an unknown entity is rejected `invalid-target`; a dead one `target-lost`;
    a destination inside the wall column fails `unreachable`; a unit killed while holding a live order
    has that order failed `actor-removed`.
11. A named squad (`defineGroup`) takes one command that produces one order per member.
12. `strategy.tactics` reads the same catalog: `focus-fire` (range 220) is `out-of-range` from the far
    unit and valid from the near one, and executing it raises an `attack` order carrying `abilityId`
    that damages the target.
13. Determinism: from an identical start position, the identical move order completes at the identical
    position after the identical number of simulation ticks, twice.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Order lifecycle, queue policy, cancellation and every failure reason come from the reusable pack,
  not from the shell.
- Zero console errors, zero external requests.

## Negative-control verification

Each of these sabotages of `packages/packs/src/strategyActions/strategyActionsPack.ts` was applied,
observed to fail the expected step, and reverted:

| Sabotage | Result |
| --- | --- |
| `stop()` returns without clearing the lane | step 9 FAIL, step 8 PASS |
| dead-target detection removed (issue-time and per-tick) | step 10 FAIL |
