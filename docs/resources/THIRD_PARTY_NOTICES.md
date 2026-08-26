# Third-Party Notices

Generated for the Phase 1 baseline, 2026-08-24; corrected in Phase 11 (2026-08-26) - see below.
Machine-readable inventory: [`CODE_RESOURCE_MANIFEST.json`](CODE_RESOURCE_MANIFEST.json). Policy:
[`../../resource-policy.json`](../../resource-policy.json).

**Phase 11 correction:** the Phase 1 baseline above stated "Phaser is the only third-party code in
the shipped artefact." That was inaccurate: `@sw2d/schemas` is a `dependencies` (not
`devDependencies`) entry of every generated game, and its runtime content-validation path
(`validateDocumentOrThrow`, `packConfigValidator`, `validateContentBundleData` - all imported by
the generated `src/main.ts`, `src/game.ts`, and `src/content.ts`) uses `ajv` and `ajv-formats` at
runtime, so both are bundled into the production build alongside Phaser. Confirmed by inspecting
`starter/dist/assets/*.js` for `ajv` symbols, and now covered by a standing sync test
(`packages/cli/test/notices.test.ts`) plus `pack`'s own mechanically-derived
`THIRD_PARTY_NOTICES.txt` (Phase 11 section 6 - `@sw2d/cli`'s `resolveShippedDependencies()` walks
the real dependency graph from a generated game's own `package.json`, not a hand-maintained list),
so this class of drift cannot recur silently.

## Shipped in the production build

### Phaser 4.2.1 — MIT

https://github.com/phaserjs/phaser

```
The MIT License (MIT)

Copyright (c) 2026 Richard Davey, Phaser Studio Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### ajv 8.20.0 — MIT

https://github.com/ajv-validator/ajv

```
The MIT License (MIT)

Copyright (c) 2015-2021 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ajv-formats 3.0.1 — MIT

https://github.com/ajv-validator/ajv-formats

```
MIT License

Copyright (c) 2020 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Phaser, ajv, and ajv-formats are the only third-party code in the shipped artefact. Everything
else is project code.

## Build and development tooling — not shipped

| Package | Version | License |
|---|---|---|
| TypeScript | 7.0.2 | Apache-2.0 |
| Vite | 8.2.2 | MIT |
| Vitest | 4.1.11 | MIT |
| playwright-core | 1.62.1 | Apache-2.0 |
| @types/node | 24.13.3 | MIT |

Their transitive dependencies are recorded in `package-lock.json` and are build-time only.

**Phase 12 correction:** `playwright-core` (a `devDependencies` entry of `@sw2d/qa`, driving every
real-browser QA command) and `@types/node` (root `devDependencies`) are real, declared, direct
dependencies that neither this table nor
[`CODE_RESOURCE_MANIFEST.json`](CODE_RESOURCE_MANIFEST.json) had ever recorded - the same class of
omission Phase 11 corrected for `ajv`/`ajv-formats`, one step further out. To be precise about the
size of the gap: `playwright-core`'s provenance was never *unknown* - it has been fully recorded in
[`../architecture/DEPENDENCY_BASELINE.md`](../architecture/DEPENDENCY_BASELINE.md) since Phase 8,
including why the core package is preferred over the full one. What was wrong is that
`resource-policy.json` names `CODE_RESOURCE_MANIFEST.json` as *the* machine-readable code-dependency
record, and that record was incomplete, so the two documents disagreed by omission. Neither is shipped in a
production build, so no release artifact's mechanically-derived `THIRD_PARTY_NOTICES.txt` was ever
wrong; the gap was in this repository-level record, which `MASTER_PROJECT.md` section 20.2 requires
for *every* nontrivial direct dependency, shipped or not. Both are now recorded, and
`packages/cli/test/codeResourceManifest.test.ts` derives the required set mechanically from every
workspace `package.json`, so a future dependency cannot be added without this manifest failing
loudly. `playwright-core` is deliberately preferred over the full `playwright` package because it
has no post-install browser download - installing this repository never fetches a browser binary.

## Assets

**None.** There is no third-party visual, audio or font asset in this repository.

- Placeholder art is drawn in-process from specifications in the game's content bundle.
- Audio cues are synthesised with Web Audio oscillators.
- Typography uses system font stacks; no webfont is downloaded or bundled.

When the first third-party asset is introduced, record it per `resource-policy.json` before it
enters the repository.

## Reference material — not incorporated

[`westkitty/c_chase`](https://github.com/westkitty/c_chase) was inspected read-only as a
behavioural reference. It carries **no software licence** and its own README states that
audio/visual clearance is unconfirmed. No code and no asset from it appears here.

Numeric gameplay tuning values were transcribed with their source file and inspection date in
[`../architecture/C_CHASE_EXTRACTION.md`](../architecture/C_CHASE_EXTRACTION.md).
