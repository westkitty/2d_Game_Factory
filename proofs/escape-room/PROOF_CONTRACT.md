# Proof Contract — escape-room

Frozen before implementation. Category-C Wave 12 (existing `sw2d.puzzle` code seam, ADR-0039) - two linked hotspots on the pointer shell.

## Preset

`escape-room` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `pointer (+ ui-simulation)`, required packs **`sw2d.puzzle`** (`configSource: 'code'`, `escape-locks`). Content roles tuning.

Generated via `npm run sw2d -- new proof-escape-room --preset escape-room` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.puzzle` code seam: `escape-locks` - the lock is `locked` until the note is inspected, then the key opens it; ADR-0018 spatial pointer clicks resolve the hotspots.

## Terminal success/failure oracle

- **Success surface:** the lock before the note is `locked`; the note sets `note` (idempotent on a second click); the lock then yields the key and `solved`; restart reinstalls (nothing found).
- **Failure surface:** `puzzle.{kind,note,key,solved,lastResult}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; kind `escape-locks`; nothing found.
2. Click the lock (480,280) -> `locked`.
3. Click the note (240,280) -> `note true`; click again -> unchanged.
4. Click the lock -> `key true`, `solved`.
5. Restart: `note false`, `key false`, not solved.

## Acceptance

- An escape-room grammar beyond authored hotspots is not this seam (catalog limitation).
- Zero console errors, zero external requests.
