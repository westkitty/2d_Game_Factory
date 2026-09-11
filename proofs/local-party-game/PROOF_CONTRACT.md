# Proof Contract — local-party-game

Frozen before implementation. Category-C Wave 7 (`sw2d.local-play`, ADR-0034) - the hot-seat consumer.

## Preset

`local-party-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `ui-simulation`, required packs `sw2d.arcade`, **`sw2d.local-play`** (mode `hotseat`). Content roles tuning.

Generated via `npm run sw2d -- new proof-local-party-game --preset local-party-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.local-play` (`arcade.seats`) from `content/local-play.json`: two seats, turn ownership passes on each act, per-seat scores, a winner after the round.
- `bindStarterLocalPlay` (shared ui-simulation shell): PRIMARY/CONFIRM acts for the current seat.

## Terminal success/failure oracle

- **Success surface:** the first act scores for seat 0 and passes to seat 1; the second scores for seat 1 and passes back; after six acts the round is `complete` with a winner; further acts are inert; restart reinstalls (`turns 0`, `winner null`).
- **Failure surface:** `localPlay.{currentPlayer,scores,turns,winner,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.local-play` installed; mode `hotseat`; `turns 0`; `currentPlayer 0`.
2. PRIMARY -> `turns 1`, `currentPlayer 1`, `scores[0] > 0`.
3. PRIMARY -> `turns 2`, `currentPlayer 0`, `scores[1] > 0`.
4. PRIMARY ×4 -> `turns 6`, `winner` set, `complete`; PRIMARY -> `turns` still 6.
5. Restart: `turns 0`, `winner null`, `playing`.

## Acceptance

- Seat ownership is the reusable service; netcode, gamepads and split-screen stay out (catalog limitation).
- Zero console errors, zero external requests.
