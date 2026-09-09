# ADR-0034: Local hot-seat and versus seats are one reusable input-ownership capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 7

## Context

`local-party-game` needed pass-and-play turns and scores on one keyboard.
`pong` needed a second human axis without rewriting ActionInputHost (WASD
and arrows already share `MOVE_*`). Folding that into `sw2d.arcade` would
have turned a score ledger into a genre monolith. Netcode, gamepads,
split-screen cameras and more than two seats do not fit this contract.
Overlay pong keeps Wave 5 lerp AI so `forceOpponentWin` stays valid.

## Decision

**One renderer-neutral local-seat capability with two bounded modes. Not
two engines, and not a second score authority for pong.**

- **`sw2d.local-play` → `arcade.seats`.** No pack dependencies.
  `LocalPlayService` owns hot-seat turns/scores and versus per-seat axes
  from raw key codes. No Phaser, no wall clock, no RNG, no window
  listeners inside the pack (tests inject `setHeld`).
- **Two modes of one machine:**
  - `hotseat` — six acts, `pointsCycle` `[1,2,3]`, tie awards seat 0.
  - `versus` — disjoint axes only; `act()` is a no-op. Factory pong feeds
    `setOpponentAxis`. Overlay pong does not bind seats.
- **`content/local-play.json`** (schema `local-play-catalog`, document
  `local-play`), always emitted. Empty/inert unless the preset installs
  the pack with at least two players.
- **The generated `uiSimulationShellPack`** calls `bindStarterLocalPlay`
  and acts on J/ENTER. **The generated `topDownShellPack`** pumps versus
  seats into `sw2d.ball-paddle` and leaves lerp AI as the default when
  seats are inert.
- **Workbench:** `POST /api/local-play/inspect` + a compact inspector.

## Consequences

- Consumers: `local-party-game` (hotseat), `pong` (versus). Both require
  `sw2d.local-play` and content role `local-play`.
- `LIMITATIONS.localPlaySeats` names what is reusable and what is not.
  Twenty-six packs now have a preset consumer.
- Duplicate player ids throw at install. A missing document or fewer than
  two players yields an inert service, not a crash.
- `bindStarterLocalPlay` resets seats on bind so a PlayScene restart is a
  new contest. Window listeners live on the binding, not the pack.
- Catalog maturity stays unchanged. Netcode / gamepads / split-screen stay
  game-specific.

## Rejected

- **Folding this into `sw2d.arcade`.** That pack is a score ledger.
- **Remapping ActionInputHost so WASD and arrows are disjoint.** Shared
  `MOVE_*` is the platform contract; versus reads `KeyboardEvent.code`.
- **Binding overlay pong.** Wave 5 AI and `forceOpponentWin` stay the
  overlay consumer.
