# Proof Contract — microgame-collection

Frozen before implementation. Category-C Wave 28 (existing `sw2d.arcade`, ADR-0055) - wait/go/mash rounds on the arcade ledger.

## Preset

`microgame-collection` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `ui-simulation`, required packs **`sw2d.arcade`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-microgame-collection --preset microgame-collection` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.arcade` (score): round 1 is a reaction tap (`wait` -> `go`), round 2 is a five-press mash; each round scores. `ARCADE_STARTER = 'micro'`.

## Terminal success/failure oracle

- **Success surface:** tapping during `wait` does not advance; tapping at `go` scores and moves to the mash round; five PRIMARY presses complete the set (`mash 5`, `complete`); extra presses are inert; restart reinstalls.
- **Failure surface:** `arcade.{phase,round,mash,score,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `micro`; `wait`; `round 1`.
2. CONFIRM during `wait` -> round 1, `score 0`.
3. Wait for `go`; CONFIRM -> `tapped`, phase `mash`, `round 2`, score > 0.
4. PRIMARY ×5 -> `set`, `mash 5`, `complete`; PRIMARY -> `mash` still 5.
5. Restart: `round 1`, `mash 0`, `wait`.

## Acceptance

- A reusable microgame scheduler stays out (catalog limitation).
- Zero console errors, zero external requests.
