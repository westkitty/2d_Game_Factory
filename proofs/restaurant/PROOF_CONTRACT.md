# Proof Contract — restaurant

Frozen before implementation. Category-C Wave 1 (`sw2d.economy`, ADR-0028) - the cook-then-serve consumer.

## Preset

`restaurant` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.economy`** (mode `kitchen`). Content roles tuning.

Generated via `npm run sw2d -- new proof-restaurant --preset restaurant` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.economy` (`simulation.economy`) from `content/economy.json`: tickets queue, a production job (`cook-<dish>`) runs on simulation time, CONFIRM serves the cooked dish. Materially different from `shopkeeper` (serve from stock) and `tycoon-lite` (auto-sell).

## Terminal success/failure oracle

- **Success surface:** serving with nothing cooked is refused; three tickets are cooked (`producing` non-null while the job runs) then served (`served 3`, cash up each time); pause/resume keeps the ledger; restart reinstalls (`served 0`, `producing null`).
- **Failure surface:** `economy.{cash,queue,served,selectedId,producing,lastResult,frontWant}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.economy` installed; mode `kitchen`.
2. CONFIRM before cooking -> `no-stock` / `no-customer`, `served 0`.
3. For three tickets: select `cook-<want>`, SECONDARY_ACTION -> `producing` set; wait for the job; CONFIRM -> served count +1, cash up.
4. Pause/resume: `served 3` unchanged. Restart: `served 0`, `producing null`, starting cash.

## Acceptance

- Cook-then-serve is a real time-gated production job on the reusable economy, not a shop counter.
- Zero console errors, zero external requests.
