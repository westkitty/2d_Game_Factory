# Proof Contract — sandbox-playground

Frozen before implementation. Category-C Wave 20 + Wave 31 (ADR-0018 click stamps + pick/move/delete authoring, ADR-0047 / ADR-0058).

## Preset

`sandbox-playground` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `pointer (+ ui-simulation)`, required packs `sw2d.world`, `sw2d.world-entities`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-sandbox-playground --preset sandbox-playground` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterToy` (`TOY_STARTER 'sandbox'`): a click stamps the selected kind; clicking a stamp picks it up; the next click moves it; SECONDARY removes the held (else most recent) stamp, `empty` when none; ARROWS cycle the stamp kind.

## Terminal success/failure oracle

- **Success surface:** stamp → hold → move (`moved 1`, one block); remove → `remove-block`, then `empty`; re-stamp a block, switch to ball, stamp a ball -> `complete`; restart reinstalls an empty board.
- **Failure surface:** `toy.{selected,blocks,balls,stamps,held,moved,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `sandbox`; empty board; `selected 'block'`.
2. Click (400,280) -> `stamp-block`; click it -> `hold-block`; click (500,320) -> `move-block`, `moved 1`.
3. SECONDARY -> `remove-block`, `blocks 0`; SECONDARY -> `empty`.
4. Click (400,280); ArrowRight -> `selected 'ball'`; click (600,280) -> `stamp-ball`, `complete`.
5. Restart: `blocks 0`, `balls 0`, `playing`.

## Acceptance

- Generalized authoring beyond stamps stays out (catalog limitation).
- Zero console errors, zero external requests.
