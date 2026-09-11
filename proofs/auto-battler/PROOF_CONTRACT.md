# Proof Contract — auto-battler

Frozen before implementation. Category-C Wave 18 + Wave 30 (`sw2d.strategy` + `sw2d.targeting` auto mode, ADR-0045 / ADR-0057) - pick a lineup, lock it, watch the autonomous fight.

## Preset

`auto-battler` (`packages/presets/src/catalog/strategyDefense.ts`) — controller family `ui-simulation`, required packs **`sw2d.strategy`**, `sw2d.combat`, `sw2d.ai`, **`sw2d.targeting`** (mode `auto`). Content roles tuning.

Generated via `npm run sw2d -- new proof-auto-battler --preset auto-battler` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.targeting` (`combat.targeting`, auto mode) from `content/targeting.json`: two sides auto-strike on cooldowns; the pack is the one health owner (`health(id)`).
- `sw2d.strategy` teams/turns; `bindStarterStrategy` (battler): ARROWS pick a fighter, CONFIRM locks the lineup and starts the fight. The convergence program removed a second `combat.health` owner that had left the HUD at full health while the fight declared `won`.

## Terminal success/failure oracle

- **Success surface:** nothing fights until CONFIRM (cpu health unchanged after 40 idle frames); the pick cycles the lineup; CONFIRM -> `fight`, the pick is frozen and a second CONFIRM is `auto`, not a strike; cpu health falls during the fight and reaches 0 at `won` / `complete`; restart reinstalls (full cpu health, `playing`).
- **Failure surface:** `strategy.{fighter,cpuHealth,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.strategy` + `sw2d.targeting` installed; mode `battler`; `cpuHealth` = max.
2. 40 frames idle -> `cpuHealth` unchanged.
3. ArrowRight -> `fighter` changes.
4. CONFIRM -> `fight`; ArrowRight -> `fighter` unchanged; CONFIRM -> `auto`.
5. Wait -> `cpuHealth` strictly between max and 0, then `won`, `complete`, `cpuHealth 0`.
6. Restart: `playing`, `cpuHealth` = max.

## Acceptance

- The lineup pick is presentation (it does not change the fighting actor) - catalog limitation.
- Zero console errors, zero external requests.
