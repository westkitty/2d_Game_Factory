# Cold-Start Handoff

Read this if you have the repository, no chat history, and no memory of any prior session. It is
operational, not a narrative of how the project got here - for that, see `PROJECT_BIBLE.md`'s
revision-by-revision history and `OPERATIONAL_STATE.md`'s revision log.

## 1. Project purpose

**Stinky Weasel 2D Browser Game Factory (`sw2d`)** - a reusable, local-first, offline-capable
production system for 2D browser games. Not one game, and not a Phaser starter template: one
runtime plus composable system packs, controller families, data-driven content, genre preset
recipes, and theme packs, so making a new game is a *composition*, not a fork. Every game a
generated instance produces runs standalone, offline, with zero required external network access.

## 2. Canonical repository / branch

```text
https://github.com/westkitty/2d_Game_Factory
branch: main
```

`westkitty/c_chase` is a separate, **read-only** reference repository (see §5).

## 3. Authority / source-of-truth order

Read in this order when they disagree - later documents in a phase supersede earlier ones on the
same fact, but none of them supersede live evidence (a real command's output beats any document):

1. `OPERATIONAL_STATE.md` - what is verified, unverified, broken, and unknown, **right now**. The
   single most current document. Read this first, always.
2. `MASTER_PROJECT.md` - the governing 12-phase specification. What every phase was asked to do.
3. `PROJECT_BIBLE.md` - decisions made, paths rejected, and why. Historical reasoning, kept
   additive (never rewritten to look cleaner in hindsight).
4. `docs/architecture/adr/` - one Architecture Decision Record per constraining decision.
5. Phase handoff documents (`docs/architecture/PHASE*_*.md`) - point-in-time evidence packets from
   one phase to the next. Useful for "why did this change happen", not for "what is true today".
6. This document and `docs/handoff/COLD_START_AUDIT.md` - a snapshot recovery aid, not a live
   source of truth. If it disagrees with `OPERATIONAL_STATE.md`, trust `OPERATIONAL_STATE.md` and
   suspect this document is stale.

## 4. Prerequisites

- **Node** `>=22.12.0`; target is 24.x LTS (`.nvmrc` says `24`). Tested on this repository as of
  Phase 11 with Node v26.7.0 (see `docs/release/CLEAN_BUILD_REPRODUCIBILITY.md` for the exact
  caveat: Node 24.x itself is untested on the machine Phase 11 ran on, not unsupported).
- **npm** ships with Node. `npm ci` needs the npm registry/cache reachable at least once (a
  development bootstrap dependency, not a runtime one).
- **System Chrome or Chromium** - required for every real-browser QA command
  (`qa:smoke`/`qa:proof`/`qa:responsive`/`release:verify`). `playwright-core` never downloads a
  bundled browser. `npm run sw2d -- doctor` tells you if one was found.
- **Tiled** - optional. Not required to run generated games or any committed command.
- No credentials or secrets are required anywhere in this repository.

## 5. Architecture boundaries

```text
RUNTIME / SYSTEM CODE                 = the reusable machine
CONTENT / THEME / GAME-SPECIFIC CODE  = an individual game
```

```text
packages/contracts/        @sw2d/contracts        interfaces. Zero dependencies - no Phaser, no DOM.
packages/runtime/          @sw2d/runtime          the reusable machine (scenes, input, packs host).
packages/packs/            @sw2d/packs            ten reusable system-pack cores.
packages/presets/          @sw2d/presets          74 genre preset recipes.
packages/content-pipeline/ @sw2d/content-pipeline Tiled normalization, entity registry, themes.
packages/schemas/          @sw2d/schemas          Ajv validators for every content document.
packages/cli/              @sw2d/cli              `npm run sw2d -- <command>`.
packages/qa/               @sw2d/qa               real-browser (system Chrome) QA harness.
starter/                   @sw2d/starter          the vertical slice: boot -> title -> play -> pause -> restart.
demos/                                             12 real, smoke-validated demo games (one per genre family).
proofs/                                            5 deep, end-to-end proof-validated games.
games/                                             generated games (gitignored, created by `sw2d new`).
docs/                                              architecture, ADRs, QA evidence, agent workflow, handoff.
tools/scripts/                                     repository-level checks and matrices.
release/                                           documentation only - see release/README.md.
```

Ordinary game work touches `content/`, `public/`, `themes/`, `src/game-specific/` inside a
generated game. It does not touch `packages/contracts/`, `packages/runtime/`, or a shared system
pack - those are machine work, and changing them without a real, forcing consumer is exactly what
`OPERATIONAL_STATE.md`'s "Protected invariants" list exists to prevent. See invariant 3 there and
`starter/src/game-specific/placeholderMoverPack.ts` as the worked example of game-side extension
with the runtime untouched.

## 6. Normal game-generation workflow

```bash
npm install
npm run sw2d -- doctor                              # environment diagnostics, never mutates
npm run sw2d -- list-presets                         # all 74 genre recipes
npm run sw2d -- describe <preset-id>                 # a preset's packs, content roles, limitations
npm run sw2d -- new <game-id> --preset <preset-id>   # generate a real, runnable game under games/
npm run sw2d -- add-level <game-id> <level-id>       # add a self-validated Tiled level
npm run sw2d -- add-theme <game-id> <theme-id>       # add a self-validated theme manifest
npm run sw2d -- validate <game-id>                   # schema + typecheck + tests + build + browser smoke
npm run sw2d -- build <game-id>                      # production build
npm run sw2d -- pack <game-id>                       # deterministic, checksummed, offline-guarded release pack
```

Full reference: `docs/cli/CLI_REFERENCE.md`. Release process detail: `release/README.md`.

## 7. Build / QA / release commands

```bash
npm run validate       # typecheck + unit tests + build + offline guard (fast, no browser)
npm run qa:smoke       # 14 targets (12 demos + 2 starter pages), real Chrome, 14/14
npm run qa:proof       # 5 deep proof games, real Chrome, 5/5
npm run qa:responsive  # 19 surfaces x 2 viewports, real Chromium touch/coarse-pointer emulation, 19/19
npm run release:verify # 6/6 controller-shell families: generate->validate->pack->verify, real Chrome
```

Full explanation of what each proves and does not: `docs/qa/QA_MATRIX.md`.

## 8. Current maturity state

74 total presets: **5 `proof-validated`, 7 `smoke-validated`, 62 `recipe`, 0 `experimental`**.
Mechanically enforced by `packages/presets/test/honesty.test.ts` - a maturity label cannot drift
from real evidence without a test failing. Detail: `docs/presets/PRESET_CATALOG.md`,
`docs/presets/PRESET_CAPABILITY_MATRIX.md`, `docs/demos/DEMO_MATRIX.md`, `docs/proofs/PROOF_MATRIX.md`.

**Technically release-ready** as of Phase 11 (`docs/release/RELEASE_READINESS.md`); the project's
public software license remains an **unresolved user decision** (`UNLICENSED`).

## 9. Protected invariants

The full, numbered list lives in `OPERATIONAL_STATE.md`'s "Protected invariants" section - read it
there, it is kept current. Breaking one is an architecture change, not a bug fix; escalate rather
than work around. Highlights: `westkitty/c_chase` stays read-only; `westkitty/2d_Game_Factory` is
the only authorized remote (no force-push, no history rewrite); gameplay never reads a raw
`KeyboardEvent.code`, only semantic actions; zero required external network requests at runtime;
`@sw2d/contracts` has zero dependencies; no new package or abstraction without a real consumer;
preset maturity labels stay evidence-backed.

## 10. Known limitations / unknowns

Full, current list: `OPERATIONAL_STATE.md`'s "Implemented but unverified" and "Unknown" sections.
The durable ones, unlikely to close soon without a specific forcing event:

- Real-device touch (only Chromium emulation exercised).
- Gamepad feasibility (input adapter exists, no polling device ever exercised against it).
- Real wall-clock performance/FPS (every QA journey uses deterministic fixed-step timing, never a
  performance claim).
- Spatial pointer, a universal puzzle DSL, a shared grid-cursor abstraction - all deliberately
  deferred with explicit triggers recorded in `OPERATIONAL_STATE.md`.
- The project software license.

## 11. Resource / license state

- **Resource provenance**: every generated game's assets are honestly recorded as
  project-owned/generated placeholder content (`resources/RESOURCE_MANIFEST.json`, enforced by
  `sw2d pack`'s resource-governance gate). No third-party visual/audio/font asset exists anywhere
  in this repository yet.
- **Third-party code notices**: `docs/resources/THIRD_PARTY_NOTICES.md` (repository-level) and
  each pack's own mechanically-derived `THIRD_PARTY_NOTICES.txt` (release-level) list every
  production npm dependency actually shipped - currently Phaser, ajv, and ajv-formats, all MIT.
- **Project software license**: `UNLICENSED`. An explicit, unresolved decision belonging to the
  project owner. Do not choose one on their behalf; do not claim public-distribution readiness.

## 12. Current release status

Technically release-ready (`docs/release/RELEASE_READINESS.md`). No public distribution or GitHub
Release has been performed - that is explicitly out of scope for every phase so far.

## 13. Next owner and exact next phase

**Phase 12 - Opus 5 - Final Cross-System Acceptance and Cold-Start Gate.**

Evidence packet: `docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`. `OPERATIONAL_STATE.md`'s "Next
bounded action" section is the live, authoritative statement of what comes next - if this document
and that one ever disagree, `OPERATIONAL_STATE.md` wins.
