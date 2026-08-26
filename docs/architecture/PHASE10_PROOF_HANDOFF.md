# Phase 10 Proof Handoff

**Phase 10 - Five Deep Proof Games. Executed by Sonnet 5. Status: COMPLETE.**

This is the handoff Phase 11 (Release, Hardening, Documentation, and Cold-Start Preparation)
should read before starting. Per-proof detail lives in
[`docs/proofs/PROOF_MATRIX.md`](../proofs/PROOF_MATRIX.md); this document carries the
phase-level narrative, the one shared-architecture change, and everything still deferred.

## Exact proof results

All five proofs pass `npm run qa:proof` (5/5) against real production builds via system Chrome,
in the bounded order the phase required:

1. **A - chase-platformer** (`proofs/chase-platformer/`) - PASS.
2. **B - twin-stick-shooter** (`proofs/twin-stick-shooter/`) - PASS.
3. **C - tower-defense** (`proofs/tower-defense/`) - PASS.
4. **D - sokoban** (`proofs/sokoban/`) - PASS.
5. **E - idle-incremental** (`proofs/idle-incremental/`) - PASS.

Each proof's `PROOF_CONTRACT.md` was frozen before its implementation began (preset id, defining
journey, reusable capabilities expected, game-specific mechanics, content roles used, terminal
success/failure oracle), and each was validated individually (typecheck, content unit tests, real
`vite build`, real-browser proof journey) before the next proof started. No proof required
reopening an earlier one's contract.

## Shared architecture changes

**One repair, made under the phase's own "identify earliest failing check, make one bounded
repair" rule**, surfaced by Proof A and fixed before Proof B began:

- **What broke:** `packages/qa/src/harness.ts`'s `stepFrames(count)` computed
  `let t = performance.now()` fresh inside every call, then advanced it by `16.67ms * count`
  before calling `phaser.loop.step(t)`. For a spec calling `stepFrames` once per interaction with
  one large count - every Phase 8 smoke spec's shape - this is invisible, because only the
  increments *within* that one call matter and those were correct. Proof A's automated journey
  needed a different, legitimate technique: polling the harness one frame at a time
  (`stepFrames(1)` in a loop, checking state after each) to catch the exact frame a coyote-time
  window opened or a jump-buffer press needed to land without hand-computing physics trajectories
  offline. That polling shape exposed the bug - two `stepFrames(1)` calls close together in real
  wall-clock time (a Playwright round-trip is a few milliseconds) each reseeded `t` from a
  `performance.now()` that had barely advanced, so the computed delta was close to that small real
  gap, not the intended fixed 16.67ms. Twenty consecutive `stepFrames(1)` calls advanced the game
  by barely one real frame's worth of simulated time.
- **The fix:** the virtual clock now lives on `window`, seeded once from `performance.now()` on
  first use, then only ever advanced by frame count thereafter - real elapsed wall-clock time
  between calls plays no part in the computed delta. This is a strengthening of Phase 9's "no
  additive real-time + manual stepping" lock, not a second patch alongside it: the residual
  real-time coupling that existed for multi-call sequences is now fully removed, not just reduced.
- **Regression evidence:** `npm run qa:smoke` stayed 14/14 and the generated-runtime matrix
  (`tools/scripts/generated-runtime-matrix.ts`) stayed 40/40 after the fix. Every existing smoke
  spec calls `stepFrames` with one large count per interaction, never several small calls in a
  row, so none were exercising the broken path and none needed any change.
- **Files:** `packages/qa/src/harness.ts` (the fix), `packages/qa/proof-specs/chasePlatformer.ts`
  (`stepUntil`, the polling helper that needed it).

**One proof-local bug, not a shared-architecture issue, worth recording for the pattern:**
Proof A's hazard contact handler originally re-armed the player's invulnerability window on
*every* overlap tick, including a rejected (no-op) `combat.damage()` call during an already-active
invulnerability window - so continuous contact with a hazard could never let invulnerability
expire. Fixed by comparing health before/after the damage call and only re-arming invulnerability
when a hit actually landed. This is the same shape Gate B already fixed once in a different
context; the general lesson (only treat an event as "happened" when the underlying state actually
changed, not when the code path that would have changed it merely ran) generalizes past this one
proof.

No other shared runtime, pack, contract, or schema file changed. No new npm dependency was added.

## Reusable systems exercised by each proof

See the "Reusable capabilities exercised" column in
[`docs/proofs/PROOF_MATRIX.md`](../proofs/PROOF_MATRIX.md) for the full per-proof breakdown. In
aggregate, Phase 10 exercised: `platformController`, `topDownController` (including ADR-0016's
independent digital aim), `gridController`, `sw2d.world`, `sw2d.world-entities` (including the
`Enemy` Tiled class, previously declared in the closed 19-class catalog but never dispatched by
any committed demo or proof before Proof B), `sw2d.combat`, `sw2d.arcade`, `sw2d.progression`,
`sw2d.puzzle` (through its real `configSource: 'code'` seam, closing the one gap
`docs/demos/DEMO_MATRIX.md` flagged by name for `sokoban`), `sw2d.simulation`, the shared
`ProjectilePool`, `SaveStore`, and the engine-level pause/restart flow (`SceneRouter`,
`PauseScene`) - none of it game-specific, all of it already load-bearing before this phase.

## Remaining proof-specific shortcuts

Each proof's own `PROOF_CONTRACT.md` states its bounded design decisions; the ones worth a reader
knowing before extending a proof rather than reading its contract cold:

- **Proof A**: coyote time, jump buffer, and double jump are local constants in
  `shellPack.ts`, not promoted into `platformController` - no second real consumer exists yet to
  justify that promotion (Phase 9's own rule for when a game-specific pattern becomes a shared
  one). Chase pressure has no reusable "pursuit" system; it is a millisecond counter, as documented
  in the preset's own `knownLimitations`.
- **Proof B**: enemies are stationary turret-archetype contact hazards, not a pathfinding/chase
  AI - this preset declares no `sw2d.ai` pack, and building one here would have been exactly the
  speculative shared-capability creation Phase 9 forbids.
- **Proof C**: the route and placement cells are hand-authored code, matching the smoke-validated
  demo's own documented precedent (no "Route"/"Waypoint" class exists in the 19-class catalog).
  `sw2d.world`/`sw2d.world-entities` are required by the preset and installed via
  `content/game.json`, matching that same demo precedent, without this proof forcing an artificial
  consumption of their capabilities where the already-Gate-B-approved demo did not need one either.
- **Proof D**: the board (walls, the single goal cell) is a small hand-authored constant table in
  `packConfig.ts` - per the preset's own documented limitation, `PuzzleConfig`'s functions cannot
  be JSON-authored, so this is TypeScript, not content, and no universal puzzle DSL was introduced.
- **Proof E**: a single upgrade tier, not a tree - this preset's own `knownLimitations` already
  names "large economy balancing" as an explicitly deferred production system. No
  content-authored production-chain schema was added; the Phase 9 lock's trigger for adding one
  (a proof genuinely needing authored content beyond `tuning`/`levels`) did not fire.

## Performance state

**Not measured.** Deterministic frame stepping (the QA harness's `stepFrames`/`stepUntil`)
proves correctness and determinism, never framerate or real-world performance - this was true
before Phase 10 and stays true after the harness clock fix, which if anything makes the
non-claim more precise (the fix removed a residual real-time coupling, but the harness still
never asserts anything about wall-clock performance).

## Known limitations

- Every "remaining proof-specific shortcut" above is a deliberate, bounded decision, not an
  oversight - each is stated in its own `PROOF_CONTRACT.md` and was frozen before implementation.
- The five proof games' `content/`, `themes/`, and `src/game-specific/` trees are the actual
  proof surface; their generated scaffolding (`index.html`, `vite.config.ts`, `tsconfig.json`,
  `package.json`, `src/main.ts`, `src/game.ts`, `src/content.ts`) is committed but untouched from
  what `sw2d new` produced, per the phase's own instructions.
- `proofs/*/dist`, `proofs/*/pack`, and `proofs/*/node_modules` are gitignored, matching the
  existing `demos/*` convention.

## Resource/provenance state

Every proof originated from the real factory generator (`npm run sw2d -- new <id> --preset
<preset-id>`), generating into gitignored `games/<id>/` and then moved unmodified into the
committed `proofs/<id>/` location before any game-specific edit began - the same provenance
pattern `demos/*` already established, verified per-proof by diffing the freshly generated tree
against what got committed before any edits. No proof copied runtime source; all reuse goes
through the published `@sw2d/*` package boundaries the generated `package.json` already declares.

Lifecycle evidence (projectile pool counters, listener/entity counts across restarts) is recorded
per-proof in `docs/proofs/PROOF_MATRIX.md`'s "Lifecycle evidence" column, focused on what each
proof actually allocates - proofs B and C on `ProjectilePool` counters, proof A on
checkpoint/death/restart not duplicating entities, proof D on the absence of parallel state to
leak, proof E on `SaveStore` round-tripping through real storage rather than JS state.

## Deferred repairs/triggers (unchanged from Phase 9, none fired)

- **Spatial pointer / world-space hover-click** - still deferred. Its trigger (a preset promoted
  past `recipe` that cannot be built without world-space hit-testing) did not fire; Proof C's
  tower placement and upgrade both went through the existing keyboard grid cursor.
- **A universal puzzle DSL** - still deliberately not built. ADR-0017's code-config seam
  (`configSource: 'code'`) was sufficient for Proof D exactly as designed.
- **A shared grid-cursor abstraction** - still two consumers (tower-defense's placement cursor,
  the generic grid-shell placeholder), not three; sokoban's grid movement has no cursor concept to
  share. Trigger unchanged from Gate B report section 7.7.
- **Content-role schemas beyond `tuning`/`levels`** (`dialogue`, `characters`, `items`, `puzzles`,
  `recipes`, `microgames`, `exhibits`) - none was needed. Proof E was the one proof at real risk of
  triggering this (an authored production chain), and its economy stayed simple enough to live in
  `src/game-specific/**` without one.
- **`sw2d.projectiles` as a real capability** (rather than `ProjectilePool` staying game-support) -
  still not triggered. Proofs B and C are consumers four and five of the byte-identical interface
  Phase 9 already promoted to `@sw2d/runtime`; nothing about their usage diverged from the pattern
  Phase 9 already settled.

## Next bounded action

**Phase 11 - Sonnet 5 - Release, Hardening, Documentation, and Cold-Start Preparation.**
Not executed as part of this phase.
