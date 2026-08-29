# Proof Contract — local-party-game

Frozen before implementation. Post-ten program Phase 15 (local multiplayer & gamepad routing).

## Preset

`local-party-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller families
`ui-simulation` + `top-down`, required pack `sw2d.arcade`, content roles `tuning`, **`players`**.

## Reusable capability exercised

- **`input.players`** (`PlayerInputService`, `packages/runtime/src/input/PlayerInputHub.ts`) —
  roster slots, join / leave / ready, exclusive device ownership, per-player semantic
  `ActionInput`, gamepad connection state, `canStart`, and the restart-leak `adapterCount` probe.
- `GamepadAdapter` + the injected `GamepadSource` seam — standard-mapping button/axis reads,
  radial stick deadzone, and disconnect clearing.
- `DEFAULT_KEYBOARD_PROFILES` — two profiles that share no physical key.
- `topDownController` — the ordinary shared controller, handed each player's own channel.

## What is deliberately game-specific

The body a seated player drives, where it spawns, and the small set of test controls the browser
proof calls. The shell owns **no** input handling: it never reads a `KeyboardEvent`, never names a
per-player action, and never builds a binding table.

## Terminal success/failure oracle

- **Success surface:** the shell debug snapshot — roster slots (`state`, `device`, `connected`),
  available devices, per-player body positions and intents, `playerAdapterCount`, and live
  per-player `held(...)` reads; plus the runtime `DebugSnapshot`'s `listeners` and `capabilities`.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 13-step verification)

1. Boot into the lobby: 4 authored slots (`red`,`blue`,`green`,`gold`), all `empty`, `minPlayers` 2,
   `requireReady` true, both keyboard profiles offered, `canStart` false, no player adapters.
2. Player one joins on keyboard profile A: slot `joined`, one adapter, that profile no longer
   offered, still cannot start.
3. Player two is refused profile A (`device-taken`) and joins profile B: two adapters, two bodies.
4. Player one presses its own key — **player two's channel sees nothing at all** (every action zero),
   asserted in the lobby, before any gameplay consumes it.
5. Player two presses its own key while player one still holds — each sees only its own action.
6. Both players ready; `canStart` becomes true.
7. Start succeeds; phase is `playing`, round 1.
8. Simultaneous opposite movement: each body moves the way its own player pressed, and an unseated
   slot has no body at all.
9. A third player joins on a scripted gamepad, its face button reaches only that player, three adapters.
10. The pad is unplugged mid-hold: that player's held state clears, its slot reports `connected: false`
    but stays `joined`, and the other players are untouched.
11. Reconnect produces **no phantom press**; a reassignment attempt onto an owned profile is refused.
12. Round restart: the roster survives (a new round is not a new game), bodies are rebuilt, and the
    channels still drive the right bodies.
13. No leaks: exactly one adapter per seated player, `input.adapters` still 2 (global keyboard +
    pointer), and exactly one `input.players` capability.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Player isolation is a property of ownership: player two's channel has no adapter for player one's keys.
- Zero console errors, zero external requests.

## Negative-control verification

Each sabotage was applied, observed to fail the expected steps, and reverted:

| Sabotage | Result |
| --- | --- |
| exclusive device ownership removed from `PlayerInputHub` | steps 3 and 11 FAIL |
| gamepad disconnect no longer clears held actions | step 10 FAIL, step 9 PASS |
| every channel given every profile's bindings (cross-talk) | steps 4 and 5 FAIL |
