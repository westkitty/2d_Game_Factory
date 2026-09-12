# Proof Contract — visual-novel

Frozen before implementation. Category-C Wave 3 (`sw2d.dialogue`, ADR-0030) - the novel reading loop. Supersedes the Phase 8 demo's smoke-level evidence.

## Preset

`visual-novel` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `ui-simulation`, required packs `sw2d.narrative`, **`sw2d.dialogue`** (mode `novel`). Content roles tuning.

Generated via `npm run sw2d -- new proof-visual-novel --preset visual-novel` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.dialogue` (`narrative.dialogue`) from `content/dialogue.json`: a linear line sequence, a choice node with two options, two branches, two endings.
- `bindStarterDialogue` (shared ui-simulation shell): CONFIRM advances / chooses, ARROWS move the choice cursor.

## Terminal success/failure oracle

- **Success surface:** step 2 is a `choice`; option 1 leads to `keep-the-secret` and `midnight-ending` (`complete`); advancing past the ending is inert; restart reinstalls at step 0; option 0 after restart reaches `dawn-ending`.
- **Failure surface:** `dialogue.{kind,step,selectedIndex,branch,ending,outcome,flags}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.dialogue` installed; mode `novel`; `step 0`.
2. CONFIRM ×2 -> `kind 'choice'`, `step 2`, `selectedIndex 0`.
3. ArrowRight -> `selectedIndex 1`; CONFIRM -> `branch 'keep-the-secret'`; CONFIRM -> `ending 'midnight-ending'`, `complete`.
4. CONFIRM -> unchanged.
5. Restart: `step 0`, `ending null`. CONFIRM ×2, ArrowLeft, CONFIRM ×2 -> `ending 'dawn-ending'`.

## Acceptance

- Both branches are reachable from the same generated graph; portraits and scene composition stay out (catalog limitation).
- Zero console errors, zero external requests.
