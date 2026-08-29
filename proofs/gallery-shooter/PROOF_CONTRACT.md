# Proof Contract — gallery-shooter

Frozen before implementation. Phase 1 of the capability-completion program (reusable spatial pointer & interaction, ADR-0018).

## Preset

`gallery-shooter` (`packages/presets/src/catalog/shooter.ts`) — controller family `pointer`, required pack `sw2d.combat`, optional `sw2d.arcade`. Content role `tuning`.

Generated via `npm run sw2d -- new proof-gallery-shooter --preset gallery-shooter`, moved from `games/` into this committed `proofs/gallery-shooter/` tree. Only `src/game-specific/shellPack.ts` is customized.

## Reusable capability exercised

- `SceneContext.spatialPointer` (`@sw2d/runtime` `SpatialPointerHost`) — world-space cursor position, advanced once per frame in the runtime's PRE_STEP handler alongside `ActionInputHost`. Not fields on `ActionInput` (ADR-0016 / ADR-0018).
- `SceneContext.interaction` (`InteractionServiceImpl`) — three circular targets plus one lowest-priority full-viewport background target are registered; a click is resolved against the world point, so the target the cursor is actually over takes the hit.
- `hitTestPoint` (`@sw2d/contracts`) — the pure circle/rect test behind hit resolution.
- `sw2d.combat` (`CombatService`) — each target registered with health 1; a click applies lethal damage.
- Engine-level pause / restart — no game-specific code.

## Game-specific mechanics (`src/game-specific/shellPack.ts`)

- Three targets at fixed world positions `(240,180)`, `(480,360)`, `(720,180)`, radius 40, each a circle interaction target with an `onClick` that kills it once.
- One `background` interaction target, priority −1, spanning the whole viewport: an `onClick` here increments `misses` and sets `lastHitId = null`. This is how "an empty click selects nothing" is proven — through the service's own priority ordering, not a special case.
- Hover tint toggling via `onHoverEnter`/`onHoverLeave`.
- Debug snapshot (`game.pointer-shell`): `hits`, `misses`, `lastHitId`, `lastClickWorldX/Y`, `hoveredId`, `pointerWorldX/Y`, `pointerActive`, per-target `{alive}`.

## Terminal success/failure oracle

- **Success surface:** after the scripted journey, `hits === 2` with `lastHitId` naming the last target clicked, `misses === 1`, and the correct two targets dead.
- **Failure surface (all observable):** `hits`, `misses`, `lastHitId`, `lastClickWorldX/Y`, `hoveredId`, `pointerWorldX/Y`, per-target `alive`.

## Defining journey (automated, real-browser, real PointerEvents, deterministic frame stepping)

1. Start the run (`Space`); scene reaches `sw2d.play`; all three targets alive; `hits`/`misses` zero.
2. Move the mouse to world `(240,180)`; `hoveredId === 'target-a'` and `pointerWorldX/Y` equal `(240,180)` — the world point is resolved through the play camera.
3. Click at `(240,180)`; `hits === 1`, `lastHitId === 'target-a'`, `target-a` dead, `target-b` still alive, `lastClickWorldX ≈ 240`.
4. Click empty space at `(900,500)`; `misses === 1`, `lastHitId === null`, `hits` unchanged, `target-c` still alive — an empty click selects nothing.
5. Click at `(720,180)`; `hits === 2`, `lastHitId === 'target-c'`, `target-c` dead — still resolved by world position, not proximity or spawn order.
6. Restart (pause, then `SECONDARY_ACTION`): the play scene reinstalls; `hits`/`misses` back to 0; all three targets alive again.

## Acceptance

- Pointer position drives real world-space targeting (step 2/3/5).
- The spatially selected target — the one under the cursor — takes the hit; not the nearest, not the last spawned.
- Clicking empty space does not select a real target (step 4).
- Restart genuinely reinstalls the scene (fresh target set, zeroed counters).
- Zero console errors, zero external requests (shared `runSmoke` oracle).
