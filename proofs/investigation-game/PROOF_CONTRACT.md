# Proof Contract — investigation-game

Frozen before implementation. Category-C Wave 14 + Wave 30 (`sw2d.narrative` case presentation + `sw2d.codex` case inspection, ADR-0041 / ADR-0057).

## Preset

`investigation-game` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `top-down (+ pointer)`, required packs **`sw2d.narrative`**, `sw2d.world`, `sw2d.world-entities`, **`sw2d.codex`** (mode `case`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-investigation-game --preset investigation-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.narrative` (`NARRATIVE_STARTER 'case'`, `bindStarterNarrative`): walk to clues, PRIMARY inspects (seen entries), the desk deduces once the clues are seen.
- `sw2d.codex` (`narrative.codex`, case mode) records the inspected entries.

## Terminal success/failure oracle

- **Success surface:** inspecting with nothing in reach is `too-far`; the print and photo are each `inspected` exactly once (re-inspecting does not duplicate); the desk `deduced` closes the case with the `deduce` choice; restart reinstalls (nothing seen, no ending).
- **Failure surface:** `narrative.{seen,choices,nearId,lastResult,ending,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.narrative` + `sw2d.codex` installed; mode `case`; nothing seen.
2. PRIMARY -> `too-far`.
3. Hold Right until `nearId 'print'`; PRIMARY -> `inspected`, seen [print]; PRIMARY -> still one entry.
4. Hold Right until `nearId 'photo'`; PRIMARY -> seen [print, photo].
5. Hold Right until `nearId 'desk'`; PRIMARY -> `deduced`, ending `closed`, choices include `deduce`, `complete`.
6. Restart: nothing seen, no ending, `playing`.

## Acceptance

- An evidence-board / linking system is not this pack (catalog limitation).
- Zero console errors, zero external requests.
