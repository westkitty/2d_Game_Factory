# Proof Contract — fishing-game

Frozen before implementation. Category-C Wave 15 (existing `sw2d.arcade`, ADR-0042) - cast/bite/land on the arcade ledger.

## Preset

`fishing-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `ui-simulation`, required packs **`sw2d.arcade`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-fishing-game --preset fishing-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.arcade` (score/elapsed): CONFIRM casts; a bite window opens on the clock; CONFIRM inside it lands a fish and scores; missing the window returns to idle. `ARCADE_STARTER = 'fishing'`, `bindStarterArcade`.

## Terminal success/failure oracle

- **Success surface:** a missed bite counts a miss and scores nothing; a strike inside the bite window lands (`caught 1`, score up); the second fish completes with double the score; restart reinstalls.
- **Failure surface:** `arcade.{phase,caught,missed,score,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.arcade` installed; mode `fishing`; `idle`; `caught 0`.
2. CONFIRM (cast); wait for `bite`; do nothing -> `missed`, `idle`, `score 0`.
3. CONFIRM; wait for `bite`; CONFIRM -> `landed`, `caught 1`, score > 0.
4. Repeat -> `caught 2`, score doubled, `complete`.
5. Restart: `caught 0`, `score 0`, `idle`.

## Acceptance

- Casting/line/tension/fish behaviour stays out (catalog limitation).
- Zero console errors, zero external requests.
