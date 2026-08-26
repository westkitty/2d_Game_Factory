# Release Readiness

Phase 11 §17. This document exists to keep two separate questions from being conflated: whether
the factory can technically produce a verified release artifact, and whether anyone may actually
distribute one. The first is **yes**. The second is **not yet decided** - that is a real, open,
user-owned decision, not an oversight.

## Technical release readiness: YES

- **Release packer**: `sw2d pack <game-id>` produces a self-contained static release candidate at
  `games/<game-id>/pack/` - a real `vite build` output plus a deterministic `RELEASE_MANIFEST.json`,
  a SHA-256 `SHA256SUMS`, and a mechanically-derived `THIRD_PARTY_NOTICES.txt`.
- **Resource governance gate**: packaging is refused outright (before any build runs) if the
  game's `resources/RESOURCE_MANIFEST.json` is missing, schema-invalid, or contains a
  non-`approved` record. Unverified provenance cannot silently enter a release.
- **Release verification matrix**: `npm run release:verify` proves the full pipeline end-to-end
  for one fresh-generated game per controller-shell family - **6/6 pass**
  (`traditional-platformer`/platform, `top-down-adventure`/top-down, `asteroids-shooter`/vehicle,
  `sokoban`/grid+code-configured puzzle path, `gallery-shooter`/pointer,
  `idle-incremental`/ui-simulation). Each covers: generate → validate (typecheck+tests+build+boot
  smoke) → pack → verify `RELEASE_MANIFEST.json` → verify every `SHA256SUMS` entry against the
  actual file → verify resource governance state → serve the **packed** directory (not `dist/`)
  through real system Chrome → enter play → verify every declared pack installs → zero console
  errors → zero external requests.
- **Checksum integrity**: verified with the standard system `shasum -a 256 -c` tool (not only this
  repository's own code) in `docs/release/CLEAN_BUILD_REPRODUCIBILITY.md` - `OK` for every file.
  A deliberately tampered file was confirmed to fail verification (`packages/cli/test/
  checksums.test.ts`).

## Runtime offline status: YES

Zero required external runtime network requests. Confirmed at every layer: the static-text
`check:offline` guard (every build and every pack), and the real-browser `externalRequests()`
oracle every `qa:smoke`/`qa:proof`/`release:verify`/`qa:responsive`/clean-build run asserts against
a live loaded page, not just source text.

## Checksum status: YES

Every packed release carries a `SHA256SUMS` covering every shipped file, computed last (after
`RELEASE_MANIFEST.json` and `THIRD_PARTY_NOTICES.txt` are written) so it never has to include a
checksum for itself. Tampering with any file after packing is detected
(`packages/cli/src/releasePackaging/checksums.ts`'s `verifyChecksums`, exercised by both a unit
test and the release-verification matrix).

## Resource/provenance status: YES, for what exists today

Every generated game's assets are honestly recorded as project-owned/generated placeholder content
(`resources/RESOURCE_MANIFEST.json`, one record per theme role, `status: 'approved'`) - there is no
third-party visual, audio, or font asset anywhere in this repository yet
(`resource-policy.json`'s own note, unchanged by Phase 11). `pack` enforces this at packaging time,
not merely at documentation time. The day a first third-party asset is introduced, the same gate
blocks it from packaging until it is recorded and approved.

## Responsive/mobile automated status: YES

`npm run qa:responsive` covers all 19 committed user-facing surfaces at two coarse-pointer/touch
viewport contexts (375x812 portrait, 844x390 landscape) via real Chromium device emulation -
**19/19 pass**. This phase found and fixed one real, previously-undetected defect this way (see
`OPERATIONAL_STATE.md` Revision 13 and `docs/qa/QA_MATRIX.md`). This is emulation, not real
hardware - see "Real-device/performance unknowns" below.

## Clean-build status: YES

`docs/release/CLEAN_BUILD_REPRODUCIBILITY.md` verdict: **REPRODUCIBLE**. An isolated,
index-derived snapshot (not the primary worktree) installs, validates, generates a game, packs it,
and passes a real-browser check with no dependency on worktree state beyond what git tracks.
Tested on Node v26.7.0 (the only version available on this host); exact Node 24.x execution is an
explicit, separately-tracked unverified item.

## Project software-license status: UNRESOLVED (unchanged by Phase 11)

`package.json`'s `license` field is `UNLICENSED` and stays that way. This is the project owner's
decision to make, not this phase's or any automated agent's. Phase 11 deliberately did **not**:

- choose a license (MIT/Apache/GPL/etc.),
- add a `LICENSE` file,
- change `package.json`'s `license` field to a guessed value, or
- claim public redistribution readiness anywhere in this repository.

**"Technically release-ready" and "cleared for public distribution" are two different
statements.** This document, `README.md`, and `docs/architecture/PHASE11_FINAL_OPUS_HANDOFF.md`
all say so explicitly, everywhere the topic comes up.

## Real-device/performance unknowns (unchanged by Phase 11, listed here for completeness)

- **Real-device touch**: only Chromium's `isMobile`/`hasTouch`/`deviceScaleFactor` emulation has
  been exercised (Phase 1's original manual pass, and Phase 11's `qa:responsive` suite). No
  physical phone or tablet has run any surface in this repository.
- **Real wall-clock performance/FPS**: every automated browser journey uses the QA harness's
  deterministic fixed-step clock (16.67ms per stepped frame) - that proves repeatable behaviour,
  never real-time frame pacing. No FPS claim exists anywhere in this repository's QA evidence.
- **Gamepad**: `InputDeviceAdapter.poll()` exists and is unit-tested for call cadence; no polling
  device has ever been exercised against it.

## Summary

| Dimension | Status |
|---|---|
| Technical release packaging | Ready - 6/6 controller-shell families verified |
| Runtime offline guarantee | Ready - zero required external requests, verified at every layer |
| Checksum integrity | Ready - SHA-256, standard-tool-verified, tamper-detected |
| Resource/provenance governance | Ready for current (100% project-owned/generated) content; gate is live for future third-party additions |
| Responsive/mobile (emulated) | Ready - 19/19 surfaces, one real defect found and fixed this phase |
| Clean-build reproducibility | Reproducible (Node 26.7.0 tested; Node 24.x unverified) |
| Public software license | **Not decided - explicit user decision pending** |
| Public distribution | **Not claimed. Do not distribute without first resolving the license.** |
