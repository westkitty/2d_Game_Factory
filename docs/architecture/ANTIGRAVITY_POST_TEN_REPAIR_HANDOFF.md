# Anti-Gravity Post-Ten — Rolling Repair Handoff

The short, scannable companion to
[`ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md`](ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md) (full per-phase
evidence) and [`POST_TEN_PROGRAM_SPEC.md`](POST_TEN_PROGRAM_SPEC.md) (the authoritative remaining
specification for phases 15–36).

**Everything below is candidate work on `candidate/antigravity-post-ten-program`. None of it is
certified. `main` is untouched at `acf802f`.**

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `SCAFFOLDED` · `COMPILES` ·
`FOCUSED TESTS PASS` · `REPAIR NEEDED`. The words `PASS`, `CERTIFIED` and `COMPLETE` are not used
for candidate phases.

---

## Phase ledger

| Phase | Title | Status | Commit | Proof consumers |
| --- | --- | --- | --- | --- |
| 11 | AI Perception, Awareness & Pursuit | FOCUSED TESTS PASS | `88fe47e` (repaired in `e12785b`) | stealth-game, chase-platformer |
| 12 | Platformer Climbing | FOCUSED TESTS PASS | `5215687` (repaired in `e12785b`) | climbing-game, precision-platformer |
| 13 | Run Lifecycle & Roguelite Meta-Progression | FOCUSED TESTS PASS | `69d957d` + repair `7902701` | action-roguelite (20 steps), survivor-like |
| 14 | Strategy Orders & Tactical Actions | FOCUSED TESTS PASS | `7e46c91` | simple-rts (13 steps), turn-based-tactics (15 steps) |
| 15 | Local Multiplayer & Gamepad Routing | FOCUSED TESTS PASS | `2670526` | local-party-game (13 steps), pong (input foundation) |
| 16 | Ball & Paddle Arcade Systems | FOCUSED TESTS PASS | `81a7e12` | breakout (12 steps), pong (12 steps, upgraded) |
| 17 | Rhythm, Beat & Precision Timing | FOCUSED TESTS PASS | `ed74dc3` | rhythm-action (12 steps), reaction-timing (10 steps) |
| 18 | Simulation Agents, Needs, Behavior & Schedules | FOCUSED TESTS PASS | `af73bb5` | pet-creature (12 steps), colony-lite (12 steps) |
| 19 | Economy, Production & Customer Simulation | FOCUSED TESTS PASS | `13d7880` | shopkeeper (18 steps), idle-incremental (15 steps, upgraded) |
| 20 | Narrative Dialogue, Choices & Portraits | FOCUSED TESTS PASS | this phase | visual-novel (18 steps), point-and-click (10 steps, upgraded) |
| 21–36 | see `POST_TEN_PROGRAM_SPEC.md` | NOT STARTED | — | — |

---

## Standing certifier queue

Carried forward every phase until an independent certification pass closes them.

### Phase 13

- Adversarial browser validation of run lifecycle, seed determinism across resets, and permanent
  meta-unlock persistence.
- Run time and stats are checkpointed on a 1000 ms coalescing window, so a hard crash can lose up to
  one second of run time and the stats accrued in it. Currency, upgrades and lifecycle transitions
  are never in that window. Deliberate and documented in code.

### Phase 14

- `usesRemaining()` returns `Infinity`, which JSON-serialises to `null`. Decide the contract.
- `OrderQueueMode: 'front'` wins its priority tie by design; unit-tested only, no browser step.
- `interact` and `guard` order kinds, and region/direction targets, have no proof-consumer coverage.
- Tactical action points are per-actor and unscoped by team; `refresh()` with no argument refreshes
  every actor including the opposing side.
- Adversarial browser validation of the queue/replace/cancel transitions and the four failure reasons.

### Phase 15

- Same-device multi-touch multiplayer was **not** built. Decide whether it is a later phase or a
  permanent limitation.
- Per-player channels run alongside the global `ActionInput`; confirm no generated shell reads the
  global channel for per-player gameplay.
- `input.players` is granted by authored content (`content/players.json`) rather than by a pack id
  in `content/game.json` — the only capability in the system that works this way, because the hub
  must advance inside the runtime's single-owner `PRE_STEP` hook.
- `PlayerInputHub.adapterCount` is a class getter read defensively by the proof shells, not part of
  the renderer-neutral `PlayerInputService`. Promote or remove.
- Real-hardware validation with two physical gamepads (the automated proof uses the scripted
  `GamepadSource` seam).
- Device assignments do not persist across sessions, per the specification.

### Phase 16

- Bounded substeps are **not** continuous collision detection. A definition beyond the substep budget
  is rejected at install rather than tunnelling, but the bound is real — confirm it empirically at
  the top of the supported speed range on slower hardware.
- The `drainEvents()` buffer is unbounded; a consumer that forgets to drain accumulates forever.
  Decide whether it needs an explicit bound.
- Breakout brick score accrues to `paddles[0].playerId`; a two-paddle Breakout variant would need an
  explicit owner.
- `BallPaddleServiceImpl.update()` is public on the class (so the pack and unit tests can drive it)
  while absent from the interface — the `ActionInputHost` pattern. A consumer holding the impl type
  could still double-advance.
- `proofs/breakout` ships a `parkPaddle` test control (guarded: it refuses to run while the ball is
  live).

### Phase 17

- `RhythmNote.holdMs` is modelled and validated but judged as a single tap. Decide whether to judge
  holds or drop the field.
- **No audio actually plays** in either proof. "The chart matches what the player hears" is asserted
  through the transport, never acoustically.
- `BrowserAudioTransport` is unit-tested (10 tests) and its clock source + state machine are asserted
  in a real page, but no browser step asserts its position advances in real time — that would
  reintroduce the timing race the manual transport exists to avoid.
- `tick()` is on the public interface (unlike Phase 16's `update()`), so a consumer could also call
  it. It is idempotent, but the asymmetry is worth a decision.
- The `audio.transport` capability is supplied by the **game**, not the runtime. A preset requiring
  `sw2d.rhythm` fails at install unless its shell provides one; the generator does not yet do this
  automatically, which Phase 36's realization pass must address.
- `reaction-timing` ships a `driveTransport` test control.

### Phase 18

- **No pathfinding and no spatial model at all.** `target-available` is a boolean the game supplies;
  an agent can work an order it could never physically reach. `sw2d.navigation` owns movement.
- **Relationships are decorative.** A flat metric per ordered pair, changed only by an effect, read
  by no condition kind and decayed by nothing. Deciding whether a `relationship-above` condition
  should exist is what would make them load-bearing.
- **An agent's work order and its behaviour are independent** — a colonist can hold `haul-crates`
  while resting, and the order still progresses. Feature or defect is a design decision this phase
  did not make; `colony-lite` demonstrates it without endorsing it.
- `selectBehavior` is exported on the contract *and* called inside the pack, so a consumer can score
  behaviours itself and act on a different choice. Phase 16 closed this shape by removing `update()`;
  the analogous tightening costs the Workbench its ranking preview.
- `decisionIntervalMs` is global, not per agent; the schedule is one looping day; `minutesPerSecond`
  is linear with no speed control.
- Both proofs use a `drain` test control (it writes through the same `need-set` path effects use).
- The generator does not supply `content/agents.json` for presets requiring `sw2d.simulation-agents`
  — the same generator gap Phase 17 recorded for `audio.transport`, for Phase 36 to close.


### Phase 19

- **Customers do not walk anywhere.** `navigate` is a timer and `chooseTarget` never asks where
  anything is; placement validates a reachability *claim* (an access point in an aisle), not a path.
  A customer can be served at a counter no route reaches.
- **`unlocks` is a declared prestige reset scope that does nothing.** `progression.state` has no
  revoke, and reaching into its private state would be worse than recording this. Decide whether it
  should work or leave the union.
- Prestige wipes in-flight jobs without refunding their inputs; one queue (`#defaultQueue()`, lowest
  id) is used implicitly however many the document defines; `arrival.maxConcurrent` skips arrivals
  rather than backlogging them; `demandMultiplier` moves only when a game moves it.
- **`simulation.economy` is large** — goods, transactions, customers, queues, offline catch-up and
  prestige in one capability. Splitting customers out would put the shelf behind a second owner,
  which is what this phase most wanted to avoid. Worth a decision if Phase 34 wants the customer
  half without the shop half.
- `save()`/`resume()` live on the service rather than a persistence seam; there is no `toJSON()`.
- **Prestige and `progression.runs` know nothing about each other.** `RunResetParticipant` exists and
  the economy does not register with it, so a game using both has two independent reset systems.
- Both proofs use a `goOffline` test control (public `save()`/`resume()` plus the injected clock).
- The generator still does not supply `content/economy.json` for presets requiring `sw2d.economy` —
  the same gap Phases 17 and 18 recorded, for Phase 36 to close.


### Phase 20

- **WB-SCENE-001 is flaky.** It failed the tranche run with `frame.evaluate: Frame was detached`
  and passed on an unchanged re-run. The journey evaluates inside the production-preview iframe,
  which can be replaced under it. The race predates Phase 20; recorded rather than left to
  surprise the next run.
- **Portrait asset roles come from the canonical theme role union, which has no portrait role.**
  The visual-novel proof names `player`/`enemy`/`pickup`. Widening the theme vocabulary was
  deliberately not taken unilaterally.
- **`narrative.state` and `narrative.dialogue` keep overlapping records.**
  `narrative.state.chosenChoices()` and `DialogueHistory.choiceCounts` are two records of
  overlapping facts under different owners, and nothing reconciles them.
- **The overlay is the only presentation and is one fixed layout.** The accessibility properties
  this phase proved live in that implementation, not in a contract a second one would satisfy.
- Effects apply in document order with no transaction: a later missing owner leaves the earlier
  effects applied (reported, never rolled back). `choose()` on an unavailable choice returns the
  current view rather than a named refusal, unlike Phase 19's transactions.
- `world-transition` inside a *line's* effects moves mid-node; the target is validated but nothing
  checks for a cycle. A save naming a deleted node silently falls back to idle.
- **The investigation regression (20.14) is unit-level**, not a browser journey: there is no
  `proofs/investigation-game/`. Four tests drive a witness-shaped document through the same
  service. Promote it when Phase 26 builds the evidence board.
- The generator still does not supply `content/dialogue.json` for presets requiring
  `sw2d.dialogue` — the same gap Phases 17-19 recorded, for Phase 36 to close.


---

## Verified gates at the latest phase boundary

Re-run and re-recorded at each phase; these are the Phase-20 numbers. **Phase 20 is a §7
tranche boundary**, so `npm run validate` and the full `npm run qa:proof` were both run.

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS, 0 errors |
| `npx vitest run` | PASS — 178 files / 3240 tests |
| `npm run validate` | PASS at the **Phase-20 tranche boundary**, including the offline check (no external request construct in the build output). The next tranche gate is Phase 25 |
| `npm run qa:proof` | PASS — 38/38 (tranche gate, full suite) |
| `npm run qa:workbench` | 15/16 first run, **16/16 on an unchanged re-run**; WB-SECURITY-001 audits 72 endpoints. The one failure was WB-SCENE-001's `Frame was detached` — a preview-iframe race in the harness, not a Phase-20 regression (see the certifier queue) |

---

## Proof-quality discipline

Every named acceptance step in every post-ten proof tests an observable property. No spec contains
an unconditional `true`; the one that did (Phase 13's `step17_resumable`) was repaired in `7902701`.

Each phase's new proof steps are **negative-control verified**: a targeted sabotage of the
implementation is applied, observed to fail exactly the expected step(s), and reverted. The
per-phase tables live in the candidate ledger and in each `proofs/<id>/PROOF_CONTRACT.md`.
