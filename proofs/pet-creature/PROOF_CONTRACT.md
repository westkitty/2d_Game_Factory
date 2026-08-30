# Proof Contract — pet-creature

Frozen before implementation. Post-ten program Phase 18 (simulation agents, needs, behavior & schedules, ADR-0032).

## Preset

`pet-creature` (`packages/presets/src/catalog/simulation.ts`) — controller family
`ui-simulation`, required packs `sw2d.arcade`, **`sw2d.simulation-agents`**. Content roles
`tuning`, **`agents`**.

## Reusable capability exercised

`simulation.agents` (`SimulationAgentsService`), driven by the validated `content/agents.json`
(`urn:sw2d:schema:content-agents:v1`): need drift and thresholds, urgency normalised against each
need's own authored range, utility-weighted behaviour selection, declarative preconditions and
effects, cooldowns, tags, target availability, relationships, and an authored schedule over a
1440-minute day.

The vocabulary is entirely the document's. The capability ships no `hunger`, no `eat`, and no
notion of what a pet is; step 1 asserts exactly that by requiring the agent's need set to be
precisely the two needs the document declares and nothing else.

## What is deliberately game-specific

Presentation, and the world facts the simulation cannot know for itself — whether food is
currently available, and whether the owner is present. The shell supplies those as tags and as a
spawned/despawned agent. The shell **never chooses a behaviour**: every behaviour in this journey
is selected by the capability on utility.

## Terminal success/failure oracle

- **Success surface:** both agents' full state (needs with value, level and urgency; tags; active
  behaviour; schedule activity), the scored-and-ranked behaviour list with each behaviour's
  eligibility and named blocking reason, the started/completed behaviour history, the need-level
  change announcements, the relationship metric, and the game clock.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 12-step verification)

1. Boot: `sw2d.simulation-agents` installed, both authored agents exist, and the pet's needs are
   exactly `affection,hunger` at their authored initial values with level `ok`.
2. Needs drift with no input at all: hunger falls and its urgency rises.
3. Crossing an authored threshold changes the reported level and is announced **once**, not once
   per tick.
4. A precondition genuinely gates: with no food, `eat` is ineligible and names
   `precondition:has-tag` — while still *scoring* above `wander`, because it is wanted and merely
   impossible.
5. Supplying the world fact unblocks it and the pet chooses to eat **by utility**. The shell never
   told it to.
6. Completion applies the authored effects exactly once: hunger rises and the food tag is consumed
   by the `remove-tag` effect.
7. The cooldown is real and is **named** — after eating, `eat` reports why it is blocked rather
   than silently scoring zero.
8. Target availability: `seek-owner` is eligible with the owner present, and once the owner is
   despawned its precondition fails with `precondition:target-available`.
9. Relationships: from a clean state, draining affection drives the pet to seek its owner, and the
   authored relationship metric moves on the pair.
10. The schedule runs on game time, and `nap`'s eligibility agrees with whatever activity the
    schedule currently reports — a schedule that does not gate anything is not a schedule.
11. Utility, not scripting: with hunger urgent and food available, the hunger-weighted behaviour
    outranks both the affection-weighted one and the idle one.
12. Reset restores the authored starting state and clears history — read **immediately**, without
    stepping a frame, because a reset that is only clean until the next frame is not a reset.

## Negative controls

| Sabotage | Expected |
| --- | --- |
| Preconditions no longer gate eligibility | steps 4 and 8 FAIL |
| Interrupted behaviours apply their effects | pack tests FAIL |
| Tie-break by insertion order instead of behaviour id | contract test FAILS |
