# Workbench operational state

**Authority for the Asset-Driven Game Factory Workbench.** `OPERATIONAL_STATE.md` remains authoritative for the inherited SW2D engine/toolchain baseline. This file governs the visual workbench, starter-kit expansion, and their current acceptance evidence.

> Historical per-batch narrative remains preserved in Git history. This revision intentionally compacts the control plane around current authority, verified behavior, active limits, and future proof obligations.

## Current authority

| Item | Current state |
|---|---|
| Existing SW2D core baseline | `f36350bee47d3e85e58be1672854895aab53e51d` |
| Original accepted workbench | `1ebc9a56fbe37527d48b65238fecbd54b0f63951` |
| Post-acceptance repair | merged at `bf8e4de4e6e0f2ee5adf6e8aebc5912f544530b2` |
| Starter-kit scaffold control plane | merged at `d919cf1f71b2023c9839b517198dfd3626341f27` |
| Completed 69-kit expansion | merged to `main` at `0f592415a93c440e37baeb252dd018a144dcd3e2` |
| Starter-kit smart-model sweep repair | `f0106ea94165332d81d97dc0b2288c14cfd012ac`; Actions `33076295154` SUCCESS |
| Full-workbench revalidation code head | `f294d7d688a4c1a8d62efadebde4c251ec878ccc`; Actions `33086331815` SUCCESS |
| Full-workbench repair merge | `e6a53dc541f84b964620fdb0e37e73fda8fdc7b2` |
| Shipped rich kits | **5 proof-derived + 69 expanded = 74 total** |
| Expansion scaffolds | **69 / 69 implemented, registered, and mechanically required by regression test** |
| Current milestone | **Starter expansion complete; smart-model sweep complete; specified full-workbench revalidation debt closed** |

## Current truth

The visual Asset-Driven Game Factory Workbench exists and is the intended root product surface. The 69 additional starter kits are implemented and registered, bringing the shipped rich-kit total to 74 while preserving preset maturity as a separate evidence concept.

The starter-kit smart-model sweep found one confirmed proof-system defect: promoted-state evidence could stay green even if a completed expansion kit were omitted from the shipped registry because focused replay scripts instantiated builders directly and the scaffold test treated registry membership as optional. The repair added a strict 69/69 shipped-registry assertion. Exact repair head `f0106ea94165332d81d97dc0b2288c14cfd012ac` passed the full starter expansion matrix in Actions `33076295154` before the expansion was merged to `main` at `0f592415a93c440e37baeb252dd018a144dcd3e2`.

A subsequent clean-checkout full-workbench revalidation exposed four additional confirmed defects rather than accepting stale historical evidence:

1. **Node 22.12 TypeScript entrypoints.** Several root scripts launched `.ts` files with plain `node`, which fails on the declared minimum Node 22.12. They now use `--experimental-strip-types`, with a regression test covering direct TypeScript command entrypoints.
2. **Clean-checkout workbench QA.** `qa:workbench` assumed `workbench/dist` already existed. It now builds the workbench before browser QA.
3. **Workbench Pack subprocess.** The UI Pack path launched `packages/cli/src/bin.ts` with plain Node and therefore failed on Node 22.12 even after the root script repair. The subprocess now explicitly uses `--experimental-strip-types`.
4. **Ignored batch fixture.** `WB-BATCH-001` relied on `workbench/fixtures/pack/`, but the repository-wide `pack/` ignore rule means those generated PNGs do not exist on a clean checkout. `workbench/qa/prepareBatchFixture.ts` now deterministically materializes 60 ignored test images before workbench QA.

Those repairs were proven together on exact head `f294d7d688a4c1a8d62efadebde4c251ec878ccc` by Actions run `33086331815`, then merged to `main` as `e6a53dc541f84b964620fdb0e37e73fda8fdc7b2`.

## Protected architecture and invariants

These remain controlling constraints:

- `RUNTIME / SYSTEM CODE = reusable machine`.
- `CONTENT / THEME / GAME-SPECIFIC CODE = individual game`.
- Game creation goes through the canonical `@sw2d/cli/factory` `createGame` path; the workbench must not grow a second generator.
- Starter overlays may write only normal game-side surfaces and may not smuggle engine changes into a starter.
- Expanded starter depth and preset maturity remain separate claims. Non-proof expansions use `rich-starter-kit`; only the original proof-derived set uses `rich-proof-kit`.
- Every one of the 69 completed expansion scaffolds must resolve through the actual shipped registry. This is now a regression invariant, not a documentation claim.
- Source assets remain non-destructive; derived assets and recipes carry lineage.
- Validate / Build / Pack remain fixed, bounded product capabilities; browser input may not become arbitrary shell execution.
- The host remains loopback-only with a narrow API, session token, origin/Host checks, bounded bodies, slug validation, filename normalization, and contained paths.
- Unknown provenance must block release packaging until resolved.
- Generated/scratch games must not mutate the tracked root `package-lock.json`.
- Normal installed-repository workflows must not require cloud services, API keys, accounts, or credits.
- Verified behavior may be downgraded only by contradictory current evidence, not by absence of chat memory.

## Fresh full-workbench evidence

**Actions run:** `33086331815`  
**Exact code head:** `f294d7d688a4c1a8d62efadebde4c251ec878ccc`  
**Runner:** Ubuntu 24.04.4, Node 22.12.0, npm 10.9.0, system Chrome 151.0.7922.173  
**Result:** SUCCESS

### Repository baseline

- `npm run validate` — **PASS**.
- Unit/integration tests — **84 test files, 1,918 tests PASS**.
- Starter production build — **PASS**.
- Starter offline-build guard — **PASS**.

### Workbench real-browser acceptance

`npm run qa:workbench` — **16 / 16 PASS**:

- `WB-BOOT-001` — workbench product surface present; four primary actions visible.
- `WB-IMAGE-001` — imported pixels became the rendered game player texture.
- `WB-SEED-001` — Game Seeds offered with honest maturity/coverage information.
- `WB-DERIVE-001` — four recipe steps, derivative lineage, source hash preservation, and real undo/redo cursor verified.
- `WB-REIMPORT-001` — source identity, role, and derivative lineage survived replacement.
- `WB-MULTI-001` — mixed naming tolerated; duplicates detected; frame group remained coherent.
- `WB-SHEET-001` — 4x2 sheet suggestion and frame-to-role assignment worked.
- `WB-SCENE-001` — visual level edits validated and ran.
- `WB-OVERLAP-001` — covered objects remained selectable; hide and cycle selection worked.
- `WB-REOPEN-001` — project state survived reload/reopen.
- `WB-BUILD-001` — Validate / Build / Pack worked from UI; pack produced manifest, checksums, and notices.
- `WB-PROVENANCE-001` — unknown provenance blocked Pack; resolution unblocked it without bypassing the CLI gate.
- `WB-REMIX-001` — existing generated project was adopted and its player art swapped.
- `WB-BATCH-001` — **60 files** staged/imported; peak concurrent uploads **3**, cap **3**.
- `WB-SECURITY-001` — **42 endpoints**, none command/path-shaped; token/origin/slug/filename/body limits enforced.
- `WB-RESPONSIVE-001` — workbench passed desktop, compact, and narrow browser viewports.

Immediately after the UI Validate / Build / Pack journey, `git diff --exit-code -- package-lock.json` passed. The final tracked-source cleanliness gate also passed.

### Inherited regression ladder

- `npm run qa:smoke` — **14 / 14 PASS**.
- `npm run qa:proof` — **5 / 5 PASS**.
- `npm run qa:responsive` — **19 / 19 PASS** at 375x812 portrait and 844x390 landscape using Chromium emulation.
- `npm run release:verify` — **PASS for all controller-shell families**: platform, top-down, vehicle, grid/code-configured puzzle, pointer, and UI-simulation. Release manifests, SHA256 sums, notices, packed browser boot, zero console errors, zero external requests, offline checks, and the deterministic double-pack check all passed where required.
- `npm run qa:matrix` — **74 presets -> 37 runtime signatures -> 40 generated targets; 40 / 40 entered play**.
- Final `package-lock.json` diff — **clean**.
- Final tracked-source status — **clean**.

## Starter-kit expansion evidence

- 69 / 69 expansion scaffolds exist.
- 69 / 69 expansion kits are implemented and registered.
- Original five proof-derived rich kits remain present.
- Total shipped rich-kit count is 74.
- Expansion registry uniqueness, depth honesty, semantic-role use, game-side overlay containment, deterministic overlay output, and scaffold coverage remain test-guarded.
- Exact starter smart-sweep repair `f0106ea94165332d81d97dc0b2288c14cfd012ac` passed Actions `33076295154` after adding the strict registry-membership invariant.
- Detailed P2/P3 candidate and promoted-run chronology remains preserved in prior revisions of this file and Git history; it is no longer duplicated here because the current 69/69 registry invariant plus final green matrices are the governing state.

## Milestone ledger

| Milestone | Deliverable | State |
|---|---|---|
| M0 | research, architecture, operational state, implementation map | COMPLETE |
| M1 | workbench workspace, host, security baseline, home, preset browser, job shell | COMPLETE |
| M2 | asset model, stable ids, hashing, metadata, intake, analysis, provenance, bounded imports | COMPLETE |
| M3 | Asset Lab derivation/recipe/undo/reimport workflow | COMPLETE |
| M4 | role mapping, Game Seeds, theme synthesis, canonical game creation, proof kits | COMPLETE |
| M5 | Scene Composer and preview lifecycle | COMPLETE |
| M6 | reopen / adopt / remix / Validate / Build / Pack / provenance UX | COMPLETE |
| M7 | original full workbench acceptance | ACCEPTED HISTORICALLY AT `1ebc9a56` |
| M7R1 | host boundary + lockfile/offline linking + undo evidence repair | MERGED AT `bf8e4de4`; **FRESHLY REVALIDATED** by `33086331815` |
| M7R2 | Node 22.12 / clean-checkout / Pack subprocess / batch-fixture repairs + permanent full gate | **COMPLETE; merged at `e6a53dc541f84b964620fdb0e37e73fda8fdc7b2`** |
| SK0 | 69-preset expansion control plane | MERGED AT `d919cf1f` |
| SK1+ | implement, promote, smart-sweep, and prove all 69 expanded starters | **COMPLETE; merged at `0f592415...` with sweep repair proven by `33076295154`** |

## Acceptance ledger W01-W28

This table distinguishes fresh proof from protected historical/static evidence instead of laundering one into the other.

| Id | Item | Current evidence state |
|---|---|---|
| W01 | `npm run dev` launches the workbench | **PROTECTED HISTORICAL; command is Node-22.12 regression-guarded, but this exact shell command was not the browser gate launcher** |
| W02 | real project home with four primary actions | **FRESH PASS — WB-BOOT-001** |
| W03 | Import Inbox single / multiple / drag-drop / folder | **HISTORICAL PASS; fresh single/multi/batch import paths exercised, not every native intake modality individually** |
| W04 | stable asset identity across rename/path/reimport | **FRESH PASS — WB-REIMPORT-001** |
| W05 | source preservation | **FRESH PASS — WB-DERIVE-001 / WB-REIMPORT-001** |
| W06 | deterministic, reproducible derivation recipes | **FRESH PASS — WB-DERIVE-001** |
| W07 | Asset Lab crop/mask/component/slice/palette/variant | **PROTECTED HISTORICAL; fresh derivation and sheet paths passed, not every transform individually** |
| W08 | real non-destructive undo / redo | **FRESH PASS — WB-DERIVE-001** |
| W09 | bulk tolerance + duplicate detection | **FRESH PASS — WB-MULTI-001 / WB-BATCH-001** |
| W10 | reimport regenerates derivatives without losing roles | **FRESH PASS — WB-REIMPORT-001** |
| W11 | role changes alter actual game mapping | **FRESH PASS — WB-IMAGE-001 / WB-SHEET-001** |
| W12 | theme synthesis from imported palette/assets | **PROTECTED HISTORICAL; no dedicated fresh end-to-end theme-synthesis journey in this gate** |
| W13 | all 74 presets browsable with honest maturity | **STATIC/HISTORICAL PROTECTION; catalogue/registry tests are fresh, but no exhaustive 74-card UI traversal was performed** |
| W14 | Game Seeds from one image without false claims | **FRESH PASS — WB-SEED-001** |
| W15 | creation uses canonical generator | **FRESHLY REGRESSION-GUARDED; WB-IMAGE/WB-SCENE operate through current workbench project creation** |
| W16 | imported pixels drive rendered game | **FRESH PASS — WB-IMAGE-001** |
| W17 | five rich proof starter kits | **FRESH PASS — qa:proof 5/5; original five unchanged** |
| W18 | Scene Composer edits a real validating level | **FRESH PASS — WB-SCENE-001** |
| W19 | hidden/overlapping objects selectable | **FRESH PASS — WB-OVERLAP-001** |
| W20 | preview is the actual generated Phaser game | **FRESH PASS — WB-IMAGE-001 / WB-SCENE-001** |
| W21 | project state persists across reload/reopen | **FRESH PASS — WB-REOPEN-001** |
| W22 | remix existing generated project | **FRESH PASS — WB-REMIX-001** |
| W23 | Validate / Build / Pack from UI | **FRESH PASS — WB-BUILD-001** |
| W24 | provenance gate authoritative | **FRESH PASS — WB-PROVENANCE-001** |
| W25 | loopback-only host, narrow API | **FRESH PASS — WB-SECURITY-001 plus security tests** |
| W26 | offline normal workflow | **FRESH PASS for an already-installed repository: no external runtime/release requests and lockfile stayed clean. First-time dependency installation was not tested offline.** |
| W27 | inherited SW2D regression ladder green | **FRESH PASS — validate + smoke 14/14 + proof 5/5 + responsive 19/19 + release verify + matrix 40/40** |
| W28 | `npm run qa:workbench` passes | **FRESH PASS — 16/16 on clean Node 22.12 runner** |

The previously explicit revalidation debt for **W08, W23, W25, W26, W27, and W28 is closed** by Actions `33086331815` within the scopes stated above.

## Failure-condition ledger F01-F20

| Id | Failure condition | Current state |
|---|---|---|
| F01 | root product is still the old foundation slice | **NO — fresh WB-BOOT product surface proof** |
| F02 | workbench is only a CLI launcher | **NO — 16/16 interactive workbench journeys** |
| F03 | imported assets do not reach rendered games | **NO — fresh WB-IMAGE proof** |
| F04 | one image cannot reach playable output | **NO — fresh WB-IMAGE proof** |
| F05 | source image is destructively overwritten | **NO — fresh WB-DERIVE source-hash proof** |
| F06 | filename/path is fragile identity | **NO — fresh reimport identity proof** |
| F07 | reimport breaks roles/lineage | **NO — fresh WB-REIMPORT proof** |
| F08 | creation bypasses canonical generator | **NO — current factory boundary and regression tests preserved** |
| F09 | preview is an editor mock | **NO — fresh generated-runtime preview proof** |
| F10 | user must edit JSON for ordinary level refinement | **NO — fresh Scene Composer journey** |
| F11 | covered objects cannot be selected | **NO — fresh WB-OVERLAP proof** |
| F12 | browser can execute arbitrary shell commands | **NO — fresh WB-SECURITY proof; 42 bounded endpoints, none command/path-shaped** |
| F13 | workbench can read/write arbitrary machine paths | **NO — current path-containment/security tests pass** |
| F14 | provenance/release gate bypassable | **NO — fresh WB-PROVENANCE proof** |
| F15 | recipe-only presets presented as equally proven | **NO within tested/static surfaces; seed honesty fresh, depth/maturity registry guards fresh; exhaustive 74-card UI traversal not rerun** |
| F16 | normal installed workflow requires cloud/key/account/credits | **NO for tested normal workflows; first-time package installation is outside this claim** |
| F17 | large import has unbounded concurrency/all-in-memory behavior | **NO — 60-file fresh proof, peak concurrency 3/cap 3** |
| F18 | inherited regression suites removed/weakened/failing | **NO — full fresh ladder green** |
| F19 | normal Validate / Build / Pack requires terminal | **NO — fresh UI button journey** |
| F20 | completion claimed without browser proof | **NO for current workbench acceptance and all promoted starter batches** |

## Remaining known limits / unknowns

These are deliberately **not** converted into bugs or completion claims:

- **Real-device touch is still unverified.** Responsive evidence uses Chromium emulation, not physical phone/tablet hardware.
- **Wall-clock performance is not benchmark-certified.** The batch journey proves bounded concurrency, not a performance SLA.
- **First-time dependency installation is not proven offline.** Offline claims apply after the repository dependencies are already installed.
- **Optional `AssetGenerationProvider` remains an interface only; no provider ships.**
- **Sprite-sheet animation playback is not implemented.** Frame groups are detected/recorded and representative frames are usable.
- **Host-side JPEG/WebP decoding is not implemented.** Browser-side derivation handles those formats.
- **No universal weapon, bullet-hell, procedural-generation, grappling, pathfinding, RTS, vehicle-physics, dialogue, creature-AI, or advanced-physics engine is claimed.** Starter kits intentionally keep bounded genre-specific behavior game-side when a reusable subsystem does not exist.
- Direct TypeScript execution on the declared Node 22.12 minimum uses Node's `--experimental-strip-types` flag. This dependency is explicit and regression-guarded.

## Current validation matrix

```text
Node minimum exercised       22.12.0             PASS
npm run validate                                   PASS
unit/integration tests       84 files / 1918      PASS
npm run qa:workbench         16 / 16              PASS
post-UI package-lock diff                          PASS / clean
npm run qa:smoke             14 / 14              PASS
npm run qa:proof             5 / 5                PASS
npm run qa:responsive        19 / 19              PASS (Chromium emulation)
npm run release:verify       all shell families   PASS
npm run qa:matrix            40 / 40              PASS
final tracked-source status                        PASS / clean
starter expansion registry   69 / 69 expansions   PASS
starter smart-sweep matrix   Actions 33076295154  PASS
full workbench gate          Actions 33086331815  PASS
```

## Next bounded action

There are **no unresolved confirmed defects or outstanding acceptance/revalidation obligations in the software paths covered by the starter smart sweep and full-workbench gate**.

The next substantive action is user-directed product work. Do not rerun or reopen the completed starter expansion or M7R1/M7R2 revalidation merely because a future chat lacks history. Revalidate only when a later change enters an affected impact radius.

Optional evidence still available if specifically wanted: physical-device touch validation and performance benchmarking.

## Revision note — 2026-08-27

Compacted the prior historical narrative after the starter-kit smart-model sweep and full-workbench revalidation were completed. Superseded stale statements that the smart sweep or W08/W23/W25/W26/W27/W28 revalidation were still pending. Preserved remaining honest evidence limits rather than upgrading them by implication.
