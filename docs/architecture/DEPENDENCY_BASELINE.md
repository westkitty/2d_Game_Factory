# Dependency Baseline

Recorded: 2026-08-24 (Phase 1, Opus 5). Versions were verified against the npm registry at
that date, not copied from historical examples.

Re-verify before any upgrade. `MASTER_PROJECT.md` §20 governs what may be added.

## Environment

| Item | Value | Notes |
|---|---|---|
| Platform | macOS, Apple Silicon (arm64) | development host |
| Node (dev host) | v26.7.0 | current release line, not LTS |
| Node (supported baseline) | >= 22.12.0, **target 24.x LTS** | `engines` in root `package.json`; `.nvmrc` pins `24` |
| npm | 11.19.0 | bundled with Node 26.7.0 |
| Package manager | npm workspaces | no pnpm/yarn; repository was empty, nothing to preserve |

Node 24.19.0 ("Krypton") is the active LTS as of this date. The development host runs 26.7.0,
which satisfies every dependency's engine range; CI and contributors should prefer 24.x.

## Direct dependencies

| Package | Version | License | Source | Purpose |
|---|---|---|---|---|
| `phaser` | 4.2.1 | MIT | https://www.npmjs.com/package/phaser | Game runtime: scene manager, arcade physics, WebGL/Canvas renderer, texture cache. |
| `typescript` | 7.0.2 | Apache-2.0 | https://www.npmjs.com/package/typescript | Static checking for every package. `--noEmit`; Vite/esbuild does the transpiling. |
| `vite` | 8.2.2 | MIT | https://www.npmjs.com/package/vite | Dev server and production bundler for the browser target. |
| `vitest` | 4.1.11 | MIT | https://www.npmjs.com/package/vitest | Unit test runner. Shares Vite's transform, so no second build config. |

All four are dev/build-time or bundled; the shipped artefact contains only Phaser plus project
code. None require an account, a registry beyond npm, or network access at runtime.

### Added in Phase 2 (2026-08-25, Sonnet 5)

| Package | Version | License | Source | Purpose |
|---|---|---|---|---|
| `ajv` | 8.20.0 | MIT | https://www.npmjs.com/package/ajv | JSON Schema validator backing `@sw2d/schemas`. Pinned to the exact version recorded as deferred in Phase 1. |
| `ajv-formats` | 3.0.1 | MIT | https://www.npmjs.com/package/ajv-formats | Registers Ajv's standard format keywords. No current schema declares a `format` yet - registered for the schemas Phase 6+ will add (dates, URLs) rather than an immediate need. |

Both are direct dependencies of `@sw2d/schemas` only. `npm install` reported 8 packages added, 0
vulnerabilities, no postinstall network activity. `@sw2d/starter` also depends on `@sw2d/schemas`
(it validates `content/game.json` and `content/tuning.json` at load), so Ajv is now bundled into
the production build. Measured effect: 1.4 MB -> 1.538 MB minified (366 kB -> 407 kB gzip). Still
a single self-contained static bundle; no new runtime network surface.

### Install-script and telemetry check

`npm install` reported 51 packages added, 0 vulnerabilities. No selected direct dependency runs
a postinstall script that contacts a network service, and none enables telemetry by default.
Vite's optional analytics is not configured and no `.env` opts into it.

### Compatibility assumptions

- Vite 8.2.2 `engines`: `^20.19.0 || >=22.12.0` - satisfied.
- Vitest 4.1.11 `engines`: `^20.0.0 || ^22.0.0 || >=24.0.0` - satisfied; peer `vite: ^6 || ^7 || ^8` - satisfied by 8.2.2.
- Phaser 4.2.1 declares no `engines` constraint.
- TypeScript 7.0.2 is the native compiler release. It was chosen because it is the current
  stable tag and it type-checks this workspace cleanly (`tsc --noEmit`, exit 0). It is not on
  the runtime path: if a future TS 7 regression blocks work, 6.0.3 is a drop-in fallback and
  nothing shipped depends on the compiler.

### Known typings gap

Phaser 4.2.1's generated `types/phaser.d.ts` omits several documented `SceneManager` runtime
methods (`start`, `stop`, `pause`, `resume`, `run`, `isActive`, `isPaused`, `isSleeping`,
`getScene`, ...) that exist in `src/scene/SceneManager.js`. They are declared in
`packages/runtime/src/phaser-augmentations.d.ts` rather than cast at each call site, so scene
routing stays fully type-checked. **Delete that file when upstream typings catch up.**

## Deliberately not installed

| Candidate | Decision | Reason |
|---|---|---|
| React / Vue / Svelte / Redux | rejected | `MASTER_PROJECT.md` §3.4. The runtime is Phaser; DOM UI is plain elements and CSS. |
| A second game engine (Excalibur, KAPLAY) | rejected | Architectural references only. One engine. |
| Ajv + `ajv-formats` | **installed in Phase 2** | See "Added in Phase 2" above. |
| Playwright | **deferred** | See [ADR-0008](adr/0008-phase1-validation-strategy.md). Browser journeys become a package in the QA phase; Phase 1's flow was validated in a real browser without adding the dependency. |
| jsdom / happy-dom | rejected for now | Only needed to run Phaser headlessly under Vitest. Phase 1's unit layer is engine-free by design and needs no DOM. |
| Any font, art or audio package | rejected | Fonts are system stacks; placeholder art is generated; cues are synthesised. Nothing to license and nothing to fetch. |
| Analytics / telemetry / error reporting | forbidden | `MASTER_PROJECT.md` §3.5, §42. |

## Adding a dependency later

Record here before installing: name, exact version, canonical source, license, purpose, whether
it runs install scripts, whether it introduces network or telemetry behaviour, and the removal
path. Unverified provenance means it does not enter production.
