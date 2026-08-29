# Post-Ten Program Specification — Phases 15 through 36

**This file is the authoritative remaining construction specification for the
candidate branch `candidate/antigravity-post-ten-program`.**

It exists so that context compaction never requires the roadmap to be re-supplied.
Read it at the start of every phase. It is the answer to "what is next" and
"what does done mean" for every phase from 15 to 36.

- **Supplied by:** the external program authority, after the Phase-14 boundary.
- **Persisted:** commit `docs(program): persist post-ten phases 15-36 specification`.
- **Companion ledger:** [`ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md`](ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md)
  (per-phase evidence) and `ANTIGRAVITY_POST_TEN_REPAIR_HANDOFF.md` (rolling handoff).

---

## 1. Program purpose

Close the remaining reusable-genre gaps in the SW2D factory so that all 74
registered presets can be generated, built, started and shown performing their
defining interaction — as **candidate** work on a candidate branch, pending an
independent certification pass.

### Governing architecture (unchanged from the certified first ten)

```
AUTHORED DATA
  -> VALIDATED CONTRACT
    -> REUSABLE CAPABILITY / PACK
      -> RUNTIME BRIDGE ONLY WHEN REQUIRED
        -> NORMAL PRESET COMPOSITION
          -> GENERATED GAME
            -> BEHAVIOR PROOF
```

**A reusable genre gap is never solved by putting the engine inside
`proofs/<game>/src/game-specific/`.** A proof shell may supply small world
adapters, game-specific presentation, test controls, and representative content.
It must not contain the reusable mechanic itself.

---

## 2. State at the time this specification was persisted

| Fact | Value |
| --- | --- |
| Repository | `westkitty/2d_Game_Factory` |
| Candidate branch | `candidate/antigravity-post-ten-program` |
| Candidate HEAD when supplied | `4055e5ec4842882b34f1396b6166104051c9113b` |
| Phase 14 implementation commit | `7e46c91f8d7ed3c4bc06bb246cb53e0637ac186d` |
| Canonical `main` | `acf802f7a32a3f341273c084931af37cb5461784` (certified first ten; must remain untouched) |

### Completed candidate phases

| Phase | Title | Status |
| --- | --- | --- |
| 11 | AI Perception, Awareness & Pursuit | FOCUSED TESTS PASS |
| 12 | Platform Movement Extensions / Climbing | FOCUSED TESTS PASS |
| 13 | Run Lifecycle & Roguelite Meta-Progression (incl. resumability repair) | FOCUSED TESTS PASS |
| 14 | Strategy Orders & Tactical Actions | FOCUSED TESTS PASS |

**None of these are independently certified.** They are candidate work.

---

## 3. Preserve what already exists

### 3.1 The certified first ten — consume, never recreate

spatial pointer · items/effects · weapons/projectiles · encounters · navigation ·
data-driven puzzle rules · procedural generation · world graph · advanced physics ·
vehicle/racing.

### 3.2 Phases 11–14 — no competing versions

`ai.perception` · `ai.pursuit` · `movement.climbing` · `progression.runs` ·
`strategy.orders` · `strategy.tactics`.

### 3.3 Phase 14 known candidate characteristics — keep documented, do not gate on

1. `Infinity` serialises as `null` in one tactical-validity field (`usesRemaining`).
2. `front` queue-mode tie policy (a later `front` outranks an earlier equal-priority one).
3. `interact` / `guard` order kinds lack browser proof coverage.
4. Region / direction targets lack browser proof coverage.
5. `refresh()` without an actor refreshes all actors, including the opposing team.

These remain certifier targets. Do **not** block Phase 15 to polish them unless a
later phase exposes a real correctness problem.

---

## 4. Candidate status vocabulary

**Allowed:** `NOT STARTED` · `IN PROGRESS` · `SCAFFOLDED` · `COMPILES` ·
`FOCUSED TESTS PASS` · `REPAIR NEEDED`.

**Forbidden for candidate phases:** `PASS` · `CERTIFIED` · `COMPLETE`.

---

## 5. Global phase procedure (every phase 15–36)

1. Read this specification.
2. Read the candidate ledger.
3. Inspect only directly relevant existing implementation.
4. Mark the phase `IN PROGRESS`.
5. Implement renderer-neutral contracts.
6. Add schema / content model when creator-authored.
7. Implement the reusable service / pack.
8. Add a browser/Phaser bridge **only** when renderer access is genuinely required.
9. Integrate the normal generator / template path.
10. Add practical Workbench authoring where user-configurable.
11. Update affected presets.
12. Create / add proof consumers.
13. Add tests.
14. Audit relevant `knownLimitations`.
15. Run the candidate hard gate (§6).
16. Repair structural failures.
17. Inspect the diff.
18. Commit the phase.
19. Push the candidate branch.
20. Verify remote durability (`local HEAD == origin/candidate/...`).
21. Update the candidate ledger.
22. Continue automatically. **Do not ask for routine approval.**

---

## 6. Candidate hard gate (after every phase)

- `npm run typecheck`
- Direct affected tests
- Build at least one affected generated/proof game
- Run the new browser proof(s) where practical
- `git diff --check`

### Structural failures that block continuation

compile failure · broken schema registry · affected generated game will not build ·
unusable public API · capability dependency cycle · the next phase cannot safely
consume the implementation.

Attempt bounded root-cause repair. If still structurally blocked, **stop with exact
evidence**.

A behavioural proof deficiency that does not make the architecture unusable may be
recorded as `REPAIR NEEDED` and deferred to the certifier. **Never hide it.**

---

## 7. Tranche gates

After phases **15, 20, 25, 30, 35, 36** additionally run:

- `npm run validate`
- `npm run qa:proof`

After phase **36** additionally run:

- `npm run qa:smoke`
- `npm run release:verify`

When practical: `npm run qa:matrix` · `npm run qa:starter-kits` ·
`npm run qa:workbench` · `npm run qa:responsive`.

Do not repeatedly rerun a long unchanged failure. Fix or record the earliest
meaningful cause.

---

## 8. Git rules

Work only on `candidate/antigravity-post-ten-program`.

**Never:** modify `main` · merge to `main` · push `main` · force-push ·
`git reset --hard` · `git clean`.

Before each commit: `git status --short`, `git diff --check`, `git diff`.
Stage exact paths — **do not use `git add -A` as a blind staging method**.
Inspect `git diff --cached --check` and `git diff --cached --stat`.
Push after each phase.

---

# PHASE 15 — LOCAL MULTIPLAYER & GAMEPAD ROUTING

**Commit:** `candidate(phase-15): add local multiplayer and gamepad routing`

- **Capability:** `input.players`
- **Contract:** `packages/contracts/src/playerInput.ts`
- **Runtime:** `packages/runtime/src/input/PlayerInputHub.ts`, `packages/runtime/src/input/GamepadAdapter.ts`
- **Primary consumers:** `local-party-game`, `pong`
- **Secondary future consumers:** `microgame-collection`, other local-multiplayer starters

## 15.1 Core principle

**Do not replace `ActionInput`.** It remains the semantic input abstraction.
Player identity becomes a **routing dimension**:

```
physical devices -> adapters -> PlayerInputHub -> per-player semantic ActionInput
```

**Do not create global action IDs** such as `P1_MOVE_LEFT`, `P2_MOVE_LEFT`,
`P3_CONFIRM`. Each player receives the normal semantic vocabulary on a separate
channel.

## 15.2 Player slot contract

Define `PlayerId`, `PlayerSlot`, `DeviceAssignment`, `PlayerJoinState`.

Fields/concepts: `playerId` · `joined` · `ready` · `connected` · device assignment ·
input channel · optional display index/name.

`DeviceAssignment` bounded variants: `keyboard-profile`, `gamepad-index`.
**Do not expose browser `Gamepad` objects.**

## 15.3 PlayerInputHub

Semantics equivalent to: `join(playerId, device)` · `leave(playerId)` ·
`setReady(playerId, ready)` · `assignDevice(playerId, device)` ·
`releaseDevice(playerId)` · `inputForPlayer(playerId)` · `slot(playerId)` ·
`players()` · `joinedPlayers()` · `readyPlayers()` · `connectedPlayers()` · `dispose()`.

The per-player input surface must support the same semantics as normal `ActionInput`:
held state, press edge, release edge, values/axes, press claiming where applicable.

## 15.4 Device ownership

One physical gamepad cannot accidentally control two player slots unless an explicit
sharing mode is authored. **Default: exclusive device ownership.** Keyboard profiles
may be independent authored mappings. Reject conflicting assignment clearly.

## 15.5 Keyboard profiles

At least two non-conflicting default local profiles using existing binding concepts
(example only: WASD + nearby action keys; arrow keys + separate action keys).
Do not hardcode those mappings deep inside `PlayerInputHub`; represent profiles using
existing binding structures where possible. **Individual games must not read raw
keyboard state.**

## 15.6 Gamepad adapter

Use `navigator.getGamepads()` during input polling/update. **Do not retain browser
`Gamepad` object references indefinitely** — read the latest snapshot each poll.
Support standard mapping first. Handle axes, d-pad, face buttons, start/options where
appropriate, shoulders/triggers when semantic actions require them.
**Do not assume Xbox button labels are universal.**

## 15.7 Deadzone

Configurable radial/per-axis handling appropriate to the current architecture.
Minimum scalar normalisation, given value `v` and deadzone `d`:

```
if abs(v) <= d:  output = 0
else:            output = sign(v) * (abs(v) - d) / (1 - d)
clamp to -1..1
```

Tests at: inside deadzone, exact boundary, above boundary, full positive, full negative.

## 15.8 Gamepad connection

Handle connected · disconnected · slot absent from `navigator.getGamepads()` · reconnection.

**On disconnect, immediately clear all held semantic actions associated with that
device** — no stuck movement, fire, confirm or pause. A reconnect must not generate
phantom press edges unless a genuine transition occurs.

## 15.9 Join / ready flow

A reusable local-player lobby/join model. Generated games may configure minimum
players, maximum players, ready-required yes/no. UI must support JOIN, LEAVE,
READY / NOT READY, and device identification without platform-specific assumptions.
Game start allowed only when configured minimum conditions are satisfied.

## 15.10 Single-player compatibility

Existing single-player games continue using existing normal input.
**`PlayerInputHub` must be opt-in.** Do not force every game through a lobby.

## 15.11 Touch

Do not claim full same-device multi-touch multiplayer unless actually built.
Acceptable initial policy: one touch-controlled player plus keyboard/gamepad players,
where the existing touch architecture supports it. **Document the limitation honestly.**

## 15.12 Persistence

Do not persist transient gamepad browser indexes as permanent identity unless the
existing architecture has an explicit reason. Device assignments normally reset/rejoin
on a new session. Player preferences such as deadzone may use existing settings
persistence only if the architecture supports it cleanly.

## 15.13 Workbench

Smallest practical configuration surface for: minimum players · maximum players ·
ready policy · keyboard profiles · gamepad deadzone · join policy.
**Do not build a controller-remapping application** unless the Workbench already
provides reusable binding editing.

## 15.14 Proof A — local party game

`proofs/local-party-game/`. Journey:

1. Enter join screen.
2. Join player 1 with keyboard profile A.
3. Join player 2 with keyboard profile B or a simulated gamepad.
4. Verify player 1 input does not move/act for player 2.
5. Verify player 2 input does not move/act for player 1.
6. Ready both players.
7. Start game.
8. Exercise simultaneous movement/actions.
9. Disconnect one simulated gamepad if the gamepad proof path is used.
10. Assert that player's held state clears.
11. Reconnect/reassign.
12. Restart.
13. Assert no duplicate input listeners/hubs.

Automated gamepad snapshots are acceptable for browser QA. The proof must exercise
the reusable `PlayerInputHub`.

## 15.15 Proof B — Pong input foundation

**Do not implement the full Pong mechanic yet** (Phase 16). Provide/upgrade a Pong
proof foundation demonstrating two separate players, two distinct per-player movement
channels, simultaneous opposite paddle intent, and no cross-talk. Phase 16 consumes this.

## 15.16 Tests

join · leave · ready · minimum-ready policy · device assignment · duplicate device
rejection · device release · keyboard isolation · gamepad mapping · axis deadzone ·
button press/release edges · disconnect clearing · reconnect · reassignment ·
single-player unaffected · dispose · listener cleanup.

## 15.17 Acceptance

`FOCUSED TESTS PASS` only when: `input.players` exists · per-player `ActionInput`
isolation works · keyboard routing works · gamepad routing works · disconnect clears
state · join/ready flow exists · local-party proof passes · Pong input foundation
passes · Workbench surface exists where applicable · normal single-player input remains
intact. Then run the Phase-15 tranche diagnostics and continue to Phase 16.

---

# PHASE 16 — BALL / PADDLE ARCADE SYSTEMS

**Commit:** `candidate(phase-16): add ball and paddle mechanics`

- **Capability:** `arcade.ball-paddle`
- **Contract:** `packages/contracts/src/ballPaddle.ts`
- **Pack:** `sw2d.ball-paddle`
- **Primary consumers:** `breakout`, `pong`

Use Phaser Arcade Physics unless actual evidence requires Matter. **Do not move basic
ball/paddle gameplay to Matter merely because Matter exists.**

## 16.1 Ball definition

`id` (optional) · `radius`/size · `initialSpeed` · `minimumSpeed` · `maximumSpeed` ·
`speedIncreasePerHit` · `maximumBounceAngleDegrees` · serve policy.
Serve policy bounded variants may include `fixed`, `alternate`, `seeded-direction`.

## 16.2 Paddle definition

`id` · `width` · `height` · `axis` (`horizontal` | `vertical`) · `speed` · `bounds` ·
`playerId` · `bounceInfluence`.

## 16.3 Arena

`bounds` · wall behaviour · serve points · goal zones · loss zones.
Keep geometry renderer-neutral.

## 16.4 Paddle bounce formula

```
relative = (ball position along paddle axis - paddle center) / (paddle length / 2)
clamp relative to -1..1
angleOffset = relative * maxBounceAngle
```

Build the outgoing vector from that bounded offset. Prevent degenerate nearly-parallel
trajectories according to game orientation. Preserve/clamp configured speed. Apply the
bounded speed increase. **Do not inject random bounce variance by default.**

## 16.5 High-speed safety

Support configured intended speeds reliably using bounded substeps or the current
Arcade collision strategy. **Do not claim universal continuous collision detection.**
Document the supported tuning range if necessary.

## 16.6 Breakout

Reusable state must support: serve · paddle movement · wall bounce · brick collision ·
brick HP · brick destroy · score · ball loss · lives if configured · round completion ·
reset.

`BrickDefinition`: `id` · `hp` · `score` · `tags` · optional `itemDropId`
(**canonical Phase-2 item ID** if item drops are used).

## 16.7 Pong

Consume the Phase-15 `PlayerInputHub`. Support two paddles · serve · goals · score ·
round reset · match target score · match complete · restart.
**Do not implement a separate P1/P2 input architecture.**

## 16.8 Workbench

ball speed · speed increase · bounce angle · paddle speed · paddle size · target score ·
brick HP/defaults where applicable.

## 16.9 Proof — Breakout

serve · move paddle · hit ball · paddle changes outgoing direction based on hit
location · brick takes hit · brick destroyed · score increases · ball lost · round
reset · complete board / win condition.

## 16.10 Proof — Pong

two Phase-15 players · independent paddles · serve · goal · score · round reset ·
second player control · match progression · restart.

## 16.11 Tests

serve · bounce center · bounce edge · speed clamp · brick damage · brick destroy ·
score · goal · loss · reset · multiplayer isolation · supported high-speed collision ·
dispose.

---

# PHASE 17 — RHYTHM, BEAT & PRECISION TIMING

**Commit:** `candidate(phase-17): add rhythm and precision timing`

- **Capabilities:** `arcade.rhythm`, `arcade.reaction`
- **Contract:** `packages/contracts/src/rhythm.ts`
- **Runtime:** `packages/runtime/src/game-support/audioTransport.ts`
- **Primary consumers:** `rhythm-action`, `reaction-timing`

## 17.1 Audio transport

Renderer-neutral transport interface: `start` · `pause` · `resume` · `stop` where
needed · `currentTimeMs` · `state` · `dispose`. The browser implementation uses the
existing audio architecture / `AudioContext` timing. Tests use an injected
deterministic transport. **Do not use `Date.now()` as music-timing authority.**

## 17.2 Rhythm chart

JSON-safe `RhythmChart`: `schemaVersion` · `audioRole` · `bpm` · `offsetMs` · `notes` ·
`judgementWindows`.

Note: `id` · `timeMs` or `beat` · semantic action · optional `lane` · optional `holdMs`.
If beat notation is supported, conversion must be deterministic.

## 17.3 Judgement windows

`perfectMs` · `goodMs` · `missMs`. Validate `perfect <= good <= miss`.

## 17.4 Judgement

On semantic input, identify the nearest eligible unjudged note matching action/lane.

```
delta = input transport time - note time
abs(delta) <= perfect -> PERFECT
else abs(delta) <= good -> GOOD
else -> MISS / no-hit per explicit policy
```

**Never judge one note twice.**

## 17.5 Score

perfect · good · miss · combo · max combo · score · accuracy.
Reuse existing arcade scoring where composition is clean.

## 17.6 Lookahead

Schedule audio events ahead where necessary. **Transport position remains the
authority** — `setInterval`/`setTimeout` callback time must not become authoritative
beat state.

## 17.7 Pause

Pause/resume must not duplicate notes, duplicate scheduled audio, skip judgement
ownership, or shift the chart incorrectly.

## 17.8 Calibration

Bounded timing offset. **Do not modify OS/global audio.**

## 17.9 Reaction system

States: `READY` · `WAIT` · `STIMULUS` · `RESPONSE` · `FALSE_START` · `RESULT` ·
`SUMMARY`. Use canonical seeded RNG to choose WAIT during tests/seeded games.
Input during WAIT is `FALSE_START`. Input after stimulus records a deterministic
reaction interval from the injected/simulation clock.

## 17.10 Workbench

Chart/editor surface sufficient for BPM · offset · notes · actions/lanes · judgement
windows · calibration/default offset. **Do not build a DAW.**

## 17.11 Proof — rhythm action

audio unlocked · chart begins · PERFECT input · GOOD input · MISS · combo · score ·
pause · resume · completion.

## 17.12 Proof — reaction

multiple rounds · false start · valid response · result · summary.

## 17.13 Tests

beat conversion · window boundaries · double-judgement prevention · combo · miss expiry ·
pause/resume · calibration · reaction false-start · seeded wait · dispose.

---

# PHASE 18 — SIMULATION AGENTS, NEEDS, BEHAVIOR & SCHEDULES

**Commit:** `candidate(phase-18): add simulation agents and needs`

- **Capability:** `simulation.agents`
- **Contract:** `packages/contracts/src/simulationAgents.ts`
- **Pack:** `sw2d.simulation-agents`
- **Primary:** `pet-creature`, `colony-lite`
- **Secondary:** `virtual-pet`, `aquarium-terrarium`

**Do not merge this into combat AI.**

## 18.1 Needs

`NeedDefinition`: `id` · `minimum` · `maximum` · `initial` · `changePerSecond` ·
`warningThreshold` · `criticalThreshold`. Need IDs are content-authored — **do not
hardcode only hunger/sleep/social**.

## 18.2 Agents

`AgentDefinition`: `id`/archetype · `tags` · `needs` · `traits` · `behaviors` ·
`schedule` · optional home/location · navigation options.

## 18.3 Need tick

```
new = clamp(old + rate * deltaSeconds, min, max)
```

Bounded simulation update frequency. **Do not run expensive utility selection every
render frame.**

## 18.4 Behavior

`BehaviorDefinition`: `id` · `baseUtility` · `preconditions` · `needWeights` ·
target tags · `durationMs` · `cooldownMs` · `effects` · `interruptible`.

## 18.5 Utility selection

```
score = baseUtility + sum(needWeight * normalizedUrgency)
```

Define and document the urgency function. Tie-break must be deterministic using stable
behavior-ID ordering.

## 18.6 Lifecycle

`SELECT` · `START` · `ACTIVE` · `COMPLETE` · `INTERRUPTED`.
**Do not apply completion effects twice.**

## 18.7 Relationships

Generic: agent A · agent B · metric ID · value. Provide get/set/adjust.
**Do not bake romance/social assumptions into the core.**

## 18.8 Schedule

Game-time blocks: `start` · `end` · preferred activity · preferred location/job tags.
Simulation time only.

## 18.9 Work orders

`WorkOrder`: `id` · `kind` · `priority` · required agent tags · optional target/location ·
`duration` · `state` · optional `reservedBy`.
States: `open` · `reserved` · `active` · `complete` · `cancelled`.

## 18.10 Reservations

An exclusive work order has exactly one owner. Agent deletion/cancellation releases it.

## 18.11 Navigation

Use certified Phase-5 navigation. **No second pathfinder.**

## 18.12 Workbench

Author needs · behavior weights · schedule · work-order archetypes.
**Do not create an AI programming IDE.**

## 18.13 Proof — pet / virtual pet

need changes · a need becomes urgent · behavior/action occurs · interaction improves
need · relationship changes · state remains deterministic.

## 18.14 Proof — colony lite

multiple agents · different needs · multiple jobs · deterministic reservation ·
navigation · work completion · schedule change.

## 18.15 Aquarium regression

Two or more autonomous creatures use the same system.

## 18.16 Tests

need clamp · thresholds · utility score · stable ties · start/complete · interrupt ·
cooldown · relationship · schedule · reservation · release · navigation failure ·
save/load if configured · cleanup.

---

# PHASE 19 — ECONOMY, PRODUCTION & CUSTOMER SIMULATION

**Commit:** `candidate(phase-19): add economy and customer simulation`

- **Capabilities:** `simulation.economy`, `simulation.production`
- **Contract:** `packages/contracts/src/economy.ts`
- **Pack:** `sw2d.economy`
- **Primary:** `shopkeeper`, `idle-incremental`
- **Secondary:** `restaurant`, `tycoon-lite`

## 19.1 Goods

Canonical item IDs. Track stock · capacity · buy price · sell price · demand multiplier.
**Do not create a second item definition system.**

## 19.2 Transaction

Validate quantity > 0, sufficient stock, sufficient buyer funds. On success: stock
decrement, fund transfers, **one** transaction event/result.

## 19.3 Production

Recipe: `id` · `inputs` · `outputs` · `durationMs` · station type · batch size ·
optional unlock conditions.

## 19.4 Job

Use **one documented input policy** — reserve **or** consume-at-start. **Never double
consume.** Advance via simulation time. Produce outputs once.

## 19.5 Station

`id` · `type` · `capacity` · `position` · `queue` · occupied slots.

## 19.6 Placement

Use spatial interaction. Validate zone · overlap · footprint · accessibility/path if
agents require access.

## 19.7 Customers

Build on Phase 18. Additional: `budget` · `patience` · demand weights · preferences ·
arrival weight.

## 19.8 Customer flow

`ARRIVE` · `CHOOSE_TARGET` · `NAVIGATE` · `QUEUE` · `SERVICE` · `TRANSACTION` · `LEAVE`.
Patience expiration must leave cleanly and release reservations.

## 19.9 Queue

Default FIFO. Track join order · wait time · capacity · service slot.

## 19.10 Offline catch-up

**Only at the load/resume boundary.** Use an injected wall clock.

```
elapsed = current - saved timestamp
if elapsed < 0: elapsed = 0
clamp to maximum
```

Aggregate the result. **Do not replay frames.** Active simulation remains
simulation-time driven.

## 19.11 Prestige

Definition: eligibility · reset scopes · retained scopes · reward · multiplier/unlock.
Composes with progression / runs.

## 19.12 Workbench

Author goods · prices · production · stations · offline cap · prestige policies.

## 19.13 Proof — shopkeeper

stock · customer arrives · chooses · queues · service · purchase · stock/money change ·
restock/production.

## 19.14 Proof — idle

production · save · injected offline duration · bounded catch-up · prestige · reset ·
reward persists.

## 19.15 Restaurant regression

Customer/order/economy foundation only. Actual cooking is Phase 34.

## 19.16 Tests

transactions · stock failure · budget failure · production inputs · outputs · station
capacity · queue ordering · abandon · offline negative · offline huge clamp · prestige ·
save/load.

---

# PHASE 20 — NARRATIVE DIALOGUE, CHOICES & PORTRAITS

**Commit:** `candidate(phase-20): add dialogue and portrait presentation`

- **Capability:** `narrative.dialogue`
- **Contract:** `packages/contracts/src/dialogue.ts`
- **Content:** `content/dialogue.json`
- **Pack:** `sw2d.dialogue`
- **Primary:** `visual-novel`, `point-and-click`
- **Secondary:** `investigation-game`

## 20.1 Character

`id` · `displayName` · optional default expression · portrait asset roles by expression.
Portraits are optional — a zero-art game remains valid.

## 20.2 Node

`id` · `lines` · optional `choices` · optional `next`.

## 20.3 Line

stable line ID · speaker · text · expression · effects.
**Never use localised text itself as a persistent ID.**

## 20.4 Choice

stable ID · text · conditions · target node · effects · optional `once`.

## 20.5 Conditions

Bounded: narrative flag · world flag · choice history · seen node/line · item count ·
progression unlock · supported numeric compare. **No JS expression evaluator.**

## 20.6 Effects

Bounded: set narrative flag · set world flag · grant/remove item · progression
adjustment · mark seen · world transition. Reuse existing capability owners.

## 20.7 History

visits · line seen · choice counts · once-choice state.

## 20.8 Service

`start` · `currentNode` · `currentLine` · `advance` · `availableChoices` · `choose` ·
`history` · `end` · `dispose`.

## 20.9 DOM presentation

speaker · full text · portrait · advance · choice buttons. Keyboard and pointer/touch
accessible.

## 20.10 Accessibility

Full text available semantically **immediately**. A visual typewriter must not hide
content from the accessibility tree. Reduced motion shortens/disables the reveal.
No focus trap.

## 20.11 Workbench

Structured: characters · nodes · lines · choices · conditions/effects.
**Do not create universal visual scripting.**

## 20.12 Proof — visual novel

3 characters · expressions · branch · conditional choice · reconvergence · persistent
consequence · save/reload continuation.

## 20.13 Proof — point and click

world click · dialogue · choice · state change · later world interaction observes the
consequence.

## 20.14 Investigation regression

Witness/clue dialogue uses the same service.

## 20.15 Tests

graph refs · missing node · speaker · conditions · effects · once/repeat · history ·
save · focus · dispose.

**Run the Phase-20 tranche diagnostics.**

---

# PHASE 21 — DEFENSE OBJECTIVES, TOWERS & TERRITORY

**Commit:** `candidate(phase-21): add defense and territory objectives`

- **Capabilities:** `strategy.defense`, `strategy.territory`
- **Contract:** `packages/contracts/src/defense.ts`
- **Pack:** `sw2d.defense`
- **Consumers:** `tower-defense`, `lane-defense`, `base-defense`, `territory-control`

## 21.1 Towers

`TowerDefinition`: `id` · `cost` · `footprint` · `range` · `weaponId` · `targetPolicy` ·
upgrade tiers · optional refund ratio.

## 21.2 Target policies

`nearest` · `first-on-route` · `last-on-route` · `lowest-health` · `highest-health`.
Stable tie: entity ID.

## 21.3 Placement

Use pointer preview. Validate zone · overlap · resources · navigation connectivity.

For blocking placement: temporarily apply a navigation blocker, check **every** required
entrance→objective route, remove the temporary blocker, mark valid/invalid.
**Repeat validation on commit.**

## 21.4 Combat

Use Phase-3 weapons. **Do not implement a tower-specific projectile engine.**

## 21.5 Upgrades

cost · weapon override · range modifier · rate/cooldown modifier · optional effects.

## 21.6 Lanes

spawn · route · objective · encounter references. Use Phase-4 encounters.

## 21.7 Base

max/current health · breach damage · defeat condition.

## 21.8 Territory

`CaptureZone`: shape · owner · capture duration · decay · score.
Multiple opposing teams -> contested.

## 21.9 Proof — tower defense

place tower · path remains valid · wave · tower attacks · upgrade · base survives/changes.

## 21.10 Proof — territory

enter · capture progress · ownership · opponent contests · score behavior.

## 21.11 Regressions

Lane Defense · Base Defense.

## 21.12 Tests

placement · route rejection · target selection · upgrades · lane · breach · capture ·
contest · decay · cleanup.

---

# PHASE 22 — AUTONOMOUS COMBAT / AUTO-BATTLER

**Commit:** `candidate(phase-22): add autonomous combat orchestration`

- **Capability:** `strategy.auto-combat`
- **Contract:** `packages/contracts/src/autoCombat.ts`
- **Pack:** `sw2d.auto-combat`
- **Primary:** `auto-battler`

## 22.1 Unit

archetype · team · weapon · range · movement profile · target policy · role tags.

## 22.2 Deployment

Bounded slots/zones. Reject invalid placement.

## 22.3 State loop

`ACQUIRE` · `MOVE` · `ENGAGE` · `REASSESS` · `DEAD/COMPLETE`.

## 22.4 Target policies

`nearest` · `lowest-health` · `highest-threat` · `preferred-role`. Stable ID tie.

## 22.5 Navigation

Use Phase-5 navigation.

## 22.6 Combat

Use Phase-3 weapon/combat.

## 22.7 Reassess

Bounded interval. **Do not retarget every frame.**

## 22.8 Round

`DEPLOY` · `READY` · `BATTLE` · `RESOLVE` · `CLEANUP` · `NEXT`.

## 22.9 Proof

2 teams · multiple units · 2+ archetypes · deployment · autonomous navigation · combat ·
winner · cleanup.

## 22.10 Tests

targeting · stable ties · movement · attack · target death · retarget · winner · cleanup ·
restart.

---

# PHASE 23 — FARMING, CROPS, SEASONS & PLOTS

**Commit:** `candidate(phase-23): add farming and seasonal simulation`

- **Capability:** `simulation.farming`
- **Contract:** `packages/contracts/src/farming.ts`
- **Pack:** `sw2d.farming`
- **Primary:** `farming-lite`

## 23.1 Crop

`id` · `displayName` · `seedItemId` · `growthStages` · `validSeasons` · `requiresWater` ·
`harvestItems` · optional `regrowStage`.

## 23.2 Stage

`id` · duration in **one documented game-time unit** · optional asset role.

## 23.3 Plot

`empty` · `tilled` · `planted` · `growing` · `harvestable`.
Track crop · stage · progress · water.

## 23.4 Actions

till · plant · water · harvest · clear. Use canonical items.

## 23.5 Calendar

day · season · dayInSeason. Simulation time.

## 23.6 Season policy

Reject invalid planting, or follow an explicit authored policy.

## 23.7 Workbench

Crop catalog · growth stages · season · harvest outputs.

## 23.8 Proof

till · plant · consume seed · water · advance · grow · harvest · receive item.

## 23.9 Secondary

Restaurant/Colony consumes produce.

## 23.10 Tests

plant prerequisites · water · growth · season · harvest · regrow · calendar rollover.

---

# PHASE 24 — CONSTRUCTION & COLONY EXPANSION

**Commit:** `candidate(phase-24): add construction and colony expansion`

- **Capability:** `simulation.construction`
- **Contract:** `packages/contracts/src/construction.ts`
- **Pack:** `sw2d.construction`
- **Primary:** `colony-lite`
- **Secondary:** `base-defense`

## 24.1 Buildable

`id` · `footprint` · `cost` · `duration` · placement rules · result archetype ·
blocks navigation · refund.

## 24.2 Preview

Pointer placement. Invalid reasons: outside zone · overlap · resources · terrain ·
route blockage.

## 24.3 Nav check

Temporary blocker · validate required paths · **rollback the temporary change**.

## 24.4 Blueprint

Use **one** resource policy: reserve **or** deduct. Never both.

## 24.5 Work order

Use Phase-18 agent work orders. Worker: reserve · navigate · build.

## 24.6 Progress

Simulation time.

## 24.7 Complete

Replace blueprint with completed entity. **Update nav exactly once.**

## 24.8 Cancel / deconstruct

release resource/job · remove blockers · refund per policy.

## 24.9 Proof — colony

place two structures · worker assignment · navigate · build · complete · nav update.

## 24.10 Secondary

Base-defense buildable.

## 24.11 Tests

cost · overlap · route · resource policy · cancel · worker · completion · nav update.

---

# PHASE 25 — INTERACTIVE FICTION COMMAND PARSER

**Commit:** `candidate(phase-25): add text command parser`

- **Capability:** `narrative.commands`
- **Contract:** `packages/contracts/src/commands.ts`
- **Primary:** `interactive-fiction-hybrid`

**No LLM. No remote NLP. No `eval`. No arbitrary authored JS.**

## 25.1 Vocabulary

`VerbDefinition`: `id` · `synonyms`.
`EntityVocabulary`: `entityId` · `nouns` · `adjectives` · `aliases`.

## 25.2 Tokenization

trim · case-normalised matching · harmless punctuation normalisation · whitespace
tokenisation · **preserve raw input**.

## 25.3 Grammar

`VERB` · `VERB OBJECT` · `VERB OBJECT PREPOSITION OBJECT`.
Prepositions include: to · with · on · at · in · from.

## 25.4 Resolution

Most-specific phrase. No candidates -> unknown. Multiple -> ambiguous + candidates.
**Never silently guess.**

## 25.5 Result

`raw` · `verbId` · `directObjectId` · `indirectObjectId` · `status`.

## 25.6 Safe dispatch

Registered command handler IDs only. **Input text never names arbitrary functions.**

## 25.7 UI

input · submit · history · help · previous command. Accessible.

## 25.8 Dialogue

`TALK` may start Phase-20 dialogue.

## 25.9 Proof

`LOOK` · `EXAMINE DESK` · `TAKE KEY` · `USE KEY ON DOOR` · `TALK TO GUARD` ·
an ambiguity case.

## 25.10 Tests

tokens · verb synonym · noun alias · adjectives · preposition · unknown · ambiguous ·
dispatch safety.

**Run the Phase-25 tranche diagnostics.**

---

# PHASE 26 — EVIDENCE, DEDUCTION & INVESTIGATION BOARD

**Commit:** `candidate(phase-26): add evidence and deduction system`

- **Capability:** `narrative.evidence`
- **Contract:** `packages/contracts/src/evidence.ts`
- **Pack:** `sw2d.evidence`
- **Primary:** `investigation-game`

## 26.1 Evidence

`id` · `title` · `description` · `source` · `tags` · optional asset role · initial state.

## 26.2 Node types

evidence · person · place · event · hypothesis.

## 26.3 Relations

supports · contradicts · associated · caused-by · located-at · plus bounded registered
custom IDs.

## 26.4 Logical / visual split

**Graph truth is separate from board card positions.** Moving a card changes layout,
not truth.

## 26.5 Board

select · drag · inspect · link · unlink. Use spatial interaction.

## 26.6 Deduction rule

Conditions: evidence discovered · relation exists · flag · item · forbidden relation.
Results: hypothesis · evidence · flag · dialogue/world consequence.

## 26.7 Evaluation

Deterministic. A one-time rule fires once.

## 26.8 Workbench

Evidence definitions · relations · deduction rules.

## 26.9 Proof

collect clues · open board · arrange · link correct relationship · deduction unlocks ·
new conversation/world effect.

## 26.10 Tests

discover · duplicate · link · unlink · rule · one-shot · persistence · visual layout
independence.

---

# PHASE 27 — CODEX, EXHIBIT & INSPECT FRAMEWORK

**Commit:** `candidate(phase-27): add codex and exhibit framework`

- **Capability:** `narrative.codex`
- **Contract:** `packages/contracts/src/codex.ts`
- **Pack:** `sw2d.codex`
- **Primary:** `museum-exhibit`
- **Secondary:** `exploration-game`

## 27.1 Entry

`id` · `category` · `title` · `body` · optional asset role · `tags` · related IDs ·
unlock conditions.

## 27.2 Service

`unlock` · `isUnlocked` · `markSeen` · `isSeen` · `list` · `category` · `search` · `related`.

## 27.3 Search

Local deterministic search over title · body · tags. **No external search.**

## 27.4 Exhibit

world interaction · entry ID · label · optional dialogue · optional effects.

## 27.5 Presentation

categories · search · entry · media if local · related. Accessible DOM.

## 27.6 Proof — museum

inspect exhibit · unlock · read · related entry.

## 27.7 Secondary

Exploration unlocks lore.

## 27.8 Tests

unlock · seen · category · search · relations · conditions · persistence.

---

# PHASE 28 — MICROGAME COLLECTION FRAMEWORK

**Commit:** `candidate(phase-28): add microgame collection framework`

- **Capability:** `arcade.microgames`
- **Contract:** `packages/contracts/src/microgames.ts`
- **Pack:** `sw2d.microgames`
- **Primary:** `microgame-collection`
- **Secondary:** `local-party-game`

## 28.1 Definition

`id` · `title` · `instruction` · `duration` · `difficulty` · `requiredPlayers` ·
`inputProfile` · `implementationKey` · optional `weight`.
`implementationKey` maps to a **local registered implementation only**.

## 28.2 States

`INTRO` · `READY` · `PLAY` · `SUCCESS` · `FAILURE` · `TRANSITION` · `COMPLETE`.

## 28.3 Scheduler

`ordered` · `seeded-random` · `weighted`. Avoid an immediate duplicate when
alternatives exist.

## 28.4 Resource scope

Every microgame must clean: entities · listeners · timers · physics · audio ·
input claims · pointer targets.

## 28.5 Meta

score · streak · lives · round.

## 28.6 Proof

At least **five materially different** games using existing systems: reaction ·
pointer target · movement · physics · rhythm/timing. **No five mini-engines.**

## 28.7 Tests

scheduler · seed determinism · weight · repeat avoidance · lifecycle · scope disposal ·
score.

---

# PHASE 29 — CHARACTER CUSTOMIZATION / DRESS-UP

**Commit:** `candidate(phase-29): add character customization`

- **Capability:** `presentation.appearance`
- **Contract:** `packages/contracts/src/appearance.ts`
- **Primary:** `dress-up-character-toy`
- **Secondary:** `virtual-pet` or `local-party` avatar

## 29.1 Slot

Project-defined slots: `id` · `name` · `allowMultiple` · required/excluded tags.
**Do not universally assume human anatomy.**

## 29.2 Attachment

`id` · `slot` · asset role · `anchor` · `offset` · `scale` · `rotation` · z-order ·
`tags` · compatibility · optional `tint`.

## 29.3 Service

`canEquip` · `equip` · `unequip` · `equipped` · `state` · serialize/restore.

## 29.4 Validation

wrong slot · requirements · exclusion · exclusive conflict.

## 29.5 Drag/drop

Use spatial interaction. An invalid drop leaves state valid.

## 29.6 Render

Attachment is placed relative to the authored sprite anchor/presentation.
**Do not edit source sprite pixels. Do not invent bones.**

## 29.7 Save

Save attachment IDs/state.

## 29.8 Proof

equip · drag/drop · invalid combination · multi-slot · save/reload.

## 29.9 Tests

compatibility · exclusive · equip · unequip · serialization · invalid restore.

---

# PHASE 30 — RUNTIME SANDBOX AUTHORING

**Commit:** `candidate(phase-30): add runtime sandbox editing`

- **Capability:** `world.sandbox`
- **Contract:** `packages/contracts/src/sandbox.ts`
- **Runtime:** `packages/runtime/src/game-support/sandboxEditor.ts`
- **Primary:** `sandbox-playground`

**This is not another Workbench.**

## 30.1 Registry

Only registered archetypes. Each declares allowed: place · move · rotate · scale ·
duplicate · delete · properties.

## 30.2 Modes

`EDIT` · `PLAY`. The authoritative edit snapshot is separate from transient play state.

## 30.3 Command history

Each edit is undoable: place · delete · move · rotate · scale · property.
`apply` · `undo`. Bound the history.

## 30.4 Input

Pointer: select · drag · place. Keyboard: delete · duplicate · nudge · undo · redo.

## 30.5 Snap

Optional grid.

## 30.6 Serialization

`schemaVersion` · instances · transforms · approved properties.
Reject unknown archetype and forbidden property. **Never execute serialized code.**

## 30.7 Proof

place · move · duplicate · delete · undo · redo · play · return to edit · save · reload.

## 30.8 Tests

apply · undo · history cap · unknown type · serialize · edit/play separation · snap.

**Run the Phase-30 tranche diagnostics.**

---

# PHASE 31 — DRAWING / STROKE GAMEPLAY

**Commit:** `candidate(phase-31): add drawing and stroke input`

- **Capability:** `input.strokes`
- **Contract:** `packages/contracts/src/strokes.ts`
- **Runtime:** `packages/runtime/src/game-support/strokeService.ts`
- **Primary:** `drawing-game`
- **Secondary:** investigation annotation / sandbox

## 31.1 Point

`x` · `y` · sequence/time · optional pressure. Local normalised drawing coordinates.

## 31.2 Stroke

`id` · `brush` · `width` · `color` · `points`.

## 31.3 Service

`beginStroke` · `appendPoint` · `endStroke` · `cancelStroke` · `erase` · `clear` ·
`undo` · `redo` · `strokes` · `dispose`.

## 31.4 Resampling

**Do not retain every `pointermove`.** Append after a minimum distance or a required
endpoint.

## 31.5 Bounds

Bound points/stroke · stroke count · undo history.

## 31.6 Brushes

solid · basic soft · eraser.

## 31.7 Resize

**Stroke geometry is authoritative.** Canvas resize re-renders.

## 31.8 Export

Optional local raster export. **No network.**

## 31.9 Proof

draw · second stroke · erase · undo · redo · clear.

## 31.10 Tests

begin · threshold · end · cancel · bounds · erase · undo/redo · resize preservation.

---

# PHASE 32 — RAIL CAMERA & GUIDED PATH MOVEMENT

**Commit:** `candidate(phase-32): add rail camera and guided paths`

- **Capability:** `world.rail`
- **Contract:** `packages/contracts/src/rail.ts`
- **Runtime:** `packages/runtime/src/game-support/railRuntime.ts`
- **Primary:** `rail-shooter`
- **Secondary:** museum/photography guided route

## 32.1 Path

`id` · `points` · `speed` **OR** `duration` · `loop` · `stops` · `markers` ·
optional look target. **Do not permit ambiguous speed+duration without explicit
precedence.**

## 32.2 Precomputation

Polyline: segment lengths · total length · cumulative distance.
Resolve position and tangent by distance/progress. Spline optional only if already easy.

## 32.3 Service

`start` · `pause` · `resume` · `progress` · `position` · `tangent` · `complete` · `dispose`.

## 32.4 Markers

`id` · distance/progress · event · payload/reference. Default **once per traversal** —
no marker firing every frame after crossing.

## 32.5 Camera

The runtime bridge owns the Phaser camera. The contract stays renderer-neutral.

## 32.6 Rail shooter

Combine rail · pointer · weapons · encounters. Allow bounded local movement relative to
the rail anchor where appropriate.

## 32.7 Proof

start · travel · marker encounter · shoot · next marker · complete · restart ·
no duplicate markers.

## 32.8 Secondary

Non-shooter guided path.

## 32.9 Tests

length · interpolation · tangent · pause · resume · marker once · loop · restart · dispose.

---

# PHASE 33 — FISHING

**Commit:** `candidate(phase-33): add fishing gameplay`

- **Capability:** `simulation.fishing`
- **Contract:** `packages/contracts/src/fishing.ts`
- **Primary:** `fishing-game`

## 33.1 Fish

`id` · `name` · `rarity` · habitat tags · bite weight · `stamina` · pull strength ·
reward item · bite delay min/max.

## 33.2 Zone

`id` · `area` · habitat tags · cast allowed.

## 33.3 State machine

`READY` · `CASTING` · `LANDED` · `WAITING` · `BITE` · `HOOKED` · `FIGHTING` · `CAUGHT` ·
`ESCAPED`. **Every state must have a valid exit.**

## 33.4 Cast

Semantic input. Optional pointer aim. Validate zone.

## 33.5 Fish choice

Canonical seeded RNG. Habitat candidates. Weighted choice.

## 33.6 Bite

Seeded delay. **No `Math.random`.**

## 33.7 Hook

Bounded input window. Timeout -> `ESCAPED`.

## 33.8 Fight

Track stamina · tension · reel progress · fish pull.
Too much tension -> escape/break. Configured prolonged slack -> escape.
Valid completion -> caught.

## 33.9 Reward

Canonical item. **No fishing inventory.**

## 33.10 Proof

3 fish definitions · legal cast · bite · hook · fight · catch · canonical reward ·
escape/break case.

## 33.11 Tests

zone · weighted choice · seed · delay · hook timeout · tension · catch · reward.

---

# PHASE 34 — COOKING / RECIPES / ACTION SEQUENCES

**Commit:** `candidate(phase-34): add cooking and recipe actions`

- **Capability:** `simulation.cooking`
- **Contract:** `packages/contracts/src/cooking.ts`
- **Content:** `content/recipes.json`
- **Primary:** `cooking-game`
- **Secondary:** `restaurant`

## 34.1 Recipe

`id` · `name` · `ingredients` · `stations` · `steps` · output item · quality rules.

## 34.2 Step union

Bounded union: chop · mix · heat · bake · boil · assemble · season · serve.

## 34.3 Step

`id` · `kind` · `station` · optional `duration` · optional semantic action ·
optional timing window · input/intermediate · quality change.

## 34.4 State

recipe · current step · ingredient/intermediate state · quality · failed · complete.

## 34.5 Ingredients

Canonical items. **No shadow inventory.**

## 34.6 Intermediate state

Prefer recipe-local intermediate state. Only create a canonical intermediate item when
it has real inventory meaning.

## 34.7 Stations

A wrong station rejects the step.

## 34.8 Timing

Use Phase-17 timing. **No second timing system.**

## 34.9 Quality

Deterministic from correctness · timing · explicit modifiers.

## 34.10 Restaurant

order · cook · output · serve · Phase-19 transaction/satisfaction.

## 34.11 Proof

2 recipes · 2 station types · multiple steps · timing-sensitive action · final canonical
output item.

## 34.12 Tests

ingredients · insufficient · station · step order · timing · quality · output ·
restaurant integration.

---

# PHASE 35 — PHOTOGRAPHY

**Commit:** `candidate(phase-35): add photography gameplay`

- **Capability:** `world.photography`
- **Contract:** `packages/contracts/src/photography.ts`
- **Runtime:** `packages/runtime/src/game-support/photographyRuntime.ts`
- **Primary:** `photography-game`
- **Secondary:** exploration / museum

## 35.1 Subject

`id` · `tags` · base value · minimum visible fraction · preferred distance min/max ·
preferred center distance · rarity multiplier · objective tags.

## 35.2 Runtime subject

Logical ID · world bounds/position · active state. **No Phaser object in the contract.**

## 35.3 Frame evaluation

For each active subject: viewport intersection · visible fraction · normalised center
distance · subject distance · qualification.
**Do not use screenshot pixel recognition when scene geometry already knows the answer.**

## 35.4 Score

Document a deterministic formula, e.g.

```
baseValue * visibilityFactor * framingFactor * distanceFactor * rarityMultiplier
```

Clamp factors.

## 35.5 Capture

Use the local renderer/canvas. Bound dimensions. **No network.**

## 35.6 Album

`id` · session/game time · subjects · score · tags · thumbnail. Bound the album.
Choose an **explicit** full policy: drop oldest **or** reject new.

## 35.7 Proof

bad framing · lower score · improved framing · higher score · album stores both.

## 35.8 Secondary

Exploration/museum photo objective.

## 35.9 Tests

visibility · framing · distance · score determinism · empty frame · album cap · metadata.

**Run the Phase-35 tranche diagnostics.**

---

# PHASE 36 — FULL 74-PRESET CANDIDATE REALIZATION

**Commit:** `candidate(phase-36): realize full preset catalog`

This is an **integration** phase. **Do not invent another major engine.**

Create `docs/presets/ANTIGRAVITY_PRESET_REALIZATION_MATRIX.md` (the filename may retain
its historical Anti-Gravity name unless there is a strong reason to rename it; it
represents the shared candidate). It must contain **exactly 74 preset rows**.

## 36.1 Exact presets

```
01 traditional-platformer      02 chase-platformer          03 endless-runner
04 precision-platformer        05 metroidvania              06 puzzle-platformer
07 auto-runner                 08 climbing-game             09 grappling-platformer
10 collectathon-platformer

11 top-down-adventure          12 action-adventure          13 twin-stick-shooter
14 survivor-like               15 dungeon-crawler           16 action-roguelite
17 stealth-game                18 heist-game                19 arena-combat
20 boss-rush

21 horizontal-shmup            22 vertical-shmup            23 bullet-hell
24 asteroids-shooter           25 gallery-shooter           26 run-and-gun
27 rail-shooter

28 top-down-racer              29 kart-racer                30 time-trial-racer
31 endless-driving             32 boat-flight-racer

33 sokoban                     34 match-puzzle              35 falling-block-puzzle
36 breakout                    37 pong                      38 physics-puzzle
39 maze-game                   40 rhythm-action             41 reaction-timing
42 pinball-lite

43 tower-defense               44 lane-defense              45 auto-battler
46 simple-rts                  47 turn-based-tactics        48 base-defense
49 territory-control

50 idle-incremental            51 shopkeeper                52 tycoon-lite
53 farming-lite                54 pet-creature              55 colony-lite
56 restaurant                  57 aquarium-terrarium

58 exploration-game            59 visual-novel              60 point-and-click
61 interactive-fiction-hybrid  62 investigation-game        63 museum-exhibit
64 escape-room

65 microgame-collection        66 local-party-game          67 physics-toy
68 virtual-pet                 69 dress-up-character-toy    70 sandbox-playground
71 drawing-game                72 fishing-game              73 cooking-game
74 photography-game
```

**Do not delete presets. Do not merge them together.**

## 36.2 Matrix fields

preset ID · family · canonical maturity · required reusable capabilities · optional
capabilities · generated successfully · built successfully · browser start attempted ·
genre-defining interaction attempted · genre-defining interaction working · remaining
candidate defect · known-limitation candidate status.

## 36.3 Required capability ownership

| Preset | Owning capabilities |
| --- | --- |
| Traditional | baseline platform |
| Chase | Phase 11 |
| Endless Runner | generation |
| Precision | platform |
| Metroidvania | world graph |
| Puzzle Platformer | puzzle rules |
| Auto Runner | generation |
| Climbing | Phase 12 |
| Grappling | advanced physics |
| Collectathon | items |
| Top-Down Adventure | items/world |
| Action Adventure | weapons/combat |
| Twin Stick | pointer + weapons |
| Survivor | encounters + Phase 13 |
| Dungeon | generation |
| Roguelite | generation + Phase 13 |
| Stealth | nav + Phase 11 |
| Heist | nav + Phase 11 |
| Arena | combat/weapons |
| Boss | weapons/encounters |
| Shmups | weapons/encounters |
| Bullet Hell | projectiles/patterns |
| Asteroids | weapons + physics as applicable |
| Gallery | pointer + weapons |
| Run-and-Gun | platform + weapons + encounters where integrated |
| Rail | pointer + weapons + encounters + Phase 32 |
| Racers | vehicle/race |
| Kart | items + vehicle/race |
| Endless Driving | generation + vehicle |
| Boat/Flight | vehicle profiles |
| Sokoban | puzzle rules |
| Match | pointer + certified match rule system |
| Falling Block | certified falling-block rule system |
| Breakout | Phase 16 |
| Pong | Phases 15 + 16 |
| Physics Puzzle | puzzle rules + physics |
| Maze | world/grid |
| Rhythm | Phase 17 |
| Reaction | Phase 17 |
| Pinball | physics |
| Tower | pointer + weapons + encounters + navigation + Phase 21 |
| Lane | weapons + encounters + navigation + Phase 21 |
| Auto Battler | combat + navigation + Phase 22 |
| RTS | Phase 14 |
| Tactics | Phase 14 |
| Base | Phase 21 + optional 24 |
| Territory | Phase 21 |
| Idle | Phase 19 |
| Shopkeeper | 18 + 19 |
| Tycoon | 18/19 |
| Farming | 23 |
| Pet | 18 |
| Colony | 5 + 18 + 19 + 24 |
| Restaurant | 18 + 19 + 34 |
| Aquarium | 18 |
| Exploration | 8 + optional 27 |
| Visual Novel | 20 |
| Point-and-click | 1 + 20 |
| Interactive Fiction | 20 + 25 |
| Investigation | 20 + 26 |
| Museum | 27 |
| Escape | pointer + puzzle rules |
| Microgames | 28 |
| Party | 15 + optional 28 |
| Physics Toy | pointer + physics |
| Virtual Pet | 18 + optional 29 |
| Dress-Up | 29 |
| Sandbox | 30 |
| Drawing | 31 |
| Fishing | 33 |
| Cooking | 34 |
| Photography | 35 |

## 36.4 First-ten integration debt

Explicitly inspect and close where practical:

- **match-puzzle** — the certified match rules + spatial pointer must actually be used
  by the generated preset.
- **run-and-gun** — integrate the existing encounter capability where the genre
  implementation needs it.
- **action-adventure** — the same encounter-integration audit.
- **kart-racer** — use canonical items/effects for usable bounded kart item behavior.
- **boat-flight-racer** — actually demonstrate bounded profile differences.
- **physics-puzzle** — use the certified physics-goal + advanced physics.
- **pinball-lite** — ensure a recognizable bounded pinball loop rather than generic
  physics objects.

**Do not create new foundational systems to solve these.**

## 36.5 Recognizable genre loop

A compiled square is not enough. Every preset must exhibit its defining interaction.
Use the established recognizable-game checklist in the existing candidate program.
At minimum, validate the defining loop named by each preset family and the capability
ownership table above.

## 36.6 Generation

Generate all 74 through the normal factory path. **Do not hand-author 74 disconnected QA
outputs.** If many fail from one source, repair the shared template/generator source.

## 36.7 Build

Build every generated preset. Record failures by common cause.
**Never patch only the generated snapshot when the generator source is wrong.**

## 36.8 Browser

Use/extend the current matrix infrastructure. For each candidate: load · Start · enter
gameplay · perform the defining interaction · observe console/network · restart/dispose
when relevant. This is candidate evidence, **not** final certification.

## 36.9 Limitations

Audit all `knownLimitations`. Classify each: `STILL TRUE` · `RESOLVED BY CERTIFIED FIRST TEN` ·
`RESOLVED BY CANDIDATE` · `PARTIAL` · `STALE` · `NEEDS CERTIFIER`.
Remove a limitation only when an actual generated consumer + evidence exists.
**Do not mass-promote maturity.**

## 36.10 Unplanned small gaps

A small integration gap: fix it. A major new subsystem with multiple designs: record
`UNPLANNED SHARED GAP`. **Do not invent another giant phase casually.**

## 36.11 Counts

Record actual: registered X/74 · generated X/74 · built X/74 · browser-started X/74 ·
identity attempted X/74 · identity working X/74 · repair needed X/74.
**Never fabricate 74/74.**

## 36.12 Final candidate diagnostics

`npm run typecheck` · `npm test` · `npm run validate` · `npm run qa:smoke` ·
`npm run qa:proof` · `npm run release:verify`.
When practical: `npm run qa:matrix` · `npm run qa:starter-kits` · `npm run qa:workbench` ·
`npm run qa:responsive`. **Record real results.**

---

## 37. Candidate defect sweep (before handoff)

Inspect:

duplicate pack IDs · duplicate capability IDs · missing exports · schema registration ·
contract/schema mismatch · content not loaded · pack dependency cycles · renderer
leakage · raw keyboard bypass · `Math.random` · `Date.now` in active simulation ·
timer-authority errors · listener leaks · pointer leaks · gamepad disconnect state ·
perception stale entities · navigation stale ownership · run reset bugs · strategy stale
orders · ball collider restart issues · rhythm duplicate scheduling · job reservation
leaks · customer queue leaks · offline unbounded time · dialogue reference errors ·
tower navigation poisoning · auto-combat loops · farming dead states · construction
double-spend · parser unsafe dispatch · evidence invalid refs · codex refs · microgame
resource leaks · appearance asset mutation · sandbox unsafe import · unbounded undo ·
unbounded stroke buffers · rail marker duplication · fishing dead-end states · cooking
dead-end states · photography album growth · network dependencies · zero-art regression ·
Free-Sprite regression · rights/provenance regression · frame-animation regression ·
Start/Pause regression · offline regression · stale limitations.

Repair safe obvious candidate defects. Record unresolved concerns.

---

## 38. Certifier boundary

Phase 36 does **not** authorize: main integration · final certification · mass maturity
promotion · claiming all 74 are production-proof.

A stronger independent certification pass remains required. **Candidate branch only.**

---

## 39. Durable handoff

Maintain [`ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md`](ANTIGRAVITY_POST_TEN_CANDIDATE_STATE.md)
and create/update `ANTIGRAVITY_POST_TEN_REPAIR_HANDOFF.md`.

Record for every phase 15–36: commit · status · implementation · proof · tests ·
limitations · known shortcuts · certifier work.

---

## 40. Stop conditions

**Stop only if:**

- unexplained user work would be overwritten
- the repository is unsafe/corrupt
- a structural compile/schema/build problem cannot be repaired safely
- required tooling is unavailable
- a major new architecture gap has materially incompatible solutions and project
  evidence cannot select one.

**Do not stop because:** the phase is large · context is long · tests take time ·
a new chat would be easier · you want routine approval.

The durable specification now exists. Read it after compaction.
