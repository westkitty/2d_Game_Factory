# Proof Contract — colony-lite

Frozen before implementation. Post-ten program Phase 18 (simulation agents, needs, behavior & schedules, ADR-0032).

## Preset

`colony-lite` (`packages/presets/src/catalog/simulation.ts`) — controller family
`ui-simulation`, required packs `sw2d.arcade`, **`sw2d.simulation-agents`**. Content roles
`tuning`, **`agents`**.

## Reusable capability exercised

The **work-order** half of `simulation.agents`: tag-gated offers, priority with a stable id
tie-break, exclusive reservation, one job per agent, progress on simulation time, release,
cancellation, and reservation release on despawn — plus multiple agents each deciding for
themselves from their own needs.

Where `pet-creature` proves one agent's inner life, this proves that several agents share a job
queue without stepping on each other.

## What is deliberately game-specific

Presentation, and the assignment loop itself (`assignNext`: ask the capability what this colonist
can take, claim it). The loop is three lines because the capability owns the arbitration; that
brevity is the point of the proof, not an omission from it.

## Terminal success/failure oracle

- **Success surface:** every agent's state (needs, tags, active behaviour, held work order,
  schedule activity), every order's state (kind, priority, required tag, reserving agent, progress),
  the open-order count, the started/completed history, and the game clock.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 12-step verification)

1. Boot: two colonists with different tags, three authored orders, all open and unreserved.
2. Tag gating: the highest-priority order overall belongs to the builder, and the hauler is never
   offered it — it is offered the best order **it** can take.
3. Priority with a stable tie-break: between two equal-priority haul jobs the offer is the lower
   id, a stable choice rather than a Map's insertion order.
4. Reserving takes an order out of circulation for everyone: a second claimant is refused and the
   order is no longer offered.
5. An agent holds one job at a time, and cannot take a job whose required tag it lacks.
6. A reserved order progresses to completion on **simulation time** and frees its owner. The shell
   never decided it was finished.
7. Release puts the order back and resets its progress to zero — work is not half-credited to the
   next taker.
8. Cancelling removes an order from circulation entirely.
9. A colonist dismissed mid-job does not take the reservation with them: the order returns to open
   and unreserved.
10. Several agents run at once, each deciding for itself: draining one colonist's need re-ranks
    that colonist's behaviour and leaves the other's alone.
11. `assignNext` is the whole assignment loop, and both colonists end up on the right kind of job
    with the remaining order still open.
12. The game clock advances and the schedule follows it, reporting one of the authored activities.

## Negative controls

| Sabotage | Expected |
| --- | --- |
| A despawned agent's work order is not released | step 9 FAILS |
| Preconditions no longer gate eligibility | pet-creature steps 4 and 8 FAIL |
