# ADR-0032: Agent needs, behaviours and work orders are authored vocabulary

- Status: Accepted
- Date: 2026-08-29
- Phase: Post-ten program Phase 18 (Simulation Agents, Needs, Behavior & Schedules)
- Supersedes: none
- Related: [ADR-0011](0011-capability-namespacing.md), [ADR-0028](0028-strategy-orders-and-tactical-actions.md), [ADR-0030](0030-ball-paddle-is-an-authored-simulation.md)

## Context

Four presets in the catalogue want agents that look after themselves: `pet-creature`
and `virtual-pet` want one creature with needs that drift and a small repertoire of
things it can do about them; `colony-lite` wants several colonists sharing a queue of
jobs; `aquarium-terrarium` wants ambient inhabitants. Before this phase every one of
them was covered by `LIMITATIONS.creatureSimulation`, and the honest reading of that
limitation was that a creature's "needs" were a number on a HUD that nothing consumed.

The obvious way to close the gap is to ship a simulation with opinions: a `hunger`
need, a `sleep` need, an `eat` behaviour, a day that runs from 06:00. That is how most
engines do it, and it is why most games built on those engines feel like the same game.
It also fails immediately outside the one genre it was written for: an aquarium fish
does not get hungry the way a colonist does, and a colonist's shift is not a pet's nap.

The competing failure is worse: solve it once inside `proofs/pet-creature/src/game-specific/`
and once inside `proofs/colony-lite/src/game-specific/`, and the program has two
divergent simulations and no reusable capability at all.

## Decision

`simulation.agents` owns the **mechanism** and holds **no vocabulary of its own**.

1. **Needs are authored.** The capability knows a need has a range, an initial value,
   a drift rate, and two thresholds; it does not know that `hunger` exists. `needUrgency`
   normalises against the need's own authored range, so a 0..100 need and a -50..50 need
   compare on the same scale without the author converting anything.

2. **Behaviour selection is utility, not scripting.** A behaviour scores as its base
   utility plus each need's urgency times an authored weight. `selectBehavior` picks the
   highest score among behaviours whose preconditions currently hold. There is no
   behaviour tree, no state machine, and no scripting language: the author tunes numbers,
   and the ranking that falls out is the behaviour. Ties break on ascending behaviour id
   so the same document plus the same world always produces the same choice.

3. **Preconditions and effects are a closed, declarative union.** Six condition kinds
   (`need-below`, `need-above`, `has-tag`, `lacks-tag`, `schedule-activity`,
   `target-available`) and five effect kinds. This is deliberately not extensible by
   arbitrary predicate functions — the moment a condition can be a function, the document
   stops being data, the Workbench cannot show it, and content validation cannot check it.
   When a genre needs a seventh condition kind, the phase that needs it adds it to the
   union and to the schema together.

4. **Blocking reasons are named, not silent.** An ineligible behaviour reports
   `blockedBy: 'precondition:has-tag'` or `'cooldown'` rather than simply scoring zero.
   A creature that does nothing is the single hardest thing to debug in a simulation like
   this, and a capability that cannot say why is a capability the author cannot tune.

5. **Work orders are reservations, not a task graph.** An order is claimed by exactly
   one agent, an agent holds at most one order, an order can only be claimed by an agent
   carrying its required tag, and releasing an order resets its progress to zero. Progress
   is not half-credited to the next taker, and `despawn()` releases whatever the departing
   agent held — a colonist who leaves mid-job must not take the job with them.

6. **Schedules are authored blocks over a 1440-minute day.** A block may wrap past
   midnight. The capability reports the current activity name; it attaches no meaning to
   `work` or `sleep` beyond matching a `schedule-activity` precondition.

7. **Selection is bounded, drift is not.** Needs tick every frame, because a need that
   only moves on a decision boundary is visibly steppy. Selection runs on
   `decisionIntervalMs` (default 250ms), because re-ranking every behaviour every frame
   for every agent is the cost that stops a colony from scaling, and because a creature
   that re-decides sixty times a second dithers.

## Consequences

- The four presets narrow `LIMITATIONS.creatureSimulation` rather than dropping it: what
  remains is honest about what the capability still does not do (no pathfinding, no
  inter-agent negotiation, no needs that depend on other agents' needs).
- Authors get no starting vocabulary. A blank `agents.json` is a blank simulation, and
  every preset that uses the capability has to author its own needs — this is a real cost
  paid deliberately, and the presets carry starter documents so it is paid once.
- `interruptible: false` genuinely holds a behaviour through a higher-scoring rival. An
  interrupted behaviour applies **no** effects; only completion applies them. A design
  where interruption applied partial effects would make "was it interrupted?" observable
  through the need values, which is exactly the ambiguity the event stream exists to remove.
- The Workbench agents lab tunes drift rates, thresholds and need weights, and **reports**
  preconditions, effects and schedules without editing them. Editing a condition graph in
  a form is visual scripting; the program has consistently declined to build that.
