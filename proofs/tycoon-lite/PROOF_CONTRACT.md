# Proof Contract — tycoon-lite

Frozen before implementation. Category-C Wave 1 (`sw2d.economy`, ADR-0028) - the produce-and-auto-sell consumer.

## Preset

`tycoon-lite` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.economy`** (mode `factory`). Content roles tuning.

Generated via `npm run sw2d -- new proof-tycoon-lite --preset tycoon-lite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.economy` (`simulation.economy`) from `content/economy.json` with `autoSell`: SECONDARY_ACTION starts a production job; when stock exists a queued buyer is settled automatically. The player never serves by hand.

## Terminal success/failure oracle

- **Success surface:** a production job runs for real simulation time (`produced` unchanged a few frames in), then auto-sells (`served 1`, cash up); production spam during a running job does not start a second job; a second cycle reaches `served 2`; pause/resume keeps the ledger; restart reinstalls.
- **Failure surface:** `economy.{cash,queue,served,produced,producing,lastResult}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `factory`; a buyer queues.
2. SECONDARY_ACTION -> `producing` set; 3 frames later `produced`/`served` unchanged (time-gated).
3. Wait -> `served 1`, cash > start, `produced >= 1`.
4. SECONDARY_ACTION ×6 while busy -> `produced` unchanged; wait -> `served 2`, cash up again.
5. Pause/resume: `served 2`. Restart: `served 0`, `produced 0`, starting cash.

## Acceptance

- Auto-sell is the factory loop; prestige and offline catch-up stay out (catalog limitation).
- Zero console errors, zero external requests.
