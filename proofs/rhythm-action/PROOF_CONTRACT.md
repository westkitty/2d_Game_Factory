# Proof Contract — rhythm-action

Frozen before implementation. Post-ten program Phase 17 (rhythm, beat & precision timing, ADR-0031).

## Preset

`rhythm-action` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family
`ui-simulation`, required packs `sw2d.arcade`, **`sw2d.rhythm`**. Content roles `tuning`,
**`rhythm`**.

## Reusable capability exercised

`arcade.rhythm` (`RhythmService`), driven by the validated `content/rhythm.json`
(`urn:sw2d:schema:content-rhythm:v1`): beat-to-millisecond conversion, the three judgement windows,
nearest-note selection, the judged-at-most-once guarantee, combo / score / accuracy, miss expiry,
pause semantics, bounded calibration, chart completion and restart.

The chart is judged against an `AudioTransport` — never a wall clock. This proof installs
`ManualAudioTransport`, whose clock is supplied rather than sampled, so the journey can sit at an
**exact** chart position and press there. A rhythm assertion measured against a free-running clock
would be a timing race, not a proof.

## What is deliberately game-specific

Presentation, and the wire from semantic input to `press()`. The shell holds no chart time of its
own and never reads a clock.

## Terminal success/failure oracle

- **Success surface:** the service's full state (chart id, status, transport time, score, note
  counts, upcoming notes) plus the transport state, the applied calibration, the last judgement and
  delta, the press log, and the service's own complete judged-note record.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 12-step verification)

The chart is 120bpm with a 1000ms offset, so beat-authored notes land at 1000, 2000, 3000, … and
millisecond-authored lane notes at 9000, 9750, 10500, 11250.

1. Boot: `sw2d.rhythm` installed, `demo-chart` loaded with 12 notes, nothing judged, transport idle.
2. A press before the chart starts judges nothing at all.
3. Start: the transport plays, the chart is live, position is zero.
4. A dead-centre press on a **beat-authored** note is `perfect` with delta 0 — which is also the
   proof that beat conversion put the note at 1000ms.
5. A press 60ms late is `good`: outside the 40ms perfect window, inside the 90ms good window, both
   taken from the document.
6. The same note cannot be judged twice — a second press at the same instant finds nothing and the
   score does not move.
7. A note whose whole window passes expires **exactly once**, breaking the combo. The press log must
   *not* contain it (nothing pressed it) while the service's own record must, once.
8. Score, maxCombo and accuracy agree with the individual judgements. (`accuracy` is reported
   rounded to four decimal places.)
9. Pause: the transport pauses, a press judges nothing, and **nothing expires** — a pause must not
   let a player farm notes at a frozen time, nor silently miss the notes it froze over.
10. Resume: the protected note is still judgeable, and lane matching is real — the wrong lane hits
    nothing, the right lane hits.
11. Calibration shifts judgement by a bounded amount: −60 turns a 60ms-late press into a perfect,
    and an absurd value clamps to ±200 rather than rewriting the chart.
12. Completion and restart: once every note is judged the chart finishes, and `start()` re-arms it
    from a clean score with all 12 notes back.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Zero console errors, zero external requests.

## Negative-control verification

| Sabotage | Result |
| --- | --- |
| the `judged` flag is ignored when selecting a note | step 6 FAIL |
| presses are judged while paused / before start | steps 2 and 9 FAIL |
