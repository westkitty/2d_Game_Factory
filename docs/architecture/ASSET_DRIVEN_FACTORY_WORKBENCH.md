# Asset-Driven Game Factory Workbench - architecture

**Status:** corrective product built on top of the accepted 12-phase SW2D core baseline
`f36350bee47d3e85e58be1672854895aab53e51d`. The engine, packs, presets, CLI, schemas and QA
harness are *not* rebuilt. This document describes only the product layer that was missing.

**Companion documents:** [`../research/WORKBENCH_COMPETITIVE_RESEARCH.md`](../research/WORKBENCH_COMPETITIVE_RESEARCH.md)
(why these decisions), [`../../WORKBENCH_OPERATIONAL_STATE.md`](../../WORKBENCH_OPERATIONAL_STATE.md)
(what is verified right now), [`WORKBENCH_FINAL_ACCEPTANCE.md`](WORKBENCH_FINAL_ACCEPTANCE.md)
(the W01-W28 / F01-F20 gate).

---

## 1. The correction

The 12-phase project built a real, working 2D game machine. What it did not build is the
user-facing product that machine exists to serve. Running `npm run dev` opened
`SW2D FOUNDATION / phase 1 vertical slice` - the engine's own proof, not a factory.

The product thesis:

> A local-first visual 2D game factory that can ingest an image or asset set, turn it into
> game-ready material, synthesize a real SW2D game around it, let the user visually refine the
> result, preview the actual generated game, and build/package it without dropping to a terminal.

The decisive proof is a chain, not a feature list:

```
user-owned image -> imported -> derived -> assigned to a semantic role
  -> canonical game generated -> real generated Phaser game runs
  -> the imported pixels are what the game draws
```

Acceptance item **W16** is exactly that chain, asserted in a real browser.

---

## 2. Design principles (frozen after the research pass)

| # | Principle | Enforced by |
|---|---|---|
| P01 | **Source is sacred.** An imported source image is never destructively overwritten. | `assetStore` writes source bytes once under a content-addressed name; every mutation path is derive-only. Test: `source hash unchanged after N derivations`. |
| P02 | **Identity is not a filename.** Every asset has a stable project-local id; display name, path and hash are metadata. | `AssetRecord.id` (`src_*` / `der_*`), never a path. Roles and recipes reference ids. |
| P03 | **Every derivative is reproducible.** `sourceAssetId` + ordered recipe + params + output hash. | `TransformRecipe`, replayed by the shared pure transform core. |
| P04 | **Reimport is first-class.** Changed source -> stale derivatives -> rebuild -> preview, with ids and role assignments intact. | `POST /api/assets/reimport`, `staleDerivedIds`, `WB-REIMPORT-001`. |
| P05 | **Import is staged.** Inbox -> analyze -> dedupe -> suggest -> user corrects -> commit transaction. | `stageImport` / `commitImport`; nothing enters the project on analysis alone. |
| P06 | **Bulk means bulk.** No frame-by-frame import. | Multi-file, folder and ZIP intake through one plan. |
| P07 | **Naming conventions are hints.** `walk_01`, `walk-2`, `walk0003`, `player_idle_0` all group; none is required. | `groupByNameHeuristic`, tolerant tokenizer + numeric-suffix detection. |
| P08 | **The workbench writes native SW2D data.** | Only `content/**`, `themes/**`, `public/**`, `resources/**`, `src/game-specific/**` are written. `.sw2d/` is metadata **no runtime path reads**. |
| P09 | **Editing and running are side by side.** | Asset Lab / Scene Composer / Preview in one shell. |
| P10 | **Fast first result, deep refinement second.** | Game Seeds -> playable draft in one action; advanced controls after. |
| P11 | **Honest maturity.** Recipe-only presets are never dressed as proven genre kits. | Maturity badge + starter-kit depth on every preset card and every seed. |
| P12 | **Local-first is architectural.** | Loopback bind, no API key, no account, no upload, no telemetry, no CDN. `check:offline` + `WB-SECURITY-001`. |

---

## 3. System shape

```
                      ┌──────────────────────────────────────────────┐
   browser (UI)       │  workbench/src   TypeScript + DOM + Canvas   │
                      │  Home · Import Inbox · Asset Lab ·           │
                      │  Role Mapper · Scene Composer · Preview      │
                      └───────────────┬──────────────────────────────┘
                                      │ same-origin fetch + session token
                      ┌───────────────▼──────────────────────────────┐
   node host          │  workbench/server   127.0.0.1 only           │
                      │  security · api · jobManager · projectStore  │
                      │  assetStore · factoryService · themeSynthesis│
                      │  sceneStore · previewManager · starterKits   │
                      └───────────────┬──────────────────────────────┘
                                      │ direct library calls (not spawn)
                      ┌───────────────▼──────────────────────────────┐
   existing machine   │  @sw2d/presets  @sw2d/cli generator          │
                      │  @sw2d/schemas  @sw2d/content-pipeline       │
                      │  @sw2d/qa  (+ npx vite / tsc as subprocesses)│
                      └──────────────────────────────────────────────┘

   workbench/shared/  pure TS used by BOTH sides: transform core, recipes,
                      palette, grouping heuristics, asset-record types.
```

### 3.1 Why one workspace, not a package fan-out

`workbench/` is a single npm workspace (`@sw2d/workbench`). Splitting it into five packages would
add resolution and build surface without buying isolation that matters here - the server, UI and
shared core ship together, version together, and are consumed by nothing else. `shared/` is a
directory, not a package, for the same reason.

### 3.2 Why plain TypeScript + DOM, not React/Vue/Svelte

The repository has zero UI-framework dependencies today and a resource policy that prefers
removable dependencies and forbids anything that would drag a runtime into a game build. Nothing in
this product's UI - a three-pane shell, a canvas editor, a list, a form - is materially cheaper in a
framework than in ~150 lines of a small reactive store plus direct DOM. Adding a framework would be
a policy event (new dependency, new licence record, new bundle) with no risk reduction to show for
it, so it was not done. Vite (already a dependency) provides dev server, HMR and the production
build.

### 3.3 The one non-obvious decision: where pixels are processed

Node has no image codec in this repository and the resource policy discourages adding one. The
workbench therefore splits image work:

- **Shared pure core** (`workbench/shared/image/`) operates on
  `{ width, height, data: Uint8ClampedArray /* RGBA */ }`. No DOM, no Node APIs. Every transform -
  crop, trim, scale, flip, rotate, background removal, mask ops, component extraction, grid slicing,
  palette extraction, variants - lives here as a pure function.
- **The browser** feeds that core from `CanvasRenderingContext2D.getImageData` and writes results
  back through a canvas, which is also where PNG encoding happens (`canvas.toBlob`).
- **The host** feeds the *same* core from a dependency-free pure-TS PNG decoder
  (`workbench/server/png.ts`, built on `node:zlib`) and encodes with the matching pure-TS encoder.

The payoff is that recipe replay is testable headlessly in vitest against the identical code path
the UI uses, and reimport does not require the browser to be open. JPEG/WebP sources are decoded by
the browser only; the host stores their bytes verbatim and derives through the browser. This is
stated plainly rather than implied, because it is the one place the architecture is asymmetric.

---

## 4. Local host security model

The browser is being handed local authority, so the host is the security boundary.

| Control | Implementation |
|---|---|
| Bind address | `127.0.0.1` only. `0.0.0.0` is never a default and is not reachable through configuration in the shipped scripts. |
| Origin / Host | Every non-GET request must carry an `Origin` whose host is `127.0.0.1` or `localhost` **and** match the server's own host header. Anything else -> `403`. |
| Session token | A 32-byte random token minted per host process, injected into the served HTML, required as `x-sw2d-session` on every `/api/**` request. Cross-origin pages cannot read it. |
| Body limits | JSON `2 MiB`; single upload `24 MiB`; batch upload `96 MiB`; ZIP expanded total `192 MiB`, `2000` entries, `24 MiB` per entry. |
| Path containment | Every filesystem path is derived through `resolveContained(root, ...segments)` which re-derives containment from the *resolved* path. There is no endpoint that takes a caller-supplied absolute path. |
| Slug validation | Game ids reuse the CLI's `assertValidSlug`. Asset ids match `^(src|der)_[a-f0-9]{16}$`. |
| Filename normalization | Uploaded names are normalized to `[a-z0-9._-]`, stripped of separators and leading dots, length-capped. The stored path is content-addressed, so a hostile display name never becomes a path. |
| Process execution | Fixed executable + argument array + `shell: false` + a working directory inside the repository. No browser input reaches an argv position that is not a validated slug or a fixed literal. |
| Absent by design | No generic shell endpoint. No arbitrary-path read/write endpoint. No `eval`. No dynamic remote code. No telemetry. No analytics. No credential. |

The narrow capability list is: health, presets, projects (list/create/open/adopt), import
(stage/commit), assets (derive/reimport/delete), roles, theme synthesis, scene (load/save),
preview (start/refresh/stop), validate, build, pack, jobs (status/cancel), reveal.

---

## 5. Project format

A generated SW2D game *is* the project. Workbench state lives beside it and is never shipped.

```
games/<game-id>/
├── .sw2d/                        workbench metadata (never in dist/ or pack/)
│   ├── project.json              { version, gameId, presetId, panels, seedId, adopted }
│   ├── assets.json               { version, assets: AssetRecord[] }
│   ├── blueprint.json            { version, roleAssignments, palette, seed }
│   ├── imports.json              { version, batches: ImportBatch[] }
│   ├── cache/                    disposable thumbnails
│   └── source-assets/            immutable imported originals
├── public/assets/workbench/      derived, game-local, same-origin runtime assets
├── content/                      game.json · tuning.json · themes/** · levels/**
├── resources/RESOURCE_MANIFEST.json
├── src/game-specific/            starter-kit / shell code
└── ...                           the rest of the canonical generated game
```

Every metadata document carries `version`. Writes are atomic (`write temp -> fsync -> rename`), so
a crash mid-save cannot leave half-JSON. `.sw2d/` is excluded from `dist/` by Vite (it is not under
`public/`) and from `pack/` (which copies `dist/` only).

### 5.1 Asset record

```ts
interface AssetRecord {
  id: string;                    // src_<16 hex> | der_<16 hex>   P02
  kind: 'source' | 'derived';
  displayName: string;
  relativePath: string;          // project-relative, never absolute   P02
  mime: string;
  width: number; height: number; byteSize: number;
  sha256: string;
  sourceAssetId?: string;        // derived only                        P03
  transformRecipe?: TransformRecipe;
  roleAssignments: AssetRole[];
  palette?: string[];
  provenance: Provenance;
  stale?: boolean;               // source changed, derivative not rebuilt   P04
  group?: string;                // animation/frame group hint             P07
}
```

`id` is derived from the *first* content hash plus an ordinal, then frozen. Reimporting new bytes
changes `sha256` and `relativePath` but never `id` - that is what makes **W04** and **P04** true.

---

## 6. The synthesis path (W15/W16)

```
Role assignments + palette
   -> themeSynthesis: build ThemeManifest
        assigned roles     -> { kind: 'image', url: 'assets/workbench/<file>' }
        unassigned roles   -> { kind: 'generated', ... } derived from the palette
   -> validateDocumentOrThrow('theme-manifest', ...)        [ existing @sw2d/schemas ]
   -> write content/themes/default/theme.json
   -> copy derived bytes to public/assets/workbench/
   -> update resources/RESOURCE_MANIFEST.json from provenance
```

At runtime, `BootScene` already calls `queueImageAssets`, which queues every `kind: 'image'`
descriptor onto Phaser's loader. Nothing in the runtime changes. The workbench's entire contribution
to the running game is *data the runtime already knew how to consume* - which is precisely why this
is a product layer and not an engine fork.

Game creation itself goes through `buildGameFiles(gameId, preset)` from
`packages/cli/src/generator/generate.ts` - the same pure function `sw2d new` calls. The workbench
does not `spawn('npm', ['run', 'sw2d', ...])` for generation. Subprocesses remain only where the
work genuinely *is* a process: `npx vite build`, `npx tsc`, `npx vitest`.

### 6.1 Starter kits

A bare generated shell is not a game. Five proof-validated presets get reusable starter kits
overlaid on top of the canonical generation, touching only legitimate game surfaces:
`content/**`, `themes/**`, `src/game-specific/**`. Shared runtime packages are never copied and the
committed `proofs/` are never edited. `starterKits.ts` asserts the containment rule mechanically -
an overlay that names a path outside those three roots fails a unit test.

---

## 7. Scene Composer

The Composer edits the **normalized SW2D level document**, round-tripped through the same
Tiled-shaped `content/levels/main.json` a generated game already ships. It is not a Tiled
replacement: it supports the Phase 6 object-class subset (ADR-0014) - `Solid`, `PlayerSpawn`,
`Checkpoint`, `Collectible`, `Hazard`, `Exit` - plus pan/zoom/grid/snap, select, multi-select, move,
resize, duplicate, delete, add-from-palette, and basic property edit.

Two things make it honest rather than decorative:

1. **It validates before it writes.** Every save normalizes through
   `@sw2d/content-pipeline`'s `normalizeTiledMap` and validates through `@sw2d/schemas` before the
   file is replaced. An invalid edit is refused, not persisted.
2. **Covered objects stay selectable.** An object list with search, per-layer hide/lock, and
   click-cycling through overlapping hits at the same point. A full-screen background object can
   never make the object behind it unreachable (**W19** / **F11**).

Object ids are stable across saves so role assignments, selections and undo history survive.

---

## 8. Preview

| | Fast Preview | Production Preview |
|---|---|---|
| Server | the generated game's own `vite` dev server | `npx vite build` then a static server |
| Trigger | debounced asset/theme/scene change | explicit action, and before Validate/Pack |
| Purpose | tight iteration | what final validation relies on |

Both run **the real generated Phaser game**. There is no editor-side mock renderer anywhere in the
product; the preview pane is an `<iframe>` pointed at a real server (**F09**).

`previewManager` binds loopback only, takes an OS-assigned port, tracks every child process, kills
them on host shutdown, and stamps each build with a monotonically increasing generation so a slow
stale build can never overwrite newer preview state.

---

## 9. Jobs

Import, derive-batch, reimport, create-game, validate, build, pack and preview-rebuild are all
`Job`s: `queued -> running -> (completed | failed | cancelled)` with a step label, optional
progress, concise log lines, and a cancel flag safe operations poll. The status bar shows the
active job; the Activity panel shows history. Raw subprocess output is available but is never the
primary interface.

---

## 10. Memory and performance budget

Target: a MacBook Air M1 / 8 GB.

- Thumbnails are generated lazily on first view and cached in `.sw2d/cache/`.
- Decode / hash / transform concurrency is capped (default 3, `IMPORT_CONCURRENCY`).
- Full-resolution decodes are disposed (`ImageBitmap.close()`, canvas sized to 0) immediately.
- Batch import streams file-by-file; the whole pack is never materialized as decoded pixels.
- Every long operation reports progress and safe ones are cancellable.
- Caches are disposable: deleting `.sw2d/cache/` or `public/assets/workbench/` is always recoverable
  by replaying recipes.

Limit enforcement is unit-tested. A committed fixture pack exercises the batch path. **This is not a
performance benchmark and no wall-clock claim is made** - it is a structural guarantee that the
all-at-once shape is absent.

---

## 11. Optional AI provider - architected for, not depended on

```ts
interface AssetGenerationProvider {
  readonly id: string;
  readonly capabilities: readonly AssetGenerationCapability[];
  available(): Promise<boolean>;
  generate(request: AssetGenerationRequest): Promise<GeneratedAsset[]>;
}
```

No provider ships. What ships is the request/response shape plus **export a generation request** and
**import a returned generated asset**, so a future provider does not force a project-model redesign.
The core workflow requires zero API key, zero account, zero network, zero credits (**W26**).

---

## 12. Root command experience

| Command | What it does |
|---|---|
| `npm run dev` | **the workbench** |
| `npm run workbench:dev` | the same thing, explicitly named |
| `npm run workbench:build` | production build of the workbench UI |
| `npm run workbench:test` | workbench unit + integration tests |
| `npm run qa:workbench` | repeatable real-browser workbench journeys |
| `npm run starter:dev` | the Phase 1 foundation slice, preserved as engine evidence |

The foundation slice is not deleted or hidden - it is relabelled as what it always was: the
engine's own vertical-slice proof, reachable by a developer command.
