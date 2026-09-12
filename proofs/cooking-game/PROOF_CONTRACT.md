# Proof Contract — cooking-game

Frozen before implementation. Category-C Wave 15 (existing `sw2d.arcade`, ADR-0042) - ordered ingredient steps on the arcade ledger.

## Preset

`cooking-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `ui-simulation`, required packs **`sw2d.arcade`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-cooking-game --preset cooking-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.arcade` (score): a three-step recipe; adding the wrong ingredient counts a mistake and does not advance; the right one advances; `ready` scores. `ARCADE_STARTER = 'cooking'`.

## Terminal success/failure oracle

- **Success surface:** a wrong ingredient is a counted mistake at step 0; flour then egg advance to step 2; the third ingredient makes the dish `ready` (`recipeStep 3`, score > 0, `complete`); restart reinstalls.
- **Failure surface:** `arcade.{phase,selectedIndex,recipeStep,mistakes,score,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `cooking`; `recipeStep 0`.
2. ArrowRight, CONFIRM -> `wrong`, `mistakes 1`, `recipeStep 0`.
3. ArrowLeft, CONFIRM -> `added`, step 1; ArrowRight, CONFIRM -> step 2.
4. ArrowRight, CONFIRM -> `ready`, step 3, `mistakes 1`, `complete`.
5. Restart: step 0, `mistakes 0`, `score 0`.

## Acceptance

- Zero console errors, zero external requests.
