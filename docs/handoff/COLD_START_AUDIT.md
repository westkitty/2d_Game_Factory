# Cold-Start Audit

Phase 11 §15. Audits this repository using **repository evidence only** - no chat history was
used as proof for any claim below. Every classification is backed by a command actually run or a
file actually read during this audit, not inferred.

Classifications: **RECOVERABLE** (a new agent can reconstruct this fact from the repository alone,
without contradiction), **AMBIGUOUS** (recoverable but requires judgment/cross-referencing),
**MISSING** (no repository evidence exists), **STALE** (evidence exists but is outdated),
**CONTRADICTORY** (two repository sources disagree).

## Method

One repair pass was performed before this final audit, per this document's own instructions
("repair documentation/state once if necessary, then rerun the audit"). Two genuine
contradictions were found and fixed during Phase 11 itself (not merely noted):

1. `OPERATIONAL_STATE.md`'s "Known failures / gaps" claimed "the browser journey is not
   automated," while the same document's own "Validation matrix" said browser journeys were
   automated "for the first time this revision" - a contradiction that had survived several
   revisions unnoticed. **Repaired**: the stale claim is now marked closed with the current
   evidence cited.
2. `docs/resources/THIRD_PARTY_NOTICES.md` claimed "Phaser is the only third-party code in the
   shipped artefact," which was checked against the actual built bundle
   (`grep ajv starter/dist/assets/*.js`) and found false. **Repaired**: `ajv`/`ajv-formats` are
   now listed with full license text, and a standing test
   (`packages/cli/test/notices.test.ts`) guards against recurrence.

The verdicts below reflect the **post-repair** state.

## Per-fact assessment

| Fact | Verdict | Evidence |
|---|---|---|
| **Purpose** | RECOVERABLE | `README.md` line 1-7, `MASTER_PROJECT.md`'s opening section, `OPERATIONAL_STATE.md` line 3 all state the same thing in compatible terms: a reusable 2D browser game production system, not a single game. |
| **Source/repository identity** | RECOVERABLE | `OPERATIONAL_STATE.md` line 4 (`westkitty/2d_Game_Factory`) matches `git remote get-url origin` (`git@github.com:westkitty/2d_Game_Factory.git`) confirmed live during this audit. |
| **Install/bootstrap** | RECOVERABLE | `README.md`'s "Install and run" section (`npm install`) matches a real, just-executed `npm ci` in an isolated snapshot (`docs/release/CLEAN_BUILD_REPRODUCIBILITY.md`) - not merely documented, actually re-verified. |
| **Build** | RECOVERABLE | `npm run build` documented in `README.md` and `package.json`'s `scripts`; re-run live during this phase, both in the primary worktree and in the isolated clean-build snapshot - both succeeded. |
| **CLI game-generation path** | RECOVERABLE | `docs/cli/CLI_REFERENCE.md` plus `README.md`'s "The factory CLI" section document all 9 commands; `sw2d new`/`validate`/`pack` were all re-run live during this phase against real presets with real output, not merely read from docs. |
| **Validation** | RECOVERABLE | `npm run validate` documented and re-run live (typecheck + 1781 unit tests + build + offline guard, all passing) in both the primary worktree and the isolated clean-build snapshot. |
| **Smoke/proof QA** | RECOVERABLE | `docs/demos/DEMO_MATRIX.md` and `docs/proofs/PROOF_MATRIX.md` document exactly what `qa:smoke` (14/14) and `qa:proof` (5/5) prove; both were re-run live during this phase with matching results. `docs/qa/QA_MATRIX.md` (new this phase) now also covers `qa:responsive` and `release:verify`. |
| **Release packaging** | RECOVERABLE (new this phase - was previously **AMBIGUOUS AT BEST**) | Before Phase 11, `sw2d pack` existed but produced only a bare `dist/` copy with no manifest, no checksums, no resource governance, and no documentation describing release verification. A cold-start reader had no way to confirm a "release" was anything more than an unverified file copy. Phase 11 closed this: `release/README.md`, `docs/release/RELEASE_READINESS.md`, and a real 6/6 `release:verify` matrix now exist and were re-run live. |
| **Architecture boundaries** | RECOVERABLE | `OPERATIONAL_STATE.md`'s "Protected invariants" (23 numbered items) plus `docs/architecture/adr/` (17 ADRs) plus `docs/architecture/ARCHITECTURE_OVERVIEW.md` are internally consistent and were cross-checked against real source layout (`packages/contracts` has zero runtime dependencies, confirmed via `package.json` inspection - invariant 4 holds). |
| **Current state** | RECOVERABLE (was **CONTRADICTORY** before this phase's repair - see Method above) | `OPERATIONAL_STATE.md`'s "Current phase", "Validation matrix", "Known failures/gaps", and "Unknown" sections were cross-read for internal consistency as part of this audit; the two contradictions found are listed under Method and are now fixed. |
| **Known limitations** | RECOVERABLE | `OPERATIONAL_STATE.md`'s "Unknown" and "Implemented but unverified" sections list every currently-open item with a stated trigger for closing it, cross-referenced against `README.md`'s "Known high-level limitations" summary (new this phase) - both agree. |
| **Next action** | RECOVERABLE | `OPERATIONAL_STATE.md`'s "Next bounded action" section names Phase 12 / Opus 5 explicitly, matches `docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`'s stated handoff, matches `MASTER_PROJECT.md`'s phase ownership table. |

## Target verdict

**RECOVERABLE.**

Every fact this audit was asked to assess is recoverable from repository evidence alone, with the
two pre-existing contradictions found and repaired during this same phase (not deferred to a
future audit). No fact in this table is currently MISSING or AMBIGUOUS.

## Legitimate external prerequisites (documented, not hidden)

Per this document's own instruction to name real prerequisites rather than pretend they don't
exist:

- **npm registry/cache** is a development bootstrap dependency for `npm ci`. Not required at
  runtime by any generated game.
- **System Chrome/Chromium** is required for every real-browser QA command. Absence is detected
  and reported clearly (`sw2d doctor`, and every browser-driving command's own error message) -
  never a silent skip reported as success.
- **Tiled** remains optional, documented as such everywhere it's mentioned.
- No credentials or secrets are required anywhere in this repository.

## What this audit deliberately did not do

Reopen or re-litigate genuinely open unknowns (real-device touch, gamepad, real performance,
spatial pointer, the software license) - those are correctly classified as open elsewhere
(`OPERATIONAL_STATE.md`'s "Unknown" section) and remain open; this audit's job was to confirm they
are *findable and correctly labeled*, not to close them.
