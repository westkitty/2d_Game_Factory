# QA Matrix

Every QA command this repository has, what each one actually proves, and - just as important -
what it explicitly does not prove. Written so a reader never has to infer scope from a green
checkmark. `OPERATIONAL_STATE.md`'s Validation matrix links here for the full picture.

## Commands

| Command | What it proves | What it does NOT prove |
|---|---|---|
| `npm run typecheck` | Every package's TypeScript is sound (`tsc --noEmit`). | Runtime correctness. A type-correct program can still be behaviourally wrong. |
| `npm test` | 4100+ unit tests pass (see `npm test` for the live count): pure logic, schema validation, generator determinism, capability/pack composition, resource governance, checksum/notices mechanics, code-dependency provenance completeness, and the workbench's pure layer (image transforms, recipe replay determinism, the dependency-free PNG codec, naming-tolerant grouping, the security boundary, starter-kit overlay containment). | Anything that needs a real browser (canvas rendering, real DOM layout, real input events). |
| `npm run build` | The starter's production build succeeds (two-page Vite build). | That the built game plays correctly - only that bundling succeeded. |
| `npm run check:offline` | The build output contains no external-request construct (fetch/XHR/`<script src="http...">`/etc.) in its static text. | A runtime network call assembled from string concatenation that this static scan can't see - `npm run qa:smoke`'s real-browser `externalRequests()` oracle is the actual runtime proof. |
| `npm run qa:smoke` | 14 targets (12 demo games + 2 starter pages) each boot, enter play with every declared system pack installed, and complete a scripted real-player-shaped interaction - through real system Chrome via `playwright-core`, against a real production build, with zero console errors and zero external requests. | Any preset not one of these 14 (every preset is covered by `npm run qa:proof`'s dedicated proof spec, and by `npm run qa:matrix`). Real wall-clock performance (see "Deterministic frame stepping" below). |
| `npm run qa:proof` | 74 proof games - one per preset - each complete their full frozen `PROOF_CONTRACT.md` journey end-to-end - the same real-Chrome, zero-console-error, zero-external-request oracle as smoke, plus much deeper per-proof assertions, including a genuine scene reinstall (see `docs/proofs/PROOF_MATRIX.md`). Positional ids narrow the run (`npm run qa:proof -- pong breakout`). | Hostile input (that is `qa:adversarial`), real frame pacing (`qa:performance`), the Workbench's starter-kit overlays (`qa:starter-kits`). |
| `npm run qa:adversarial` (`tools/scripts/qa-adversarial.ts`) | Every built proof survives opposing axes held with jump/fire/confirm spam, PAUSE/CONFIRM spam with keys held through pause/resume, off-canvas pointer drags and presses, a mid-play viewport resize, a 2 s single-frame clock jump, and three restarts with fire/move held - with zero console/page errors, zero external requests, exactly one shell debug contribution that still produces, `runIndex` advancing, and an event-bus listener count that does not grow across restarts. | Genre-specific correctness (that is each proof spec). Run after `qa:proof` (it needs the built dists). |
| `npm run qa:performance` (`tools/scripts/qa-performance.ts`) | Eight representative production builds (platformer, top-down combat, bullet-heavy encounter, strategy/navigation, Matter physics, vehicle/racing, UI/simulation, generated room graph) run on the browser's own rAF loop under a genre-typical input pattern for 6 s: mean FPS, p95 / max frame time, frames over 50 ms, and JS heap before/after five restarts are recorded. Hard failure only on gross pathology (mean < 30 fps, heap growth > 50 %). | Anything about a device other than the desktop machine that ran it - the numbers are recorded, not promised, and never imply mobile performance. |
| `npm run qa:matrix` (`tools/scripts/generated-runtime-matrix.ts`) | All 56 distinct runtime signatures across the 74 presets really generate through the canonical factory, install their declared packs, and enter play - one real generation + real boot per target, not just schema validation. | Deep gameplay correctness - only that generation, pack installation, and entering play succeed (that is `qa:proof`). |
| `npm run release:verify` | 6/6 controller-shell families (one representative preset each) fresh-generate → `sw2d validate` (typecheck+tests+build+boot smoke) → `sw2d pack` → `RELEASE_MANIFEST.json` is internally consistent → every `SHA256SUMS` entry matches the actual packed file → resource governance passed → the **packed** directory (not `dist/`) serves correctly through real Chrome → declared packs install → zero console errors/external requests. One candidate is additionally packed twice from identical source and diffed byte-for-byte identical. | Release readiness for every preset - only the 6 representative controller-shell families. The project's software license status (see `docs/release/RELEASE_READINESS.md`). |
| `npm run qa:responsive` | All 19 committed user-facing surfaces (2 starter pages + 12 smoke demos + 5 deep proofs) pass a real-Chromium, coarse-pointer/touch-emulated check at 375x812 portrait and 844x390 landscape: no page overflow, the canvas/primary region fits its box, touch controls are visible/unclipped/≥44x44 (project standard 56x56), switching viewport in-place does not duplicate DOM controls, and zero console errors. | **Real hardware.** This is Chromium's device emulation (`isMobile`/`hasTouch`/`deviceScaleFactor`), not a physical phone or tablet - real-device touch stays an explicit, open unknown (see `OPERATIONAL_STATE.md`). Only the two listed viewports are covered, not every real device size. |

| `npm run qa:workbench` (`workbench/qa/runWorkbenchQa.ts`) | 16 real-browser journeys drive the **workbench itself** through its own visible controls in system Chrome, against committed procedurally-drawn fixtures: the root command opens the product and not the foundation slice; one image becomes a real game whose *rendered texture key carries that image's own sha256*; seeds are offered with honest maturity and coverage; derivation is non-destructive with working undo/redo and an unchanged source hash; reimport keeps the asset id, its role and its derivatives' lineage while replacing the bytes the game loads; bulk import groups three naming conventions together and catches duplicates by content against the whole project; a sprite sheet is sliced and a frame assigned; a real level is edited visually, validates, and runs; a covered scene object is reachable three ways; project state survives a reload; Validate/Build/Pack run from buttons and produce a real release candidate; unknown provenance blocks Pack and resolving it unblocks Pack; a CLI-generated project is adopted and its art swapped; a 60-file pack imports with a measured peak of 3 concurrent uploads against a cap of 3; all 42 endpoints are enumerated and none is command- or path-shaped; three viewports hold together. | Deep gameplay correctness of the games it creates (that is `qa:proof`'s job). Real-device touch - the responsive journey uses Chromium viewport emulation like `qa:responsive`. Any wall-clock or FPS claim: the concurrency figure is a measured cap, not a benchmark. Generated-shell gameplay for every preset (that is `qa:proof`); the 69 expanded starter-kit overlays are `qa:starter-kits`'s job. |

`npm run validate` = `typecheck` + `test` + `workbench:build` + `build` + `check:offline`, in that order. `qa:smoke`,
`qa:proof`, `qa:adversarial`, `qa:performance`, `qa:responsive`, `qa:matrix`, `release:verify`, `qa:starter-kits` and `qa:workbench` are not part of `validate` because each builds
real targets fresh and launches a real browser - proportionate to run on demand (before a commit
that touches shared code, or before a release), not on every `tsc` invocation.

## Deterministic frame stepping is not performance evidence

Every real-browser journey above that steps simulated time (`qa:smoke`, `qa:proof`,
`release:verify`'s boot-smoke check, and `qa:workbench`'s in-iframe game assertions) uses the QA
harness's virtual clock
(`packages/qa/src/harness.ts`'s `stepFrames()`): each call advances Phaser's loop by exactly
16.67ms of *simulated* time, regardless of how long the real `page.evaluate()` round-trip actually
took. This proves the game's logic is **deterministic** - the same input sequence always produces
the same state - which is what every proof/smoke assertion actually checks. (The Category-C
convergence program found the harness had not owned the *first* stepped frames: Phaser's
ten-frame delta smoothing still carried the real rAF deltas from before the loop was stopped,
so the first ~8 stepped frames ran at ~13.4 ms and a `jumpPressed && blocked.down` edge could
land one frame off in one run out of many. `stopRequestAnimationFrameLoop()` now seeds the
delta history, `lastTime` and the virtual clock so frame 1 is exactly 16.67 ms;
`qa:adversarial` asserts it on every proof.)

It proves **nothing** about real-time frame pacing, GPU cost, or FPS under actual wall-clock
timing. The one command that measures real pacing is `npm run qa:performance`, which deliberately
lets the browser drive its own frame loop and reports what it saw on the machine that ran it;
those numbers are recorded, never promised, and are kept separate from this determinism evidence.

## Browser prerequisite

Every browser-driving command above needs a **system-installed Chrome or Chromium** -
`packages/qa/src/browserPath.ts`'s `findSystemChrome()` checks the platform default install path
(overridable via `PLAYWRIGHT_CHROME_PATH`). `playwright-core` (not the full `playwright` package)
is used deliberately: it has no post-install browser download, matching this factory's
prefer-local, no-surprise-network-access resource policy. Without a system Chrome, every
browser-driving command fails fast with a clear message (`npm run sw2d -- doctor` diagnoses this)
- never silently skips and reports success.

## Where each result lives

- Preset maturity claims: `packages/presets/test/honesty.test.ts` mechanically checks that exactly
  the right ids claim `proof-validated`/`smoke-validated` against this matrix's own command
  results - a claim cannot drift from the evidence without a test failing.
- Demo-by-demo detail: `docs/demos/DEMO_MATRIX.md`.
- Proof-by-proof detail: `docs/proofs/PROOF_MATRIX.md`.
- Release-verification detail and current result: `docs/release/RELEASE_READINESS.md`.
- Cold-start recoverability of this whole QA surface: `docs/handoff/COLD_START_AUDIT.md`.
