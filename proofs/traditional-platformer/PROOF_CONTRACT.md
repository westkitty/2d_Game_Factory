# Proof Contract — traditional-platformer

Frozen before implementation. Category-C convergence - the universal level's objectives consumed through `sw2d.world` + `sw2d.world-entities` (`bindLevelObjectives`). Supersedes the Phase 8 demo's smoke-level evidence.

## Preset

`traditional-platformer` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.world`, `sw2d.world-entities`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-traditional-platformer --preset traditional-platformer` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindLevelObjectives` (shared platform + top-down shells): the generated `content/levels/main.json` Checkpoint activates in `world.state`, the Hazard resets the player to the last checkpoint, the Collectible counts toward a quota, and the Exit clears the level once the quota is met. Before the convergence program the plain shell dispatched none of these and the preset stated no limitation.

## Terminal success/failure oracle

- **Success surface:** a jump from rest leaves the ground; walking activates `checkpoint-1` and collects the coin; the spikes reset the player to the checkpoint (`resets 1`, x back near 180); pause keeps the counters; jumping the spikes reaches the exit (`cleared`, `complete`, x >= 860) and input no longer moves the player; restart reinstalls (nothing collected, no checkpoint, spawn x).
- **Failure surface:** `objectives.{collected,quota,checkpoint,resets,cleared,outcome}`, player `x`/`y`/`vx`/`vy`/`onGround`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.world` + `sw2d.world-entities` installed; `objectives.quota 1`; no checkpoint.
2. JUMP -> off the ground; land; hold Right -> x increases, vx > 0.
3. Walk on -> `checkpoint 'checkpoint-1'`, `collected 1`; spikes -> `resets 1`, x in (120, 260).
4. Pause/resume -> `resets 1`.
5. Hold Right to x >= 380, JUMP over the spikes -> `cleared`, `complete`, `resets 1`, x >= 860; Left ×10 frames -> x unchanged.
6. Restart: `collected 0`, `resets 0`, `checkpoint null`, x < 100.

## Acceptance

- `packages/runtime/src/game-support/levelObjectives.ts` is inert without `sw2d.world` and leaves collectibles to `sw2d.items` when that pack owns them.
- Zero console errors, zero external requests.
