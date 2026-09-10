# ADR-0037: Visual reaction and beat windows are a timing pack

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 10

## Context

`reaction-timing` and `rhythm-action` were dummy ui-simulation option
pickers. `sw2d.arcade` only owns elapsed/score/lives. Prior notes rejected
folding audio-beat matching into arcade, and rejected treating overlay
rhythm vs reaction as one audio machine. The leftover limitation text is
music-beat / **audio**-synchronization, not a visual metronome.

Two factory recipes need a visual window: a one-shot delay with a too-early
miss, and a repeating beat with an in-window hit. Overlay kits already
prove local rhythm/reaction journeys (P3-F) and stay unwired.

## Decision

**Add `sw2d.timing` providing `arcade.timing`.** Content authority is
`content/timing.json`. Two bounded modes, one service:

- **`reaction`** — authored delays, `GO` after the delay, false-start on
  too-early, hit when latency ≤ `windowMs`, timeout miss after `maxWaitMs`.
- **`rhythm`** — beats at `offsetMs + i * periodMs`, hit inside ±`windowMs`,
  miss when the window closes without a press.

Win at `hitsToWin`, fail at `missesToFail`. Empty catalogs are inert.

Do **not** fold this into `sw2d.arcade`. Do **not** claim audio-sync.

## Consequences

- Consumers: `reaction-timing`, `rhythm-action`. Both require `sw2d.timing`
  and content role `timing`. Arcade score stays required as before.
- `LIMITATIONS.visualTiming` names what is reusable and what is not.
- Generated ui-simulation shell binds `bindStarterTiming` and hides the
  dummy picker when active.
- Overlay rhythm/reaction kits stay local (P3-F).
- Catalog maturity stays unchanged.

## Rejected

- **Folding into `sw2d.arcade`.** Elapsed/score is not a reaction-test flow.
- **Audio-beat / music synchronization.** That is a different machine.
- **Wiring overlay kits.** P3-F local journeys stay the overlay consumers.
- **A mega-pack of leftover Tier-3/4 singles.** Rhythm and reaction are the
  two live factory consumers of *visual* windows; fishing/cooking/etc. are not.
