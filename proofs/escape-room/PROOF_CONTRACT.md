# Proof Contract — escape-room

Final Product Completion Wave 4 L25/L46 — inspect hotspots on the pointer shell, rules in `content/puzzles.json`.

## Preset

`escape-room` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `pointer (+ ui-simulation)`, required packs **`sw2d.puzzle-rules`** (`escape` kind). Content roles tuning, puzzles.

Generated via `npm run sw2d -- new proof-escape-room --preset escape-room` (the canonical factory, unmodified).

## Reusable capability exercised

- `sw2d.puzzle-rules` `escape` kind: authored interactables, flag gates and completion; ADR-0018 spatial pointer clicks issue `inspect` ops.

## Terminal success/failure oracle

- **Success surface:** the lock before the note is `locked`; the note sets `note` (idempotent on a second click); the lock then yields the key and `solved`; restart reinstalls (nothing found).
- **Failure surface:** `puzzle.{kind,note,key,solved,lastResult}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; kind `escape`; nothing found.
2. Click the lock (480,280) -> `locked`.
3. Click the note (240,280) -> `note true`; click again -> unchanged.
4. Click the lock -> `key true`, `solved`.
5. Restart: `note false`, `key false`, not solved.

## Acceptance

- The inspect/flag grammar is content (`content/puzzles.json`); no TypeScript placeholder.
- Zero console errors, zero external requests.
