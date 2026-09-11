# Proof Contract — shopkeeper

Frozen before implementation. Category-C Wave 1 (`sw2d.economy`, ADR-0028) - the shop-counter consumer.

## Preset

`shopkeeper` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.economy`** (mode `shop`). Content roles tuning.

Generated via `npm run sw2d -- new proof-shopkeeper --preset shopkeeper` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.economy` (`simulation.economy`) from `content/economy.json`: customer demand queue, matching-good serve, cash settlement, restock cost, refusal results (`no-customer`, `cannot-afford`, `wrong-good`).
- `bindStarterEconomy` (shared ui-simulation shell): ARROWS select the good, CONFIRM serves, SECONDARY_ACTION restocks. No private ledger in the shell.

## Terminal success/failure oracle

- **Success surface:** a customer is served for the good it wants (`served 1`, cash up); serve spam with an empty counter is refused; restock costs cash and is refused once the wallet is empty (`cannot-afford`); pause/resume preserves the ledger; restart reinstalls a fresh economy (`served 0`, starting cash).
- **Failure surface:** `economy.{cash,stock,queue,served,lost,selectedId,lastResult,frontWant}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `sw2d.economy` installed; mode `shop`; `served 0`.
2. Wait for a customer; select the wanted good; CONFIRM -> `served 1`, cash increased, `lastResult 'served'`.
3. CONFIRM ×6 with nobody waiting -> `no-customer`, `served` unchanged.
4. Select bread; SECONDARY_ACTION -> `restocked`, cash decreased; ×24 more -> `cannot-afford`, cash never negative.
5. Serve the next customer -> `served 2`.
6. Pause, resume: `served`/`cash` unchanged. Restart: `runIndex` +1, `served 0`, cash back to the starting value.

## Acceptance

- The generated shop consumes the reusable economy service; theme, layout and walking customers stay out (catalog limitation).
- Refusals are results, not crashes. Restart genuinely reinstalls.
- Zero console errors, zero external requests.
