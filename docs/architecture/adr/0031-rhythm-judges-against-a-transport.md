# ADR-0031: Rhythm judges against an audio transport, never a wall clock

- Status: accepted
- Date: 2026-08-29
- Phase: Post-ten capability program, Phase 17

## Context

`rhythm-action` carried "No deterministic music-beat/audio-synchronization system exists yet" and
`reaction-timing` carried "no specialized reaction-test flow is implemented".

The tempting implementation is `performance.now()` plus a `setInterval` scheduler. It is wrong in
three separate ways, and each one is silent:

1. **It drifts.** The page clock and the audio output clock are different oscillators. Over a
   three-minute song they separate audibly, and a note judged against the page clock is judged
   against something the player cannot hear.
2. **It ignores throttling.** A backgrounded tab throttles timers but the page clock keeps running,
   so returning to the tab finds the chart somewhere the music is not.
3. **It knows nothing about a pause.** Every consumer would have to subtract paused time correctly,
   forever, in every game.

## Decision

**`AudioTransport` is the only authority for what time it is.**

- The contract declares a small transport interface: `state`, `currentTimeMs()`, `start`, `pause`,
  `resume`, `stop`. It says nothing about audio, browsers or renderers.
- `RhythmService.press(action, lane?)` **takes no timestamp**. It reads the transport itself, so a
  caller cannot judge against a stale or invented time, and calibration is the only thing that
  shifts that reading - by a bounded ±200ms.
- The runtime supplies `BrowserAudioTransport`, which reads `AudioContext.currentTime`, and
  `ManualAudioTransport`, whose clock is supplied rather than sampled. The manual one is not a mock:
  it is the same contract, and it is what makes a rhythm proof an exact assertion instead of a
  timing race.
- A scheduling callback may *trigger* work early; the transport position remains the authority for
  what time it is. A callback that fires late must not shift the chart.

The transport is provided by the **game**, as the `audio.transport` capability, and
`sw2d.rhythm` requires it. A missing transport is a construction error, not a silent no-op that
would judge every note against zero.

### Two guarantees the service owns, not the caller

1. **A note is judged at most once, ever.** Every note carries a `judged` flag and every path -
   press and window expiry alike - goes through one `#commit`. "The caller should not press twice"
   is not a guarantee; this is.
2. **Nothing is judged while paused.** Without that, a pause would let a player farm notes at a
   frozen transport time, and would also silently expire the notes it froze over.

### Beats are content, not code

A note authors **exactly one** of `timeMs` or `beat`; both or neither is a content error the
validator rejects, so the resolver never has to guess. Beat notes convert deterministically against
the chart's `bpm` and `offsetMs`, which is why one chart can mix both without ambiguity.

Judgement windows must satisfy `perfect <= good <= miss`, and the points per judgement are fixed in
the contract so a chart cannot inflate its own score.

### The reaction machine is a separate capability on a separate clock

`arcade.reaction` is deliberately not part of the chart judge. It runs on **simulation time**
supplied by `update(deltaMs)`, and draws each round's wait from the project's canonical seeded RNG -
never `Math.random` - so a seeded run replays identically and a proof can assert the exact wait.

A press during the wait is a **false start**; a response after the timeout is a *completed round with
no time*, which is a different outcome and recorded as such.

## Consequences

- `LIMITATIONS.rhythmTransport` replaces both old claims and states the honest scope: the capability
  is real, the game supplies the transport, and **no music-authoring or waveform tooling ships with
  it** - a chart is authored as `content/rhythm.json`.
- The Workbench panel tunes tempo, offset, windows and calibration, and **reports** every note's
  resolved absolute time. It does not edit notes: placing notes against a waveform is a DAW's job,
  and a numeric note grid would be a poor imitation of a tool that already exists.
- Proof consumers: `proofs/rhythm-action/` (12 steps, scripted transport for exactness) and
  `proofs/reaction-timing/` (10 steps, which installs the **real** browser transport and asserts its
  state machine - the reaction test does not consult it, so that check is free and genuine).
