# QA Matrix

Every QA command this repository has, what each one actually proves, and - just as important -
what it explicitly does not prove. Written so a reader never has to infer scope from a green
checkmark. `OPERATIONAL_STATE.md`'s Validation matrix links here for the full picture.

## Commands

| Command | What it proves | What it does NOT prove |
|---|---|---|
| `npm run typecheck` | Every package's TypeScript is sound (`tsc --noEmit`). | Runtime correctness. A type-correct program can still be behaviourally wrong. |
| `npm test` | 1781 unit tests pass: pure logic, schema validation, generator determinism, capability/pack composition, resource governance, checksum/notices mechanics. | Anything that needs a real browser (canvas rendering, real DOM layout, real input events). |
| `npm run build` | The starter's production build succeeds (two-page Vite build). | That the built game plays correctly - only that bundling succeeded. |
| `npm run check:offline` | The build output contains no external-request construct (fetch/XHR/`<script src="http...">`/etc.) in its static text. | A runtime network call assembled from string concatenation that this static scan can't see - `npm run qa:smoke`'s real-browser `externalRequests()` oracle is the actual runtime proof. |
| `npm run qa:smoke` | 14 targets (12 demo games + 2 starter pages) each boot, enter play with every declared system pack installed, and complete a scripted real-player-shaped interaction - through real system Chrome via `playwright-core`, against a real production build, with zero console errors and zero external requests. | Any preset not one of these 14 (the other 60 stay `recipe`/`smoke-validated`-by-family-equivalence only via `tools/scripts/generated-runtime-matrix.ts`, not by a hand-written spec). Real wall-clock performance (see "Deterministic frame stepping" below). |
| `npm run qa:proof` | 5 deep proof games (the tier above smoke) each complete their full frozen `PROOF_CONTRACT.md` journey end-to-end - the same real-Chrome, zero-console-error, zero-external-request oracle as smoke, plus much deeper per-proof assertions (see `docs/proofs/PROOF_MATRIX.md`). | Anything about the other 69 presets. |
| `tools/scripts/generated-runtime-matrix.ts` | All 40 presets not already covered by a demo/proof really generate, install their declared packs, and enter play - one real generation + real boot per preset, not just schema validation. Combined with the 12 demos + 5 proofs (both separately real-generated too), this is real generate-and-boot evidence for every one of the 74 presets whose `maturity` claims anything beyond `recipe`... and for every `recipe` preset too, since this script covers all 74 by construction. | Deep gameplay correctness for the 40 it covers - only that generation, pack installation, and entering play succeed. |
| `npm run release:verify` | 6/6 controller-shell families (one representative preset each) fresh-generate → `sw2d validate` (typecheck+tests+build+boot smoke) → `sw2d pack` → `RELEASE_MANIFEST.json` is internally consistent → every `SHA256SUMS` entry matches the actual packed file → resource governance passed → the **packed** directory (not `dist/`) serves correctly through real Chrome → declared packs install → zero console errors/external requests. One candidate is additionally packed twice from identical source and diffed byte-for-byte identical. | Release readiness for every preset - only the 6 representative controller-shell families. The project's software license status (see `docs/release/RELEASE_READINESS.md`). |
| `npm run qa:responsive` | All 19 committed user-facing surfaces (2 starter pages + 12 smoke demos + 5 deep proofs) pass a real-Chromium, coarse-pointer/touch-emulated check at 375x812 portrait and 844x390 landscape: no page overflow, the canvas/primary region fits its box, touch controls are visible/unclipped/≥44x44 (project standard 56x56), switching viewport in-place does not duplicate DOM controls, and zero console errors. | **Real hardware.** This is Chromium's device emulation (`isMobile`/`hasTouch`/`deviceScaleFactor`), not a physical phone or tablet - real-device touch stays an explicit, open unknown (see `OPERATIONAL_STATE.md`). Only the two listed viewports are covered, not every real device size. |

`npm run validate` = `typecheck` + `test` + `build` + `check:offline`, in that order. `qa:smoke`,
`qa:proof`, `qa:responsive` and `release:verify` are not part of `validate` because each builds
real targets fresh and launches a real browser - proportionate to run on demand (before a commit
that touches shared code, or before a release), not on every `tsc` invocation.

## Deterministic frame stepping is not performance evidence

Every real-browser journey above that steps simulated time (`qa:smoke`, `qa:proof`,
`release:verify`'s boot-smoke check) uses the QA harness's virtual clock
(`packages/qa/src/harness.ts`'s `stepFrames()`): each call advances Phaser's loop by exactly
16.67ms of *simulated* time, regardless of how long the real `page.evaluate()` round-trip actually
took. This proves the game's logic is **deterministic** - the same input sequence always produces
the same state - which is what every proof/smoke assertion actually checks.

It proves **nothing** about real-time frame pacing, GPU cost, or FPS under actual wall-clock
timing. No command in this repository measures or claims real performance. If a future phase adds
one, it must say so explicitly and separately from this determinism evidence - never blend the two.

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
