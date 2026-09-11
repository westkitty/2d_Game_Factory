# Proof Contract — photography-game

Frozen before implementation. Category-C Wave 20 + Wave 30 (ADR-0018 walk-to-subject presentation + `sw2d.camera` frame capture, ADR-0047 / ADR-0057).

## Preset

`photography-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `top-down (+ pointer)`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.camera`** (mode `frame`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-photography-game --preset photography-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterToy` (`TOY_STARTER 'photo'`): walk to subjects, PRIMARY captures the framed subject through `sw2d.camera` (`world.camera`, frame mode).

## Terminal success/failure oracle

- **Success surface:** shooting with nothing framed is `too-far`; the bird is captured once (a second shot of the same subject is not a second capture); the tree completes the album (`captured` length 2, `complete`); restart reinstalls (no captures, start x).
- **Failure surface:** `toy.{shots,captured,nearId,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.camera` installed; mode `photo`; `shots 0`; x 120.
2. PRIMARY -> `too-far`, `shots 0`.
3. Hold Right until `nearId 'bird'`; PRIMARY -> `shot-bird`, captured [bird], `shots 1`; PRIMARY -> still one capture.
4. Hold Right until `nearId 'tree'`; PRIMARY -> `shot-tree`, captured [bird, tree], `complete`.
5. Restart: `shots 0`, no captures, x 120.

## Acceptance

- Camera framing/scoring beyond capture-in-range is not this pack (catalog limitation).
- Zero console errors, zero external requests.
