# Stinky Weasel 2D Browser Game Factory

A reusable, local-first, offline-capable production system for 2D browser games.

Not one game, and not a Phaser starter template: one runtime plus composable system packs,
controller families, data-driven content, genre preset recipes and theme packs, so a new game is
a *composition* rather than a fork.

> **Status: all 12 phases complete. The initial master project is accepted and finished.**
> The runtime, ten system-pack cores, 74 genre preset recipes (5 proof-validated /
> 7 smoke-validated / 62 recipe / 0 experimental), a real factory CLI with a release packer, twelve
> generated real-browser-smoke-validated demo games, five deeper end-to-end proof games, a 6/6
> real-browser release-verification matrix, a 19-surface real-browser responsive/mobile suite, and a
> 40-target generated-runtime matrix covering all 74 presets all exist and are validated. The final
> acceptance gate is recorded in
> [`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md)
> (A01-A20 all PASS, F01-F13 all NO). **Pending work under the master project: none. No Phase 13 -
> future work needs a separately scoped project.**
>
> **Technically release-ready; the project's public software license is still an unresolved user
> decision (`UNLICENSED`)** - see
> [`docs/release/RELEASE_READINESS.md`](docs/release/RELEASE_READINESS.md).
> [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md) is the authority on what actually works; new to
> this repository with no prior context? Start at
> [`docs/handoff/COLD_START_HANDOFF.md`](docs/handoff/COLD_START_HANDOFF.md) instead.

## What is here today

```text
packages/contracts/       @sw2d/contracts        interfaces. Zero dependencies, no Phaser, no DOM.
packages/runtime/         @sw2d/runtime          the reusable machine.
packages/packs/           @sw2d/packs            ten reusable system-pack cores.
packages/presets/         @sw2d/presets          74 genre preset recipes.
packages/content-pipeline/ @sw2d/content-pipeline Tiled normalization, entity registry, themes.
packages/schemas/         @sw2d/schemas          Ajv validators for every content document.
packages/cli/             @sw2d/cli              `npm run sw2d -- <command>`: doctor, new, validate, build, pack, ...
packages/qa/              @sw2d/qa               real-browser (system Chrome) smoke-test harness.
starter/                  @sw2d/starter          the vertical slice: boot -> title -> play -> pause -> restart.
demos/                                            twelve real, smoke-validated demo games (one per genre family).
proofs/                                            five deep, end-to-end proof-validated games.
docs/                                             architecture, ADRs, QA evidence, agent workflow.
tools/scripts/                                    repository checks.
```

## Requirements

Node **24.x LTS** (`.nvmrc`); anything `>=22.12.0` works. npm ships with it. Nothing else.

## Install and run

```bash
npm install
npm run dev
```

Open the printed URL. Press <kbd>Enter</kbd> or <kbd>Space</kbd> to start, arrows or
<kbd>A</kbd>/<kbd>D</kbd> to move, <kbd>Space</kbd> to jump, <kbd>P</kbd> to pause. On a phone,
touch controls appear automatically.

```bash
npm run build      # production build -> starter/dist
npm run preview    # serve the production build
npm run validate      # typecheck + unit tests + build + offline guard
npm run qa:smoke      # build and real-browser-smoke every demo + starter journey
npm run qa:proof      # build and real-browser-prove every deep proof game
npm run qa:responsive # real-browser responsive/mobile check: 19 surfaces x 2 viewports
npm run qa:matrix     # generate+build+play one game per distinct runtime signature: 40 targets covering all 74 presets
npm run release:verify # generate+validate+pack+verify one game per controller-shell family
```

## The factory CLI

```bash
npm run sw2d -- doctor                              # environment diagnostics (never mutates)
npm run sw2d -- list-presets                        # all 74 genre recipes
npm run sw2d -- describe <preset-id>                # a preset's packs, content roles, limitations
npm run sw2d -- new <game-id> --preset <preset-id>   # generate a real, runnable game
npm run sw2d -- add-level <game-id> <level-id>       # add a self-validated Tiled level
npm run sw2d -- add-theme <game-id> <theme-id>       # add a self-validated theme manifest
npm run sw2d -- validate <game-id>                   # schema + typecheck + tests + build + browser smoke
npm run sw2d -- build <game-id>                      # production build
npm run sw2d -- pack <game-id>                       # clean, offline-guard-checked pack/ output
```

See [`docs/cli/CLI_REFERENCE.md`](docs/cli/CLI_REFERENCE.md) for full command docs,
[`docs/demos/DEMO_MATRIX.md`](docs/demos/DEMO_MATRIX.md) for what each of the twelve committed
`demos/` proves, and [`docs/proofs/PROOF_MATRIX.md`](docs/proofs/PROOF_MATRIX.md) for what each
of the five committed `proofs/` proves.

### Producing a release

`sw2d pack <game-id>` builds a generated game and produces a self-contained, offline-verified
release candidate at `games/<game-id>/pack/`: the built static game, a deterministic
`RELEASE_MANIFEST.json`, a SHA-256 `SHA256SUMS`, and a mechanically-derived
`THIRD_PARTY_NOTICES.txt`. It refuses to pack a game whose `resources/RESOURCE_MANIFEST.json` is
missing, invalid, or contains an unapproved resource - unverified provenance never silently enters
a release. See [`release/README.md`](release/README.md) for how to regenerate and verify a release
candidate, and [`docs/release/RELEASE_READINESS.md`](docs/release/RELEASE_READINESS.md) for the
current release-readiness state (technical readiness vs. the still-open license decision).

## The one rule

```text
RUNTIME / SYSTEM CODE  = the reusable machine
CONTENT / THEME / GAME-SPECIFIC CODE = the individual game
```

Making a normal new game must never require editing the machine.

```text
NORMAL GAME WORK          DO NOT CASUALLY MODIFY
content/**                packages/contracts/**
public/**                 packages/runtime/**
themes/**                 shared system packs
src/game-specific/**      shared controllers
```

`starter/src/game-specific/placeholderMoverPack.ts` is the worked example: a controllable actor
added entirely from the game side, with the runtime untouched. Compare against it when unsure
where something belongs.

## How a game is put together

**Art and audio** go in the game's own `public/` and are declared in its content bundle by
*semantic role* (`player`, `platform`, `pickup`). Gameplay asks for a role and gets a texture;
the theme decides what it looks like. Phase 1's placeholder art is generated at boot, so the
slice runs before any asset exists.

**Wording** comes from `ContentBundle.ui`. The runtime knows *that* the game is paused; it does
not know what your game calls pausing.

**Input** is semantic. Gameplay reads `MOVE_LEFT`, `JUMP`, `PAUSE` - never a key code. Keyboard
and touch feed the same actions, so touch play needs no duplicated logic.

**Behaviour** is a system pack: an id, declared capabilities and dependencies, an `install()` and
a `dispose()`. Packs depend on capability ids, never on each other's modules.

## Offline, always

A production build makes **zero** required external requests. No CDN, no Google Fonts, no
telemetry, no analytics, no remote config, no cloud save. Fonts are system stacks, placeholder
art is generated, audio cues are synthesised. `npm run check:offline` guards it, and the
browser-level evidence is in [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md).

## Documentation

| Document | Purpose |
|---|---|
| [`MASTER_PROJECT.md`](MASTER_PROJECT.md) | the governing specification for all 12 phases |
| [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md) | what is verified, unverified, broken, unknown - **read first** |
| [`PROJECT_BIBLE.md`](PROJECT_BIBLE.md) | decisions, rejected paths, lessons learned |
| [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) | how to work in this repository safely |
| [`docs/architecture/ARCHITECTURE_OVERVIEW.md`](docs/architecture/ARCHITECTURE_OVERVIEW.md) | how the pieces fit |
| [`docs/architecture/DEPENDENCY_BASELINE.md`](docs/architecture/DEPENDENCY_BASELINE.md) | pinned versions, licences, and what was deliberately not installed |
| [`docs/architecture/adr/`](docs/architecture/adr/) | one record per constraining decision |
| [`docs/architecture/C_CHASE_EXTRACTION.md`](docs/architecture/C_CHASE_EXTRACTION.md) | what to preserve, generalise and avoid from the reference build |
| [`docs/qa/PHASE1_VALIDATION.md`](docs/qa/PHASE1_VALIDATION.md) | executed checks and their evidence |
| [`docs/presets/PRESET_CATALOG.md`](docs/presets/PRESET_CATALOG.md) | all 74 genre presets and their maturity |
| [`docs/cli/CLI_REFERENCE.md`](docs/cli/CLI_REFERENCE.md) | every `sw2d` command, its args, and its guarantees |
| [`docs/demos/DEMO_MATRIX.md`](docs/demos/DEMO_MATRIX.md) | the twelve `demos/` games and what each proves |
| [`docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md`](docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md) | Phase 8's handoff to Phase 9's architecture review |
| [`docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md`](docs/architecture/PHASE9_ARCHITECTURE_GATE_B.md) | Phase 9's architecture integration gate review |
| [`docs/proofs/PROOF_MATRIX.md`](docs/proofs/PROOF_MATRIX.md) | the five `proofs/` games and what each proves |
| [`docs/architecture/PHASE10_PROOF_HANDOFF.md`](docs/architecture/PHASE10_PROOF_HANDOFF.md) | Phase 10's handoff to Phase 11 |
| [`docs/qa/QA_MATRIX.md`](docs/qa/QA_MATRIX.md) | every QA command, what it proves, and what it explicitly does not |
| [`docs/release/RELEASE_READINESS.md`](docs/release/RELEASE_READINESS.md) | technical release readiness vs. the open license decision |
| [`release/README.md`](release/README.md) | how to regenerate and verify a release candidate |
| [`docs/resources/THIRD_PARTY_NOTICES.md`](docs/resources/THIRD_PARTY_NOTICES.md) | every third-party dependency actually shipped, with license text |
| [`docs/handoff/COLD_START_HANDOFF.md`](docs/handoff/COLD_START_HANDOFF.md) | recover full working context with no chat history |
| [`docs/handoff/COLD_START_AUDIT.md`](docs/handoff/COLD_START_AUDIT.md) | evidence-only audit of whether this repository is actually recoverable |
| [`docs/release/CLEAN_BUILD_REPRODUCIBILITY.md`](docs/release/CLEAN_BUILD_REPRODUCIBILITY.md) | proof that an isolated, index-derived checkout installs/builds/validates/packs |
| [`docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`](docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md) | Phase 11's handoff to Phase 12 |
| [`docs/architecture/PHASE12_FINAL_ACCEPTANCE.md`](docs/architecture/PHASE12_FINAL_ACCEPTANCE.md) | the final acceptance gate: A01-A20 ledger, F01-F13 audit, cold-start challenge, stopping decision |

## Resuming work

Read `OPERATIONAL_STATE.md`, run `npm run validate`, and continue from the recorded next bounded
action. Full protocol in [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md). No memory of prior
sessions and need to rebuild full context from the repository alone? Start at
[`docs/handoff/COLD_START_HANDOFF.md`](docs/handoff/COLD_START_HANDOFF.md) instead - it is written
for exactly that case.

As of Phase 12 that recorded next bounded action is **none**: the initial master project is
complete. Anything further - a device lab, gamepad support, real performance measurement, spatial
pointer, deeper mechanics for any of the 62 `recipe` presets, or a licensing and distribution
decision - is new work needing its own scope and its own acceptance contract, not a continuation of
this plan.

## Reference material

[`westkitty/c_chase`](https://github.com/westkitty/c_chase) (Cloud Chaser) is a **read-only**
behavioural reference. Its game feel is worth preserving and its single-file architecture is
exactly what this factory exists to replace. It carries no software licence and its asset
clearance is unconfirmed, so none of its assets may enter this repository. See the extraction
report.

## Known high-level limitations

Real-device touch (only Chromium touch/coarse-pointer emulation has been exercised), gamepad
support, real wall-clock performance/FPS (all QA evidence is deterministic-frame-stepping
evidence, never a performance claim), spatial pointer input, a universal puzzle DSL, and a shared
grid-cursor abstraction are all deliberately deferred - see `OPERATIONAL_STATE.md`'s "Unknown" and
"Implemented but unverified" sections for the full, current list and the trigger that would open
each one.

## Licence

Not yet chosen (`UNLICENSED`). The factory is **technically** release-ready (see
[`docs/release/RELEASE_READINESS.md`](docs/release/RELEASE_READINESS.md)); pick a license before
distributing anything built here.
