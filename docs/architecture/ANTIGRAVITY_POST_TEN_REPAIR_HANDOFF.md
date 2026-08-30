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
| 16 | Ball & Paddle Arcade Systems | FOCUSED TESTS PASS | this phase | breakout (12 steps), pong (12 steps, upgraded) |
| 17–36 | see `POST_TEN_PROGRAM_SPEC.md` | NOT STARTED | — | — |

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

---

## Verified gates at the latest phase boundary

Re-run and re-recorded at each phase; these are the Phase-16 numbers.

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS, 0 errors |
| `npx vitest run` | PASS — 163 files / 2861 tests |
| `npm run validate` | PASS at the Phase-15 boundary (incl. offline check: no external request construct); Phase 16 is not a tranche gate, so `validate` was not re-run |
| `npm run qa:proof` | PASS — 32/32 |
| `npm run qa:workbench` | PASS — 16/16; WB-SECURITY-001 audits 64 endpoints |

---

## Proof-quality discipline

Every named acceptance step in every post-ten proof tests an observable property. No spec contains
an unconditional `true`; the one that did (Phase 13's `step17_resumable`) was repaired in `7902701`.

Each phase's new proof steps are **negative-control verified**: a targeted sabotage of the
implementation is applied, observed to fail exactly the expected step(s), and reverted. The
per-phase tables live in the candidate ledger and in each `proofs/<id>/PROOF_CONTRACT.md`.
