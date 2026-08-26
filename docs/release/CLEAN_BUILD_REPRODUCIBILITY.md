# Clean-Build Reproducibility

Phase 11 §16. Verdict for this revision:

## REPRODUCIBLE

An isolated, index-derived snapshot of the staged Phase 11 tree installs, builds, validates,
generates a new game, packs it, and produces a real-Chrome-verified, checksum-verified, static
release candidate - with no dependency on anything in the primary worktree beyond what git tracks.

## Method

Snapshot was derived from the git index, not from arbitrary worktree files, per the pattern this
document itself prescribes:

```bash
git add -A
TMP_ROOT="$(mktemp -d)"
git checkout-index --all --prefix="$TMP_ROOT/sw2d/"
```

`git checkout-index --all` writes every currently-staged tracked file and nothing else - no
`node_modules/`, no untracked scratch files, no generated `dist/`/`pack/`/`games/` output, no
machine-specific cache. Confirmed by inspecting the snapshot directory before installing anything:
top-level contents were exactly `MASTER_PROJECT.md`, `OPERATIONAL_STATE.md`, `PROJECT_BIBLE.md`,
`README.md`, `demos/`, `docs/`, `package.json`, `package-lock.json`, `packages/`, `proofs/`,
`resource-policy.json`, `starter/`, `tools/`, `tsconfig*.json`, `vitest.config.ts`, `.gitignore`,
`.nvmrc` - 3.1 MB total.

## Steps executed, in the isolated snapshot only

| # | Step | Result |
|---|---|---|
| 1 | Source material complete (see snapshot contents above) | confirmed |
| 2 | `npm ci` | 84 packages installed, 0 vulnerabilities, ~2-4s |
| 3 | `npm run sw2d -- doctor` | all checks `[OK]` (Node, npm, dependency install, TypeScript, Ajv/schemas load, required package directories, system Chrome found); `games/` and Tiled warnings are expected-absent, not failures |
| 4 | `npm run validate` (typecheck + 1781 unit tests + build + offline guard) | **PASS**, byte-for-byte the same test count as the primary worktree |
| 5 | Generate a new game via the documented CLI (`npm run sw2d -- new clean-proof-game --preset traditional-platformer`) | generated at `games/clean-proof-game/` |
| 6 | `npm run sw2d -- validate clean-proof-game` | **PASS** (schema/content + unit tests, TypeScript, production build, real-browser boot smoke) |
| 7 | `npm run sw2d -- pack clean-proof-game` | **PASS** - offline guard passed, `RELEASE_MANIFEST.json`/`SHA256SUMS`/`THIRD_PARTY_NOTICES.txt` written |
| 8 | Verify the packed artifact's checksums with the **standard system tool**, not this repository's own code | `shasum -a 256 -c SHA256SUMS` → `OK` for all 6 files |
| 9 | Smallest decisive real-browser check: serve `games/clean-proof-game/pack/` (the packed directory, not `dist/`), launch real system Chrome via `playwright-core`, load `index.html`, press Space | `scene: "sw2d.play"`, `installedPacks: ["sw2d.world", "sw2d.world-entities", "game.platform-shell"]` (matches the preset's declared packs), `consoleErrors: []`, `externalRequestCount: 0` |

Snapshot removed after the run (`rm -rf "$TMP_ROOT"`) - no state leaked back into the primary
worktree.

## External prerequisites (named explicitly, not hidden)

- **npm registry/cache** - a development bootstrap dependency. `npm ci` in step 2 resolved against
  the committed `package-lock.json`; no network access was required beyond npm's own local cache
  in this environment (no fresh-registry-fetch scenario was separately tested, since the lockfile
  and local cache already satisfied every dependency).
- **System Chrome or Chromium** - required for step 6's browser smoke and step 9's decisive check.
  `playwright-core` never downloads a bundled browser (deliberately - see
  `docs/qa/QA_MATRIX.md`'s "Browser prerequisite" section); without one, `sw2d doctor` reports it
  and browser-driving commands fail fast with a clear message rather than a silent skip.
- **Tiled** - optional, not required for this proof or for running generated games.
- No credentials or secrets were required at any step.

## Node version

Tested Node version: **v26.7.0** (npm 11.19.0), the only Node line installed on this host (no
nvm/volta/fnm present; a fresh Node 24.x install was not performed for this proof, per this
document's own instruction not to download or fabricate a version solely to satisfy a checkbox).
`.nvmrc` targets `24`; `package.json engines` requires `>=22.12.0`. **Exact Node 24.x execution
remains an explicit, unverified compatibility item** - nothing in this proof depends on a Node 26
feature unavailable in 24.x (native TypeScript execution via type-stripping is available from
Node 22.6+ onward per Node's own release notes), but it has not been directly exercised.

## What this proves, and what it does not

Proves: the exact set of files git will commit (post-Phase-11-staging) is sufficient, by itself,
for a new checkout to install, validate, generate a game, pack it, and run it through a real
browser - with no dependency on primary-worktree state (leftover `node_modules`, stray local
config, a previously-generated `games/` directory, etc.).

Does not prove: exact Node 24.x compatibility (see above), a fresh-registry npm install with an
empty local cache, or reproducibility on Windows/Linux (this proof ran on macOS/arm64, the only
platform available).
