# Proof Contract — idle-incremental

Frozen before implementation.

## Preset

`idle-incremental` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, optional `sw2d.arcade`. Content role `tuning` only. Currently `smoke-validated`.

Generated via `npm run sw2d -- new proof-idle-incremental --preset idle-incremental`, moved into this committed `proofs/idle-incremental/` tree, replacing the generated menu-selector placeholder entirely.

This proof's mechanics closely follow the already-proven, smoke-validated `demos/idle-incremental/` design: that demo's smoke contract already exercises every mechanic MASTER_PROJECT.md §24 requires for this proof (deterministic production, job/queue, one upgrade, real save/reload via browser navigation, network-free, no canvas-movement dependency). There is no reason to redesign working, already-approved mechanics just to appear different — the deep-proof bar this preset must clear is going through the real generator path with a dedicated `proofs/`/`qa:proof` contract and stricter automated assertions, not mechanical novelty.

## Reusable capabilities exercised

- `sw2d.simulation` (`SimulationService`) — `addResource`/`resource` for the `gold` ledger; `queueJob`/`isJobComplete`/`cancelJob` for the gather job.
- `sw2d.progression` (`ProgressionService`) — `addCurrency`/`currency` for the currency spent on the upgrade.
- `SaveStore` (`context.saves`) — `load`/`save` with a versioned record (`VersionedRecord`), the same real persistence capability every generated game gets, not a proof-invented mechanism.
- `uiSimulationController.read()` for `confirmPressed` (save trigger); `context.input.justPressed()` directly for `PRIMARY_ACTION`/`SECONDARY_ACTION` (gather / upgrade), the same pattern Proof C's tower upgrade and the reference demo both already use for actions outside a controller's own intent shape.

## Game-specific mechanics (`src/game-specific/shellPack.ts`)

- Deterministic passive production: `gold` increases by `PRODUCTION_RATE_PER_SEC * rateMultiplier * deltaMs / 1000` every `update()` tick — a pure function of elapsed simulated time, no RNG, no wall-clock reads.
- One job (`gather`, fixed 500ms duration) queued via `PRIMARY_ACTION`; on completion it grants a flat gold + currency bonus and increments `jobsCompleted`. Only one job may be queued at a time (simplest real queue, not a multi-slot scheduler this preset doesn't need).
- One upgrade (`SECONDARY_ACTION`, cost 20 currency, doubles `rateMultiplier`) — a single-tier upgrade is enough to prove "an upgrade changes measurable behavior"; a deeper upgrade tree is exactly the "large economy balancing" this preset's own documented limitation defers.
- Save (`CONFIRM`) writes `{gold, currency, rateMultiplier, jobsCompleted}` as a versioned record to a fixed save slot. No second, private economy format is invented — this is the same shape `content/tuning.json`'s sibling role (`levels`) would take if this preset needed one, kept in code because `tuning` is this preset's only declared content role and this state isn't tunable content, it's runtime save state.
- Presentation is plain Phaser text (`scene.add.text`), matching the `ui-simulation` controller family's own "no canvas movement" contract — gameplay never depends on player position or physics.

## Content roles used

- `tuning` — generator-default `content/tuning.json`, validated as part of every generated game's content bundle. This genre has no numeric field the shared schema covers (it's the same `player.moveSpeed/jumpVelocity/gravity` shape every preset's tuning document uses), so nothing new is read from it — matching the reference demo's own precedent. No content-authored production-chain schema is introduced (per the Phase 9 lock: not required unless implementation proves otherwise, and it does not here).

## Terminal success/failure oracle

- **Success:** after a real browser reload (`harness.gotoAndWaitForRuntime` against the same URL — genuine navigation, not an in-memory reset), the restored debug snapshot's `loadOutcome === 'loaded'` and every persisted field (`gold`, `currency`, `rateMultiplier`, `jobsCompleted`) matches what was saved immediately before reload.
- **Failure surface (all observable):** `gold`, `currency`, `rateMultiplier`, `jobsCompleted`, `jobPending`, `loadOutcome`, `lastSaveOutcome`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start with known resources (`currency === 0`, `jobsCompleted === 0`, `rateMultiplier === 1` on a fresh load — no save yet exists for this run; `gold` is already ticking upward deterministically by the time of the first sample, which the next step's equal-interval check proves).
2. Advance controlled time (two equal-length stepped intervals) — deterministic production: the gold delta over each interval is equal (within floating-point tolerance), proving it's a pure function of elapsed time, not frame count or real wall-clock.
3. Enqueue/start a job (`PRIMARY_ACTION`) twice in sequence, each run to completion, accumulating enough currency (10 each) for the upgrade (cost 20) — `jobsCompleted` increments each time, `jobPending` clears on completion.
4. Buy/apply the one upgrade (`SECONDARY_ACTION`) — currency decreases by exactly 20, `rateMultiplier` becomes 2.
5. Upgrade changes measurable behavior — advancing the same fixed interval again now yields a materially larger gold delta than before the upgrade.
6. Save (`CONFIRM`).
7. Real browser reload/navigation (not a script-level state reset).
8. Restored state matches saved state (`currency`, `rateMultiplier`, `jobsCompleted` exactly; `gold` at least the saved amount — production resumes the instant the reloaded scene installs, so a few post-reload frames legitimately add a little more before the first post-reload sample).
9. Continue the simulation after reload — one more stepped interval still produces gold.
10. Zero required external network throughout (the shared `runSmoke`/`runProofs` oracle already asserts zero external requests for every target).

## Acceptance

- Deterministic resources/timing: equal elapsed time yields equal (within tolerance) production, both before and after the upgrade changes the rate.
- Real queue/job: a job actually occupies `jobPending` until its fixed duration elapses, then grants its reward exactly once.
- Real upgrade: costs currency, changes `rateMultiplier`, and that changed rate visibly affects subsequent production — not merely a flag flip.
- Save/reload preserves state across a genuine page reload, not an in-memory illusion.
- Network-free: no required external requests (shared oracle).
- No movement dependency: the whole loop is provable through `PRIMARY_ACTION`/`SECONDARY_ACTION`/`CONFIRM` and elapsed time alone.

---

## Post-ten program Phase 19 extension (economy, production & offline catch-up, ADR-0033)

The ten steps above are the certified Phase-10 journey and are **unchanged**: the same gold
ledger, the same job primitive, the same upgrade, the same save/reload equality bar. Phase 19
appends five steps below them, because this preset's honest limitation was that offline
catch-up and prestige *were not systems*, and the only way to retire that claim is to make
the same game use the real ones.

### Additional composition

`sw2d.economy` is added to `content/game.json` alongside the packs it already had, and
`content/economy.json` (`urn:sw2d:schema:content-economy:v1`) authors a smelting chain, a
20-second offline cap at 50% efficiency, and a prestige gated on holding three ingots.

`src/main.ts` injects a `ManualWallClock` through `createGame({ wallClock })`. It is the
same one-method interface the browser clock implements — asserting on catch-up against
`Date.now()` would mean genuinely waiting.

### Additional journey steps

11. **Consume at start, produce once.** Starting a smelt takes 2 ore immediately and yields
    nothing; the ore count is unchanged when the ingot appears, so the inputs were never
    taken twice.
12. **Offline catch-up aggregates.** The document credits 50% efficiency, so 4000ms away buys
    2000ms of work: the in-flight batch plus exactly one more, with the second batch paying
    for its own ore. No frames are replayed.
13. **The absence is bounded.** A 24-hour trip is clamped to the authored 20 seconds and the
    report says `clamped`; a clock that moved backwards an hour credits nothing at all.
14. **Prestige is gated, resets what it declares, and its reward survives.** Ineligible until
    three ingots exist; then the shelf returns to its authored opening, and currency is wiped
    and *then* granted the reward — so the balance is the reward, not zero.
15. **The multiplier is load-bearing.** After one prestige the same recipe finishes in about
    a third of the frames its authored duration would need.

### Additional negative controls

| Sabotage | Expected |
| --- | --- |
| Offline catch-up is not clamped to the authored maximum | step 13 FAILS |
| The prestige reward is granted before the currency wipe | step 14 FAILS |

### What this extension does not claim

The Phase-10 maturity claim (`proof-validated`) rests on the ten steps above, which still
pass exactly as they did. The five new steps strengthen the same proof; they do not promote
any other preset, and `shopkeeper`, `tycoon-lite` and `restaurant` remain recipes.
