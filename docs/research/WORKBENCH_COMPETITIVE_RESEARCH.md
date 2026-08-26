# Workbench competitive research

**Scope.** A bounded research pass taken *before* the Asset-Driven Game Factory Workbench
architecture was frozen. Its purpose is to buy the workbench other people's already-paid-for
mistakes, not to copy anyone's product.

**Method.** The prompt-supplied research baseline was checked against current public
documentation and public user reports for each named project (August 2026). Where a live source
confirmed or sharpened a baseline claim it is cited inline. Where no live source was consulted
the row is marked *(baseline)* and is treated as a design hypothesis, not a verified fact.

**What was deliberately *not* done.** No proprietary code was read or copied. No UI was cloned
pixel-for-pixel. No copyrighted example content, art or layout entered this repository. What was
extracted is workflow shape and failure-avoidance patterns - the kind of thing a person learns by
using a tool and can describe in their own words.

---

## 1. The lesson table

| Project | What it does well | Pain / failure observed | Lesson adopted in SW2D Workbench | What we deliberately reject |
|---|---|---|---|---|
| **GDevelop** | Visual resource library with folders, search and reusable object definitions; engine/editor/core are separate concerns, so the editor is not the runtime. | Frame-by-frame import was slow enough that bulk import became an explicit feature request, and the work had to cope with the fact that *"artists are not always following naming rules, or their animation software exports with different naming conventions"* ([issue #4987](https://github.com/4ian/GDevelop/issues/4987)). Path-shaped resource identity makes reimport fragile. | **P02** stable project-local asset IDs (never the filename). **P06** bulk import is the default path, not a power feature. **P07** naming conventions are *hints* - `walk_01`, `walk-2`, `walk0003`, `player_idle_0` all group, none is required. Searchable library with folders and persistent panel state. | Path-as-identity. A secret required naming convention. Hiding reimport state from the user. Editor complexity with no progressive disclosure. |
| **Construct 3** | Drag/drop is a *primary* workflow, not a shortcut. The animations editor imports individual frames, many files, sprite strips, folders and zips - *"as of r252 support for importing animation frames from zip files and folders has been implemented"* ([Animations Editor manual](https://www.construct.net/en/make-games/manuals/construct-3/interface/animations-editor)). Dropping an image into a layout yields a usable object immediately. | The same conceptual operation reachable from several unrelated places drifts apart unless the underlying logic is shared. | **Import Inbox** accepts file picker, multi-select, drag/drop, folder drop and bounded ZIP. Sprite-strip slicing is first-class. One image → one usable game object in one action. Every intake route funnels into **one** `stageImport` → `commitImport` transaction. | Many import semantics that a user cannot predict. Duplicated import logic per entry point. |
| **Phaser Editor 2D** | The Asset Pack Editor edits a *Phaser-native* asset format rather than an editor-private one; the scene editor *"compiles the scene into readable Phaser code... compatible with any Phaser game"* ([scene compiler docs](https://docs.phaser.io/phaser-editor/scene-editor/scene-compiler)); prefabs make reusable objects visual while staying ordinary code. | Where an editor *does* keep a custom scene format, the compile step becomes the load-bearing contract that must never silently break. | **P08** the workbench writes existing SW2D-native documents only - `content/themes/**/theme.json`, `content/levels/*.json` (Tiled-shaped), `content/game.json`, `resources/RESOURCE_MANIFEST.json`. Editor-only metadata is confined to `.sw2d/` and **no runtime path reads it**. Proof-derived starter kits play the role of bounded prefabs. | A workbench-private runtime format. Any lock-in that makes a generated game unusable without the workbench. |
| **Godot** | Source assets and imported/derived representations are separated, and reimport is a real, supported operation. | Hidden/fragile import state is a recurring frustration, and large packs can exhaust memory - a user deleted `.import` files to force a reimport and *"could no longer open their project because it kept reimporting assets until all available RAM was consumed"* ([issue #101860](https://github.com/godotengine/godot/issues/101860)). Fresh checkouts re-importing everything is a well-known papercut. | **P01** source is immutable. **P03** every derivative records `sourceAssetId` + recipe + params + hash. **P04** reimport is a first-class journey that preserves IDs and role assignments. Derived output is a **disposable, rebuildable cache**. Bounded decode/transform concurrency, lazy thumbnails, progress + cancellation. | Hidden generated state. Broken source links. Silent duplicate derivatives. Unbounded import concurrency. Loading a whole pack into memory because it exists. |
| **microStudio** | Sprite editing, map editing, code and a *running* game live in one browser workspace; changes show up in the running project quickly; the standalone edition proves an offline-capable integrated workflow; public projects are explorable and remixable. | Cloud/account coupling is a real dependency risk for anyone who needs to work offline. | **Asset Lab + Scene Composer + Preview in one workbench**, side by side. Fast Preview with debounce. Proofs/demos are remixable starter material. | Cloud storage or account dependence anywhere on the required path. |
| **ct.js** | A modular JS engine under a visual IDE, with a vocabulary that stays understandable: textures, reusable templates, placed instances, rooms. The room editor is direct manipulation, not raw JSON. | Exposing engine internals just because the engine is JavaScript makes the tool harder, not more powerful. | Plain vocabulary in the UI: **source asset / derived asset / role / seed / scene**. Direct manipulation of scene objects. Reusable starter-kit objects. | Surfacing runtime internals in the primary UI. |
| **LDtk** (and data-driven level editors generally) | Explicit entity definitions, layer definitions, stable IDs and a clean exported data format make the editor interoperable with any runtime. Strong schemas beat opaque editor state. | A scene format only the editor understands strands the data. | Scene Composer edits the **already-validated SW2D level model** and re-validates before every write. Semantic entity classes stay explicit. Object IDs are stable across saves. Layers/hierarchy map to real exported data. | A level format only the workbench can read. |
| **Rosebud AI / Buildbox-style AI workflows** | The strongest lesson is *input → playable output, fast*. Image upload / template choice is presented up front, not behind engine setup. Asset work stays next to the running game. Results can be revised after first synthesis. Visible activity logs make long generation legible. Role vocabulary (character / background / object) is immediately readable. | Cloud, account, credit and hidden proprietary generation are hard dependencies dressed up as convenience. | **"Make Something From an Image"** is the highest-salience home action. One click → real playable draft → then refine. Visible job/activity progress. Role vocabulary throughout. An `AssetGenerationProvider` interface exists so an optional provider can be added later without redesigning the project model. | Required cloud, account, API key, credits, or automatic upload of the user's assets. Any of these on the required path. |

---

## 2. The asset-swap lesson

The single most repeated request from artists and educators across all of these communities is not a
feature; it is a *shape*:

```
replace the art  ->  the game uses the new art
```

SW2D already resolves gameplay art through semantic roles (`context.assets.resolve('player')`), so
this is a *mapping* change, not a code change. The workbench therefore treats asset swapping as one
of the cheapest operations in the product: pick a role, pick an asset, the generated game's
`content/themes/default/theme.json` is rewritten and the preview reloads. Acceptance item **W22**
exists purely to keep that true.

---

## 3. Where this research changed the plan

Three concrete architecture decisions came out of this pass rather than out of the initial sketch:

1. **Derived assets are a cache, not a source of truth.** Godot's reimport pain is what forced
   `.sw2d/source-assets/` to be immutable and `public/assets/workbench/` to be regenerable from
   `(source, recipe)`. Deleting every derived file must be recoverable, never fatal.
2. **One import transaction, many intake routes.** Construct's breadth of import entry points is
   worth copying; its risk (divergent semantics per entry point) is avoided by making every route
   produce the same `ImportPlan` and go through the same `commitImport`.
3. **The workbench must never own the runtime format.** Phaser Editor's compile step and LDtk's
   exported-data discipline both point the same way, and SW2D already has validated native
   documents. The workbench writes those and nothing else; `.sw2d/` is metadata the runtime never
   reads. This is what failure-condition **F09**/**F10** and acceptance **W18**/**W20** enforce.

---

## Sources

- [Bulk import animations and frames · Issue #4987 · 4ian/GDevelop](https://github.com/4ian/GDevelop/issues/4987)
- [GDevelop asset packaging technical specifications](https://wiki.gdevelop.io/gdevelop5/community/contribute-to-the-assets-store/technical-specifications/)
- [The Animations Editor - Construct 3 Documentation](https://www.construct.net/en/make-games/manuals/construct-3/interface/animations-editor)
- [Phaser Editor 2D - Asset Pack Editor](https://phaser.io/editor/docs/asset-pack-editor/index)
- [Phaser Editor 2D - The scene compiler](https://docs.phaser.io/phaser-editor/scene-editor/scene-compiler)
- [Phaser Editor 2D - Prefabs](https://help-v3.phasereditor2d.com/scene-editor/prefabs.html)
- [Memory starvation while (re)importing assets · Issue #101860 · godotengine/godot](https://github.com/godotengine/godot/issues/101860)
- [Godot import process documentation](https://docs.godotengine.org/en/3.1/getting_started/workflow/assets/import_process.html)
