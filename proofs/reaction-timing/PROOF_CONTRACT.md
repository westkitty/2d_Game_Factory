# Proof Contract — reaction-timing

Frozen before implementation. Post-ten program Phase 17 (rhythm, beat & precision timing, ADR-0031).

## Preset

`reaction-timing` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family
`ui-simulation`, required packs `sw2d.arcade`, **`sw2d.rhythm`**. Content roles `tuning`,
**`rhythm`**.

## Reusable capability exercised

`arcade.reaction` (`ReactionService`): the seeded wait draw, the phase machine
(`ready` → `wait` → `stimulus` → `response` / `false-start` → `result` → `summary`), the false-start
rule, the response timeout, round advancement and the summary statistics. Configured from
`content/game.json`'s pack config (3 rounds, 400–1200ms wait, seed 20260829, 1500ms timeout).

The reaction machine runs on **simulation time** supplied by `update(deltaMs)`, and its wait comes
from the project's canonical seeded RNG — never `Math.random` — so a seeded run replays identically.

**This proof also installs the real `BrowserAudioTransport`, on a real `AudioContext`.** The
reaction test does not consult it, so exercising it here is free — and it is the one place the
browser transport is observed in an actual page rather than only in unit tests.

## What is deliberately game-specific

The stimulus's appearance, and the wire from a semantic press to `respond()`. The shell measures
nothing: the reaction interval is simulation time the service accumulated.

## Terminal success/failure oracle

- **Success surface:** the machine's full state (phase, round, drawn wait, phase elapsed, last
  result, summary) plus whether the stimulus is visible, the response count, and the real
  transport's state and clock source.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 10-step verification)

1. Boot: `sw2d.rhythm` installed, `arcade.reaction` live, machine `ready`, 3 authored rounds,
   nothing run, no stimulus showing.
2. The **real** browser transport is on the audio clock, and its state machine behaves:
   start → `playing`, pause → `paused`, resume → `playing`, stop → `stopped`.
3. Begin: round 1 opens with a wait drawn from the authored seed, inside the authored 400–1200ms
   bounds, with no stimulus showing.
4. **False start**: a press during the wait ends the round with no time recorded, and the stimulus
   never appeared.
5. The next round draws again, and its wait **differs** from round 1's — a player cannot learn it.
6. The stimulus appears only after the wait elapses, not before.
7. A valid response records a positive reaction interval, measured from simulation time the service
   accumulated.
8. **Timeout**: an unanswered stimulus past the authored timeout ends the round as a *completed
   round with no time* — not a false start, which is a different failure.
9. Summary: after the authored number of rounds the machine reaches `summary`, and its `bestMs` and
   `averageMs` agree with the individual results.
10. Reset returns to `ready` with a clean summary, and a replay draws **the same** round-1 wait —
    the determinism the seed exists for.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Zero console errors, zero external requests.

## Negative-control verification

| Sabotage | Result |
| --- | --- |
| a press during the wait is ignored instead of a false start | steps 4 and 9 FAIL |
| the wait is a constant instead of a seeded draw | step 5 FAIL, step 3 PASS |

The second control is worth noting: a constant wait still satisfies "inside the authored bounds"
(step 3), which is exactly why step 5 asserts that two rounds differ.
