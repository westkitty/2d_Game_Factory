# Workbench operational state

**Authority for the corrective project only.** The original 12-phase master project remains
complete and accepted; `OPERATIONAL_STATE.md` stays the authority for the engine/toolchain
baseline. This file governs the Asset-Driven Game Factory Workbench built on top of it.

| | |
|---|---|
| Existing SW2D core | verified completed baseline `f36350bee47d3e85e58be1672854895aab53e51d` (`HEAD == origin/main`, clean tree at branch point) |
| Corrective project | Asset-Driven Game Factory Workbench |
| Primary product-shape failure | the visual, asset-driven workbench was missing: `npm run dev` opened the Phase 1 foundation slice, not a factory |
| Accepted workbench commit on `main` | `1ebc9a56fbe37527d48b65238fecbd54b0f63951` |
| Active repair branch | `repair/workbench-acceptance-gaps` |
| Current milestone | **post-acceptance repair implemented; revalidation required before merge** |

## Post-acceptance correction — 2026-08-26

A read-only audit of the accepted workbench found three gaps that make the original
"W01-W28 all PASS" claim too strong as written:

1. `assertAcceptableOrigin()` returned early for safe requests with no `Origin`, so a
   non-loopback `Host` was not checked on that path. The repair branch validates Host first
   on every request and adds a regression test for hostile/missing Host on GET/HEAD.
2. Workbench project creation / Validate / Build / Pack linked new `games/*` workspaces by
   running root `npm install`; the final accepted commit itself had to remove QA scratch-game
   entries that leaked into `package-lock.json`. The repair branch makes the canonical CLI
   workspace linker `--offline --no-package-lock --no-audit --no-fund`, exports it through
   `@sw2d/cli/factory`, and makes the workbench reuse that one helper.
3. `WB-DERIVE-001` contained `expect(sizeAfterUndo !== sizeAfterFour || true, ...)`, so that
   browser assertion could never fail. The repair branch now asserts the actual recipe cursor:
   Undo must create exactly one `.hist-row--future`, and Redo must clear it.

**Evidence state:** the fixes are implemented and statically inspected on
`repair/workbench-acceptance-gaps`, but not yet runtime-verified. The current ChatGPT execution
environment cannot resolve `github.com`, and this repository has no CI run attached to the repair
branch. Therefore the original acceptance ledger below is historical evidence from the pre-repair
commit, not fresh proof of the repair.

**Affected acceptance items requiring revalidation:** W08, W23, W25, W26, W27 and W28.
All unrelated accepted behavior remains the protected baseline unless the revalidation ladder finds
a regression.

Required merge gate:

```text
npm run validate
npm run qa:workbench
npm run qa:smoke
npm run qa:proof
npm run qa:responsive
npm run release:verify
npm run qa:matrix

plus: confirm git diff -- package-lock.json is empty after creating a scratch game and running
Validate, Build and Pack from the workbench.
```

Do not merge the repair branch or restore a blanket "all PASS" claim until those checks are green.

---

## Milestone ledger

| Milestone | Deliverable | State |
|---|---|---|
| M0 | research, architecture, operational state, implementation map | COMPLETE |
| M1 | workbench workspace, local host, security baseline, home, recent projects, preset browser, root dev route, `starter:dev`, job shell | COMPLETE |
| M2 | asset model, source storage, stable ids, hashing, metadata, bulk + folder intake, analysis, palette, duplicates, provenance, import transaction, lazy thumbnails, memory limits | COMPLETE |
| M3 | Asset Lab: recipe stack, undo/redo, crop/trim, scale/flip/rotate, masking, components, slicing, variants, replay, reimport | COMPLETE |
| M4 | synthesis: role mapper, Game Seeds, 74-preset browser, recommendations, theme synthesis, fallback art, canonical game creation, five proof starter kits, **imported pixels proven in a running generated game** | COMPLETE |
| M5 | Scene Composer + preview lifecycle | COMPLETE |
| M6 | reopen / adopt / remix / Validate / Build / Pack / provenance UX / reveal | COMPLETE |
| M7 | `qa:workbench`, responsive, security QA, full regression, docs, final acceptance | **ACCEPTED AT `1ebc9a56`; PARTIALLY EVIDENCE-STALE AFTER AUDIT** |
| M7R1 | host boundary + lockfile/offline linking + undo evidence repair | **IMPLEMENTED, UNVERIFIED** |

---

## Acceptance ledger W01-W28

Full original evidence lives in [`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).
The rows below record the accepted state at `1ebc9a56`; the post-acceptance correction above
supersedes the evidence state for W08, W23, W25, W26, W27 and W28 until repair validation runs.

| Id | Item | State |
|---|---|---|
| W01 | `npm run dev` launches the workbench | **PASS** |
| W02 | real project home with the four primary actions | **PASS** |
| W03 | Import Inbox: single / multiple / drag-drop / folder | **PASS** |
| W04 | stable asset identity across rename / path change / reimport | **PASS** |
| W05 | source preservation | **PASS** |
| W06 | deterministic, reproducible derivation recipes | **PASS** |
| W07 | Asset Lab crop / mask / component / slice / palette / variant | **PASS** |
| W08 | real non-destructive undo / redo | **REVALIDATION REQUIRED** |
| W09 | bulk tolerance + duplicate detection | **PASS** |
| W10 | reimport regenerates derivatives without losing roles | **PASS** |
| W11 | role changes alter the actual game mapping | **PASS** |
| W12 | theme synthesis from imported palette/assets | **PASS** |
| W13 | all 74 presets browsable with honest maturity | **PASS** |
| W14 | Game Seeds from one image, no false claims | **PASS** |
| W15 | creation goes through the canonical generator | **PASS** |
| W16 | **real browser proof: imported pixels drive the rendered game** | **PASS** |
| W17 | five rich proof starter kits | **PASS** |
| W18 | Scene Composer edits a real level that validates | **PASS** |
| W19 | hidden / overlapping objects selectable | **PASS** |
| W20 | preview is the actual generated Phaser game | **PASS** |
| W21 | project state persists across reload / reopen | **PASS** |
| W22 | remix: replace an asset in an existing generated project | **PASS** |
| W23 | Validate / Build / Pack from UI buttons | **REVALIDATION REQUIRED** |
| W24 | provenance gate remains authoritative | **PASS** |
| W25 | loopback-only host, narrow API | **REVALIDATION REQUIRED** |
| W26 | offline normal workflow | **REVALIDATION REQUIRED** |
| W27 | inherited SW2D regression ladder green | **REVALIDATION REQUIRED** |
| W28 | `npm run qa:workbench` passes | **REVALIDATION REQUIRED** |

---

## Failure-condition ledger F01-F20

All must be `NO` before merge.

| Id | Failure condition | State |
|---|---|---|
| F01 | `npm run dev` still opens SW2D FOUNDATION | **NO** |
| F02 | workbench is a CLI launcher with no asset workflow | **NO** |
| F03 | import stores files but games still render placeholders | **NO** |
| F04 | one image cannot reach playable output | **NO** |
| F05 | source image destructively overwritten | **NO** |
| F06 | filenames / paths are fragile identity | **NO** |
| F07 | reimport breaks roles or derivative lineage | **NO** |
| F08 | creation bypasses the canonical generator | **NO** |
| F09 | preview is an editor mock | **NO** |
| F10 | user must edit JSON for normal level refinement | **NO** |
| F11 | a foreground object makes covered objects unselectable | **NO** |
| F12 | browser can execute arbitrary shell commands | **NO** |
| F13 | workbench can read/write arbitrary machine paths | **NO** |
| F14 | provenance / release gate bypassable | **NO** |
| F15 | recipe-only presets presented as equally proven | **NO** |
| F16 | required workflow needs cloud / key / account / credits | **REVALIDATION REQUIRED** |
| F17 | large import has unbounded concurrency or all-in-memory behaviour | **NO** |
| F18 | inherited regression suites removed, weakened or failing | **REVALIDATION REQUIRED** |
| F19 | normal Validate / Build / Pack still requires the terminal | **NO** |
| F20 | completion claimed without a real browser proof | **NO** |

---

## Verified workbench behaviour at accepted commit `1ebc9a56`

Everything below was reported as executed for the accepted commit. Full evidence per item is in
[`docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md`](docs/architecture/WORKBENCH_FINAL_ACCEPTANCE.md).
Items in the affected revalidation set above must not be treated as fresh evidence for the repair
branch.

- `npm run dev` launches the workbench; `npm run starter:dev` still serves the
  Phase 1 slice.
- One image → imported → mapped to `player` → chase-platformer generated
  through the canonical factory → production build → **the running Phaser game
  draws a 96px texture whose key carries the fixture's own sha256**. The
  fixture, the asset record, the shipped file and the untouched source all hash
  identically.
- All five proof-validated presets have rich starter kits, each verified in a
  real browser to boot, install every declared pack, and respond to input, with
  zero console errors and zero external requests.
- Import staging, tolerant frame grouping across three naming conventions,
  content-hash duplicate detection against the whole project, sprite-sheet
  slicing, connected-component split, non-destructive derivation with recipe
  replay, and reimport preserving id / role / lineage while replacing the bytes
  the game loads.
- Scene Composer editing a real level that validates through the real pipeline,
  with covered objects reachable by list, by overlap-cycling and by hide/lock.
- Validate / Build / Pack from buttons, producing a real release candidate;
  unknown provenance blocks Pack and resolving it unblocks Pack.
- Loopback-only host with 42 narrow endpoints, none command- or path-shaped.
- A 60-file import with a measured peak of 3 concurrent uploads against a cap
  of 3.
- Three viewports with no horizontal overflow and all primary controls
  reachable.

## Implemented but unverified

- **M7R1 acceptance repair.** The repair branch contains the three fixes listed
  in the post-acceptance correction section. Static inspection is complete;
  runtime and regression validation are pending.
- **Real-device touch.** The responsive journey uses Chromium viewport
  emulation, as the inherited suites do. No claim is made about a physical
  device.
- **Wall-clock performance.** The concurrency evidence is a measured cap, not a
  benchmark. All game QA uses deterministic frame stepping, so no FPS or timing
  claim is made anywhere.
- **The optional `AssetGenerationProvider` interface.** The shape exists and the
  project model accommodates it; no provider ships and none has been exercised.

## Deliberately not implemented

- **Sprite-sheet animation playback.** Frame groups are detected and recorded;
  the runtime draws one representative frame per role, with procedural motion
  supplying the life. Building a universal animation system would have
  destabilised the core for a benefit the asset-to-game workflow does not need.
- **Host-side JPEG/WebP decoding.** Their bytes are stored verbatim and
  derivation happens in the browser, which already has decoders. Adding an
  image-codec dependency was judged the worse trade.
- **Rich starter kits for the other 69 presets.** They get the canonical
  generated shell, and every surface says so.

## Known blockers

- **Repair validation cannot run in the current ChatGPT execution runtime:**
  outbound DNS cannot resolve `github.com`, so the branch cannot be cloned into
  the available container. No GitHub Actions workflow/CI result exists for the
  repair branch. Validation must run in the project environment with system
  Chrome before merge.

---

## Inherited regression baseline (must stay green)

```text
npm run validate        PASS
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  6/6
npm run qa:matrix       40/40
unit tests              1787/1787 at the inherited baseline
```

New workbench tests raise the unit-test count. No existing test was deleted or weakened.

**Last executed final state before M7R1 repair:**

```text
npm run validate        PASS
npm run test            1900/1900   (1787 inherited + 113 workbench)
npm run qa:smoke        14/14
npm run qa:proof        5/5
npm run qa:responsive   19/19
npm run release:verify  PASS, all controller-shell families
npm run qa:matrix       40/40
npm run qa:workbench    16/16
```

Those counts are historical until M7R1 is revalidated; the added workspace-policy test will also
change the unit-test total.
