# ADR-0028: Customer demand, stock, transactions and production jobs are one reusable economy capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 1

## Context

`shopkeeper`, `restaurant` and `tycoon-lite` carried `LIMITATIONS.customerEconomy`:
"No complete customer AI, demand/economy model, queue/placement UI, or
content-authored production chain exists." Three management recipes needed the
same underlying loop (stock, a demand queue, settlement, production jobs) with
different presentation and pacing. Folding that into `sw2d.simulation` would
have turned a resource-ledger + timed-job primitive into a genre monolith.

## Decision

**One renderer-neutral, simulation-time capability with three bounded modes.
Not three engines, and not a shop/restaurant/tycoon DSL.**

- **`sw2d.economy` → `simulation.economy`.** `EconomyService` owns cash, stock,
  the demand queue, `serve()`, `secondary()` (restock or start a recipe) and
  `tick(deltaMs)`. Spawn order is the authored demand list cycling by spawn
  index — no RNG. Patience, production remaining and spawn timers use
  simulation time (`deltaMs`), never `Date.now`.
- **Three modes of one update:**
  - `shop` — CONFIRM serves the front customer only if the selected good
    matches; SECONDARY restocks the selected good for `restockCost`.
  - `kitchen` — SECONDARY starts the selected recipe; CONFIRM serves when the
    requested good is in stock (cook, then plate).
  - `factory` — SECONDARY starts a recipe; waiting customers auto-buy when
    stock exists (`autoSell`).
- **`content/economy.json`** (schema `economy-catalog`, document `economy`),
  always emitted. Empty/inert unless the preset installs the pack. The
  generator maps restaurant → kitchen, tycoon-lite → factory, other economy
  consumers → shop.
- **The generated `uiSimulationShellPack`** calls `bindStarterEconomy`. When
  the pack is absent the dummy option-picker remains. Presentation is a
  high-contrast HUD; walking customers, shop layout, prestige and offline
  catch-up stay game-specific / honestly limited.
- **Workbench:** `POST /api/economy/inspect` + a compact inspector (mode,
  goods, recipes, demand, spawn). Read-only; editing is JSON work on the file.

## Consequences

- Consumers: `shopkeeper` (shop), `restaurant` (kitchen), `tycoon-lite`
  (factory). All three require `sw2d.economy` and content role `economy`.
- `LIMITATIONS.customerEconomy` rewritten to name what is reusable and what
  is not. Twenty packs now have a preset consumer.
- Duplicate good/recipe ids throw at install. A missing document yields an
  inert shop (maxQueue 0), not a crash. Wrong-good / no-stock / cannot-afford
  are reported reasons, never silent no-ops.

## Rejected

- **Folding this into `sw2d.simulation`.** That pack is a resource ledger plus
  a timed-job primitive and explicitly is not a shop/restaurant/tycoon.
- **A walking-customer / layout / prestige system.** Those are
  presentation and meta-progression, not shared transaction semantics.
- **RNG demand.** Authored cycling is deterministic and content-authorable.
- **Wall-clock patience.** `tick(deltaMs)` only.
