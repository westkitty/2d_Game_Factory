# Proof Contract — interactive-fiction-hybrid

Frozen before implementation. Category-C Wave 14 (existing `sw2d.narrative`, ADR-0041) - menu verbs on the narrative store.

## Preset

`interactive-fiction-hybrid` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `ui-simulation`, required packs **`sw2d.narrative`**. Content roles tuning.

Generated via `npm run sw2d -- new proof-interactive-fiction-hybrid --preset interactive-fiction-hybrid` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.narrative` (nodes, flags, choices, seen): LOOK/TAKE verbs on a small graph; TAKE is gated on the `saw-note` flag LOOK sets. `NARRATIVE_STARTER = 'fiction'`, `bindStarterNarrative`.

## Terminal success/failure oracle

- **Success surface:** TAKE before LOOK is `locked`; LOOK sets the flag, records the seen entry and moves the node; TAKE then ends the story with the recorded choice; restart reinstalls (`start`, no flags).
- **Failure surface:** `narrative.{nodeId,selectedVerb,flags,seen,choices,lastResult,ending,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.narrative` installed; mode `fiction`; node `start`; verb `LOOK`.
2. ArrowRight, CONFIRM -> `locked`, verb `TAKE`, still `playing`.
3. ArrowLeft, CONFIRM -> `looked`, flag `saw-note`, seen `note`, node `looked`.
4. ArrowRight, CONFIRM -> `escaped`, ending `escaped`, choices include `take`, `complete`.
5. Restart: node `start`, no flags, no ending.

## Acceptance

- A parser/text-command system stays out (catalog limitation).
- Zero console errors, zero external requests.
