# Third-Party Notices

Generated for the Phase 1 baseline, 2026-08-24. Machine-readable inventory:
[`CODE_RESOURCE_MANIFEST.json`](CODE_RESOURCE_MANIFEST.json). Policy:
[`../../resource-policy.json`](../../resource-policy.json).

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

Phaser is the only third-party code in the shipped artefact. Everything else is project code.

## Build and development tooling — not shipped

| Package | Version | License |
|---|---|---|
| TypeScript | 7.0.2 | Apache-2.0 |
| Vite | 8.2.2 | MIT |
| Vitest | 4.1.11 | MIT |

Their transitive dependencies are recorded in `package-lock.json` and are build-time only.

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
