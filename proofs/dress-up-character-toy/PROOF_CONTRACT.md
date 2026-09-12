# Proof Contract — dress-up-character-toy

Frozen before implementation. Category-C Wave 16 (ADR-0018 drag→drop, ADR-0043) - wardrobe attachment on the pointer shell.

## Preset

`dress-up-character-toy` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `pointer (+ ui-simulation)`, required packs (none required - ADR-0018 spatial pointer). Content roles tuning.

Generated via `npm run sw2d -- new proof-dress-up-character-toy --preset dress-up-character-toy` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- ADR-0018 drag with pointer capture (`draggingId` mid-drag) and drop-zone resolution: `bindStarterPointer` (`POINTER_STARTER 'wardrobe'`) attaches a garment dropped on the figure.

## Terminal success/failure oracle

- **Success surface:** a garment dropped away from the figure does not attach; mid-drag the hat is captured (`draggingId 'hat'`); dropped on the figure it attaches (`drop-hat`); the shirt completes the outfit; restart reinstalls (nothing attached).
- **Failure surface:** `pointerPlay.{attached,draggingId,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `wardrobe`; nothing attached.
2. Drag the hat to (300,460) -> not attached.
3. Drag the hat to (700,200): mid-drag `draggingId 'hat'`; drop -> `drop-hat`, attached [hat].
4. Drag the shirt to (700,300) -> `drop-shirt`, attached [hat, shirt], `complete`.
5. Restart: nothing attached, `playing`.

## Acceptance

- Attachment skeletons / layered wardrobes stay out (catalog limitation).
- Zero console errors, zero external requests.
