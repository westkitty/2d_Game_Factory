# Producing and verifying a release candidate

This directory is documentation only. Generated release output lives under `games/<game-id>/pack/`
(gitignored - see `.gitignore`'s `games/` and `pack/` entries) and is never committed.

## Produce a release candidate

```bash
npm run sw2d -- new <game-id> --preset <preset-id>   # if the game doesn't exist yet
npm run sw2d -- validate <game-id>                    # typecheck + tests + build + boot smoke
npm run sw2d -- pack <game-id>                        # produces games/<game-id>/pack/
```

`pack` refuses to run if `games/<game-id>/resources/RESOURCE_MANIFEST.json` is missing, invalid,
or contains any resource record that is not `status: 'approved'` - resource governance runs
*before* the build, so an unverified resource never gets as far as a built artifact.

A successful pack produces:

```text
games/<game-id>/pack/
  index.html, assets/...            the built static game (Vite output, copied verbatim)
  RELEASE_MANIFEST.json             deterministic facts: gameId, presetId, factoryVersion,
                                     packagingMode, fileInventory, projectLicenseStatus,
                                     resourceGovernance - no timestamps, no random ids, no
                                     absolute machine paths
  SHA256SUMS                        one SHA-256 line per shipped file, sorted POSIX-relative
                                     paths, computed last (never includes a checksum for itself)
  THIRD_PARTY_NOTICES.txt           every production npm dependency actually represented in the
                                     shipped bundle, mechanically derived from installed package
                                     metadata (packages/cli/src/releasePackaging/notices.ts) - not
                                     a hand-maintained list
```

## Verify a release candidate

Checksums, with the standard system tool (no dependency on this repository's own code to trust
the result):

```bash
cd games/<game-id>/pack
awk '{print $1"  "$2}' SHA256SUMS > /tmp/sums.txt   # macOS/BSD shasum wants two spaces
shasum -a 256 -c /tmp/sums.txt
```

Or, from Node, using this repository's own verifier (also what `npm run release:verify` uses
internally):

```ts
import { parseSha256Sums, verifyChecksums } from './packages/cli/src/releasePackaging/checksums.ts';
const expected = parseSha256Sums(readFileSync('games/<game-id>/pack/SHA256SUMS', 'utf8'));
const mismatches = await verifyChecksums('games/<game-id>/pack', expected);
// mismatches is [] for an untampered pack; each entry names a 'missing' or 'mismatch' file.
```

Serve and boot-check the packed directory itself (not `dist/` - they're the same files today, but
verifying the actual release artifact is the point):

```bash
npx serve games/<game-id>/pack   # or any static file server
```

Open it and confirm: it boots offline (no console network errors), reaches the title screen,
enters play with the declared system packs installed.

## The full matrix, in one command

`npm run release:verify` does all of the above - generate, validate, pack, verify manifest,
verify checksums, verify resource state, serve the packed dir through real Chrome, enter play,
verify declared packs, zero console errors, zero external requests - for one representative game
per controller-shell family, plus a byte-identical double-pack proof for the first one. See
`docs/qa/QA_MATRIX.md` for exactly what it proves and does not, and
`docs/release/RELEASE_READINESS.md` for the current overall release-readiness state.

## Before distributing anything

The project's software license is **`UNLICENSED`** - an explicit, unresolved decision, not an
oversight. Technical release readiness (this document, `docs/release/RELEASE_READINESS.md`) is
not the same statement as public-distribution readiness. Resolve the license first.
