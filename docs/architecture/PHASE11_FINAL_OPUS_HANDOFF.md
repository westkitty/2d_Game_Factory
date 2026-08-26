# Phase 11 Final Handoff to Phase 12 (Opus 5)

Evidence packet for Phase 12 - Final Cross-System Acceptance and Cold-Start Gate. Phase 11 did not
perform Phase 12's architectural judgment; this document hands over evidence, not a verdict.

## Phase 11 source baseline

- Repository: `westkitty/2d_Game_Factory`, branch `main`.
- Phase 10 baseline commit this phase started from: `513f58cb54452098255bcaada79ba31fb55ba975`.
- Phase 11's own commit(s) are on top of that baseline (see git log for the exact SHA at
  publication time - this document is not the place to hardcode a commit that will immediately go
  stale on the next push).

## Release-packer behaviour

`sw2d pack <game-id>` (`packages/cli/src/commands/pack.ts`), hardened not replaced:

1. Resource-governance gate runs first, before any build: refuses to pack if
   `resources/RESOURCE_MANIFEST.json` is missing, schema-invalid (per
   `@sw2d/schemas`' `validateResourceManifest` against `resource-policy.json`), or contains any
   record whose `status` is not `'approved'`.
2. Real `vite build`, clean-copied into `pack/` (unchanged behavior - dist/ never contains
   source/tests/node_modules by construction).
3. Offline guard (unchanged, existing).
4. Writes `RELEASE_MANIFEST.json` (deterministic: `formatVersion`, `gameId`, `presetId`,
   `factoryVersion`, `packagingMode`, sorted `fileInventory`, `projectLicenseStatus`,
   `resourceGovernance` summary - no timestamps, no random ids, no absolute paths).
5. Writes `THIRD_PARTY_NOTICES.txt`, mechanically derived
   (`packages/cli/src/releasePackaging/notices.ts`'s `resolveShippedDependencies()`) by walking
   the real `@sw2d/*` workspace → npm dependency graph from the generated game's own
   `package.json`, not a hand-maintained list.
6. Writes `SHA256SUMS` last (sorted POSIX-relative paths, so it never needs a checksum for
   itself).

Per-game resource provenance (new): `resources/RESOURCE_MANIFEST.json`, generated at `sw2d new`
time (`generateResourceManifest()` in `packages/cli/src/generator/contentDocuments.ts`) - one
record per theme role, honestly `sourceKind: 'project-owned'`, `modificationStatus: 'generated'`,
`status: 'approved'`, since no third-party asset exists in this factory yet.

## Release verification matrix

`npm run release:verify` (`tools/scripts/release-verify.ts`). **Result: 6/6 PASS** as of this
phase's last run. One representative fresh-generated game per controller-shell family:

| Family | Preset | Result |
|---|---|---|
| platform | `traditional-platformer` | PASS (+ byte-identical double-pack proof) |
| top-down | `top-down-adventure` | PASS |
| vehicle | `asteroids-shooter` | PASS |
| grid (code-configured puzzle path) | `sokoban` | PASS |
| pointer | `gallery-shooter` | PASS |
| ui-simulation | `idle-incremental` | PASS |

Each covers: generate → `sw2d validate` (typecheck+tests+build+boot smoke) → `sw2d pack` → verify
`RELEASE_MANIFEST.json` internal consistency → verify every `SHA256SUMS` entry against the actual
file on disk → verify resource-governance state → serve the **packed** directory (not `dist/`)
through real system Chrome → enter play → verify every declared system pack installed → assert
zero console errors → assert zero external requests → clean up. The `traditional-platformer`
candidate was additionally packed a second time from identical source and diffed byte-for-byte
identical against the first pack.

## Checksum mechanism

`packages/cli/src/releasePackaging/checksums.ts` - Node `node:crypto` SHA-256, no new dependency.
Sorted POSIX-relative paths regardless of host OS. Independently verified against the standard
system `shasum -a 256 -c` tool (not only this repository's own verifier) in
`docs/release/CLEAN_BUILD_REPRODUCIBILITY.md` - all files `OK`. Tamper detection unit-tested
(`packages/cli/test/checksums.test.ts`) and exercised live (a manually corrupted file was
confirmed to fail verification during this phase's manual testing, before the automated test
suite existed).

## Resource/notices state

- `docs/resources/CODE_RESOURCE_MANIFEST.json` and `docs/resources/THIRD_PARTY_NOTICES.md`
  corrected: both had claimed Phaser was the only shipped third-party dependency; `ajv` and
  `ajv-formats` (shipped via `@sw2d/schemas`, a `dependencies` entry of every generated game) were
  missing. Confirmed against the actual built bundle (`grep ajv starter/dist/assets/*.js`).
  Standing regression guard: `packages/cli/test/notices.test.ts`.
- `resource-policy.json` unchanged - still the live authority for acceptable licenses and
  provenance rules; Phase 11 enforced it mechanically at `pack` time rather than only in prose.

## Responsive/mobile matrix

`npm run qa:responsive` (`tools/scripts/qa-responsive.ts`). **Result: 19/19 PASS** as of this
phase's last run, at 375x812 portrait and 844x390 landscape (Chromium touch/coarse-pointer
emulation - explicitly not real hardware). Found and fixed one real, previously-undetected shared
defect on the first run (0/19); see `OPERATIONAL_STATE.md` Revision 13 and `PROJECT_BIBLE.md`'s
Phase 11 entry for full root-cause detail (a non-definite flex container height plus a
`Phaser.Scale.FIT` boot-time measurement race).

## Clean-build reproducibility verdict

**REPRODUCIBLE.** Full detail: `docs/release/CLEAN_BUILD_REPRODUCIBILITY.md`. An isolated,
`git checkout-index`-derived snapshot installs (`npm ci`), passes `sw2d doctor` and
`npm run validate`, generates a new game through the documented CLI, validates it, packs it,
verifies its checksums with the standard system tool, and passes a real-Chrome boot check on the
packed artifact - all with zero dependency on primary-worktree state. Tested on Node v26.7.0 (only
version available on the build host); exact Node 24.x execution is an explicit, separately-tracked
unverified compatibility item, not silently assumed.

This proof caught a real bug during this phase's own work: a source directory named
`packages/cli/src/release/` collided with `.gitignore`'s bare `release/` pattern and was never
being staged. Fixed (renamed to `releasePackaging/`, narrowed the gitignore pattern to
`release/out/`) - see `PROJECT_BIBLE.md`'s Phase 11 entry for the full account.

## Cold-start audit verdict

**RECOVERABLE.** Full detail: `docs/handoff/COLD_START_AUDIT.md`. One repair pass was performed
during this same phase (not deferred): two genuine contradictions in `OPERATIONAL_STATE.md` and
`docs/resources/THIRD_PARTY_NOTICES.md` were found and fixed before the final audit was written.

## Current maturity split

**5 `proof-validated` / 7 `smoke-validated` / 62 `recipe` / 0 `experimental`** - unchanged from the
Phase 10 baseline, exactly as required. Mechanically enforced by
`packages/presets/test/honesty.test.ts`.

## Full QA command matrix

See `docs/qa/QA_MATRIX.md` for the complete table (what each command proves, what it does not).
Summary of this phase's final regression run:

| Command | Result |
|---|---|
| `npm run validate` (typecheck + test + build + offline guard) | PASS |
| `npm run qa:smoke` | 14/14 |
| `npm run qa:proof` | 5/5 |
| `npm run qa:responsive` (new) | 19/19 |
| `npm run release:verify` (new) | 6/6 |
| `tools/scripts/generated-runtime-matrix.ts` | 40/40 |
| Unit tests (`npm test`) | 1781/1781 |

## Remaining known limitations/unknowns

Unchanged by this phase, all still explicit in `OPERATIONAL_STATE.md`'s "Unknown" section: real
wall-clock performance/FPS, real-device touch, gamepad feasibility, spatial pointer, a universal
puzzle DSL, a shared grid-cursor abstraction, the project's software license.

## Software license status

`UNLICENSED`. Explicit, unresolved user decision. Not chosen, not guessed at, not silently
resolved by this phase. See `docs/release/RELEASE_READINESS.md`'s explicit separation of
"technically release-ready" from "cleared for public distribution."

## Performance status

Unmeasured, and explicitly not claimed anywhere. Every automated browser journey in this
repository uses the QA harness's deterministic fixed-step clock - that is determinism evidence,
never a performance claim. No FPS number appears anywhere in this repository's QA output.

## Architecture changes Phase 11 made

One, small and load-bearing: `packages/runtime/src/core/createGame.ts` gained a single
`requestAnimationFrame(() => game.scale.refresh())` call after game construction, to correct a
real boot-time mis-measurement race in `Phaser.Scale.FIT` (see "Responsive/mobile matrix" above
and `PROJECT_BIBLE.md`'s Phase 11 entry for full detail). No protected invariant was touched or
reinterpreted; this is a bug fix in shared runtime code, verified against the full regression
ladder (1781 unit tests, `qa:smoke` 14/14, `qa:proof` 5/5, generated-runtime matrix 40/40 - all
green both before and after).

No new package, no new capability id, no new controller family, no schema change.

## Sonnet escalation packet

None. No decisive failure remained unresolved at the end of a bounded repair pass; no architectural
judgment was deferred to Phase 12 beyond its own, already-scoped mandate (final cross-system
acceptance and the cold-start gate itself).
