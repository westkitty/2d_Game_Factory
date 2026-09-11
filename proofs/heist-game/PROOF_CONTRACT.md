# Proof Contract — heist-game

Frozen before implementation. Category-C Wave 4 (`sw2d.perception`, ADR-0031) - the loot-trips-the-alarm consumer.

## Preset

`heist-game` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.ai`, `sw2d.combat`, `sw2d.world`, **`sw2d.perception`** (mode `heist`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-heist-game --preset heist-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.perception` (`ai.perception`) from `content/perception.json` in heist mode: the exit is not a win until the loot is taken, and taking it trips the alarm; escaping under alarm completes. Materially different from `stealth-game` (never be seen).

## Terminal success/failure oracle

- **Success surface:** the exit before the loot stays `playing`; the loot sets `objectiveCollected` and `alarm true`; the exit then completes with the alarm still raised; restart reinstalls (no alarm, no loot).
- **Failure surface:** `perception.{objectiveCollected,alarm,outcome}`, player `x`/`y`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `heist`; no alarm.
2. Up to the exit -> `objectiveCollected false`, `playing`.
3. Right to x >= 760, Down until `objectiveCollected` -> `alarm true`, still `playing`.
4. Up, then Left until `complete` with `alarm true`.
5. Restart: `playing`, `alarm false`, `objectiveCollected false`.

## Acceptance

- Zero console errors, zero external requests.
