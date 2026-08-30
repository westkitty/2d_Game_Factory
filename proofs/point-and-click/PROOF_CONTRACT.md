# Proof Contract — point-and-click

Frozen before implementation. Phase 1 of the capability-completion program (reusable spatial pointer & interaction, ADR-0018).

## Preset

`point-and-click` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller families `pointer` + `ui-simulation`, required packs `sw2d.narrative`, `sw2d.world`, `sw2d.world-entities`, optional `sw2d.puzzle`. Content roles `tuning`, `levels`, `dialogue`.

Generated via `npm run sw2d -- new proof-point-and-click --preset point-and-click`, moved from `games/` into this committed `proofs/point-and-click/` tree. Only `src/game-specific/shellPack.ts` is customized.

## Reusable capability exercised

- `SceneContext.interaction` (`InteractionServiceImpl`) — hover enter/leave, click, and a full drag → drop cycle with pointer capture.
- `phaserBoundsShape` (`@sw2d/runtime`) — the draggable key's live world bounds are its hit shape, so it stays grabbable while it moves.
- `SceneContext.spatialPointer` — the world-space pointer the service reads each frame.
- Drop-zone resolution — a `dropZone: true` target reports which dragged target it received (`onDrop({ sourceId })`), and the dragged target learns its `dropTargetId` in `onDragEnd`.

## Game-specific mechanics (`src/game-specific/shellPack.ts`)

- A **lever** rectangle at `(200,270)`: `onHoverEnter`/`onHoverLeave` set `leverHovered`; `onClick` sets `leverPulled`.
- A **key** image at `(480,400)`, priority 5, hit shape = its live bounds: `onDragStart` tints it, `onDrag` moves it to the pointer's world position, `onDragEnd` snaps it home unless it was dropped on the chest.
- A **chest** drop-zone at `(760,270)`, 96×96, `dropZone: true`: `onDrop` with `sourceId === 'key'` sets `keyInChest` and parks the key in the chest.
- Debug snapshot (`game.pointer-shell`): `leverHovered`, `leverPulled`, `keyInChest`, `hoveredId`, `draggingId`, `keyX/Y`, `pointerWorldX/Y`.

## Terminal success/failure oracle

- **Success surface:** `leverPulled === true` after the lever click, and `keyInChest === true` after the drag, with the key parked at the chest.
- **Failure surface (all observable):** `leverHovered`, `leverPulled`, `keyInChest`, `hoveredId`, `draggingId`, `keyX/Y`.

## Defining journey (automated, real-browser, real PointerEvents, deterministic frame stepping)

1. Start the run (`Space`); scene reaches `sw2d.play`; `leverPulled` and `keyInChest` are false.
2. Move the mouse onto the lever `(200,270)`: `hoveredId === 'lever'`, `leverHovered === true`. Move to `(480,120)`: `leverHovered === false`, `hoveredId === null` — hover enter and leave both fire.
3. Press and release on the lever: `leverPulled === true`.
4. Press on the key `(480,400)`, move through `(600,335)` to `(760,270)`, release. Mid-drag: `draggingId === 'key'` and the key tracks the pointer. After release: `keyInChest === true`, `draggingId === null`, the key parked at `≈ (760,270)`.
5. Restart (pause, then `SECONDARY_ACTION`): the play scene reinstalls; `leverPulled` and `keyInChest` false; the key back at `≈ (480,400)`.

## Acceptance

- Hover state changes as the cursor enters and leaves a target (step 2).
- A click selects / interacts with the target under the cursor (step 3).
- Drag/drop works on at least one object, including pointer capture (the drag target stays captured while the pointer travels well outside its own bounds) and drop-zone resolution (step 4).
- Restart genuinely reinstalls the scene (step 5).
- Zero console errors, zero external requests (shared `runSmoke` oracle).

---

## Post-ten program Phase 20 extension (dialogue, ADR-0034)

The five steps above are the certified Phase-1 spatial-interaction journey and are
**unchanged**: the same lever, key, chest, hover, click, drag, drop and restart.

### Additional composition

`sw2d.dialogue` is added to `content/game.json`, and `content/dialogue.json`
(`urn:sw2d:schema:content-dialogue:v1`) authors a short warden conversation whose choice
sets a world flag. A fourth interactive object — the warden — is registered with the same
`context.interaction` service the Phase-1 objects use.

### Additional journey steps

6. **World click opens a conversation.** Clicking the warden starts the dialogue; nothing was
   showing before the click. The full line is in the DOM immediately — the same
   accessibility bar the visual-novel proof holds the overlay to.
7. **The two-press reveal rule.** While a reveal is painting, CONFIRM completes it rather
   than skipping the line; only the next press moves on. A player who reads faster than the
   animation must never lose a line to an eager keypress. With reduced motion there is no
   reveal to complete and one press is enough; the step asserts whichever is correct in the
   environment it runs in. The choices then appear as real buttons.
8. **The choice's effect writes through `world.state`**, not into the dialogue.
9. The conversation ends and the overlay goes away, leaving the world alone.
10. **The consequence.** An ordinary world interaction some time later — the same
    drag-and-drop the Phase-1 journey already proved — observes what was decided in the
    conversation. This is the thing a fake dialogue cannot produce: the chest records
    whether it was blessed *at the moment the key went in*.

### Additional negative controls

| Sabotage | Expected |
| --- | --- |
| Advancing steps past a pending decision | steps 7, 8, 10 FAIL |
| An effect skips its capability owner | steps 8 and 10 FAIL |
