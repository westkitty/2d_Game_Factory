# Workbench final acceptance

The acceptance gate for the Asset-Driven Game Factory Workbench, the corrective
product built on top of the accepted 12-phase SW2D core baseline
`f36350bee47d3e85e58be1672854895aab53e51d`.

**Every W item is PASS. Every F item is NO.**

Evidence is from real executed runs, not from reading the code. Where a claim
could be satisfied by the workbench agreeing with itself, the evidence comes
from the *running game's* own debug snapshot or from the file on disk instead.

---

## The decisive proof

The whole product reduces to one chain, and it is asserted end to end in a real
browser by `WB-IMAGE-001`:

```
workbench/fixtures/weasel.png            96x128, sha256 3735246b4afa6fb7…
  -> imported through the image-first flow
  -> mapped to the semantic role `player`
  -> chase-platformer generated through @sw2d/cli/factory's createGame
  -> npx vite build
  -> the real generated Phaser game running in system Chrome reports:
       scene              "sw2d.play"
       playerTextureKey   "wb/default/player/3735246b4afa"
       playerTextureWidth 96
```

Corroborated on disk, all four the same hash:

| Where | sha256 (first 16) |
|---|---|
| the fixture | `3735246b4afa6fb7` |
| `.sw2d/assets.json` record | `3735246b4afa6fb7` |
| `public/assets/workbench/src_da3f710bdddb3fc9.png` (what the game loads) | `3735246b4afa6fb7` |
| `.sw2d/source-assets/…` (the untouched source) | `3735246b4afa6fb7` |

The generated placeholder for `player` is 28px wide. The running game is
drawing 96px art whose key carries the imported image's own content hash.

---

## W01-W28

| Id | Item | State | Evidence |
|---|---|---|---|
| W01 | `npm run dev` launches the workbench | **PASS** | `npm run dev` prints `Stinky Weasel Game Factory Workbench / http://127.0.0.1:<port>`; the served page's `<title>` is `SW2D Workbench`. `WB-BOOT-001` asserts the home title renders and that neither `SW2D FOUNDATION` nor `phase 1 vertical slice` appears anywhere on the root route. |
| W02 | real project home with four primary actions | **PASS** | `WB-BOOT-001`: `["Make Something From an Image","Create From Assets","Open Existing Project","Browse Presets"]`, and the hero action asserted to be first in the DOM. |
| W03 | Import Inbox: single / multiple / drag-drop / folder | **PASS** | `WB-MULTI-001` imports 7 files in one action; `WB-BATCH-001` imports a 60-file pack. Folder intake uses `webkitdirectory`, drop intake walks `webkitGetAsEntry` directories, ZIP intake is expanded during staging. All four routes converge on one `ImportPlan` and one `commitImport`. |
| W04 | stable asset identity across rename / path change / reimport | **PASS** | `WB-REIMPORT-001`: id `src_da3f710bdddb3fc9` unchanged after the source's bytes, hash and dimensions all changed. Rename is asserted to disturb nothing. Ids are `src_`/`der_` + hash, never a path. |
| W05 | source preservation | **PASS** | `WB-DERIVE-001` takes four derivations and asserts the source file's sha256 is byte-identical afterwards. `recipe.test.ts` asserts the same for five recipes at the unit level. |
| W06 | deterministic, reproducible derivation recipes | **PASS** | `recipe.test.ts`: replaying a recipe twice produces byte-identical PNG output, and a replay through a PNG round trip equals the direct replay. `WB-DERIVE-001` asserts every derivative records `sourceAssetId` and a non-empty recipe. |
| W07 | Asset Lab crop / mask / component / slice / palette / variant | **PASS** | 39 transform unit tests cover crop, trim, scale (both resamplers), flip, rotate, edge-connected and global background removal, mask brushes, invert, grow/shrink/feather, connected components, grid slicing, outline, silhouette, tint, desaturate, palette and analysis. `WB-SHEET-001` drives slicing through the UI; `WB-DERIVE-001` drives trim, flip, outline and mask-shrink. |
| W08 | real non-destructive undo / redo | **PASS** | `WB-DERIVE-001` records 4 steps, undoes, redoes, and asserts the redone state matches the pre-undo state. Undo is a cursor into the recipe, so it survives dimension-changing steps. |
| W09 | bulk tolerance + duplicate detection | **PASS** | `WB-MULTI-001`: `walk_01`, `walk-2`, `walk0003`, `walk_04` - three different conventions - land in one group named `walk`; 2 duplicates are detected by content hash against the project and arrive unticked; a suggested role is manually overridden before commit and the override is what lands. |
| W10 | reimport regenerates derivatives without losing roles | **PASS** | `WB-REIMPORT-001`: role `player` retained, 1 derivative relinked with its recipe intact, and the file the game loads asserted byte-equal to the new source. |
| W11 | role changes alter the actual game mapping | **PASS** | Every role change, import-with-role, provenance change and reimport rewrites `content/themes/default/theme.json` before the endpoint returns. `WB-SHEET-001` assigns a sliced frame and asserts the assignment; `WB-REMIX-001` asserts the theme descriptor changed from `generated` to `image`. |
| W12 | theme synthesis from imported palette/assets | **PASS** | Assigned roles become `{ kind: 'image' }`; unassigned roles become `{ kind: 'generated' }` with fills spread from the project palette. Validated through `@sw2d/schemas` before write. Asserted in `WB-IMAGE-001` and `WB-REIMPORT-001`. |
| W13 | all 74 presets browsable with honest maturity | **PASS** | `GET /api/presets` returns 74, of which 5 report `rich-proof-kit`. Every card shows the catalogue's own `maturity` and the preset's own `knownLimitations` verbatim. |
| W14 | Game Seeds from one image, no false claims | **PASS** | `WB-SEED-001` asserts every seed has a real one-sentence loop, states its maturity, states either its known limitations or what its kit depth means, and shows role coverage - and that at most three are offered. Only proof- and smoke-validated presets are offered as seeds. |
| W15 | creation goes through the canonical generator | **PASS** | `createProject` calls `createGame` from `@sw2d/cli/factory`, the same function `sw2d new` now calls. No `spawn` of the CLI for generation. 812 CLI tests pass after the refactor. |
| W16 | **real browser proof: imported pixels drive the rendered game** | **PASS** | See *The decisive proof* above. |
| W17 | five rich proof starter kits | **PASS** | All five proof-validated presets have a kit. Verified in a real browser: the platformer jumps and collects against a designed 3-coin level; the shooter registers 5 enemies across 2 waves; tower-defense places a tower (100→60 currency) and kills 2 of 3 creeps; sokoban moves and correctly rejects a move into a wall; the idle sim accrues gold and completes a job. Zero console errors and zero external requests in all five. `starterKits.test.ts` asserts every kit resolves `player` through a role and never hard-codes a path. |
| W18 | Scene Composer edits a real level that validates | **PASS** | `WB-SCENE-001` moves a platform (`y 420 → 228`), moves a pickup, adds a Checkpoint from the palette, saves, and then plays the edited level - asserting the running game reaches `sw2d.play` and counts the collectibles the edited level declares. |
| W19 | hidden / overlapping objects selectable | **PASS** | `WB-OVERLAP-001` stacks three objects at one point and asserts: the object list selects the covered one, three repeated clicks at the same pixel cycle through 3 distinct objects, and hide works. |
| W20 | preview is the actual generated Phaser game | **PASS** | Both modes serve the real game: fast preview is the game's own `vite` dev server, production preview is a static server over a real build. The QA oracle reads `window.__SW2D__.snapshot()` *from inside the preview iframe*. There is no editor-side renderer in the product. |
| W21 | project state persists across reload / reopen | **PASS** | `WB-REOPEN-001`: active tab, 2 assets, preset and 13 role rows all restored after a full page reload. |
| W22 | remix: replace an asset in an existing generated project | **PASS** | `WB-REMIX-001` generates a project with the CLI's `createGame` (no workbench metadata), confirms the home card is flagged `adopt on open`, adopts it, swaps the player art through the role row, and asserts the theme moved from `generated` to a game-local `assets/workbench/…` image. |
| W23 | Validate / Build / Pack from UI buttons | **PASS** | `WB-BUILD-001` runs Validate and Pack from the top bar and asserts the job outcomes plus `index.html`, `RELEASE_MANIFEST.json`, `SHA256SUMS` and `THIRD_PARTY_NOTICES.txt` on disk - 6 files, all approved. |
| W24 | provenance gate remains authoritative | **PASS** | `WB-PROVENANCE-001`: an asset declared source-unknown is written `pending`, the status bar warns, Pack refuses and produces no release candidate; resolving the provenance through the inspector and re-packing succeeds. The CLI's `pack` gate is unmodified. |
| W25 | loopback-only host, narrow API | **PASS** | `WB-SECURITY-001` enumerates all 42 endpoints and asserts none is command- or path-shaped; no token → 401, wrong token → 401, foreign Origin → 403, absent Origin on a write → 403, five hostile game ids → 400/404, a traversal-shaped filename contained, four probe endpoints → 404, oversized body → 413. |
| W26 | offline normal workflow | **PASS** | No API key, account, credential or outbound request on any path. `npm run check:offline` passes on the starter build; `sw2d pack` runs the same guard over each release candidate. The optional `AssetGenerationProvider` interface exists with no provider shipped. |
| W27 | inherited SW2D regression ladder green | **PASS** | See the table below. |
| W28 | `npm run qa:workbench` passes | **PASS** | 16/16, twice from clean. |

---

## F01-F20

| Id | Failure condition | State | Why |
|---|---|---|---|
| F01 | `npm run dev` still opens SW2D FOUNDATION | **NO** | It opens the workbench; `WB-BOOT-001` asserts the foundation wording is absent. The slice is preserved at `npm run starter:dev` and still serves `SW2D Foundation Slice`. |
| F02 | workbench is a CLI launcher with no asset workflow | **NO** | Import Inbox, Asset Lab, Role Mapper, Scene Composer and Preview are the product; the CLI is a library call underneath. |
| F03 | import stores files but games still render placeholders | **NO** | This *was* true and was found by driving the product: importing into a role recorded the asset without rewriting the theme. Fixed, and now asserted by W16's texture-key binding. |
| F04 | one image cannot reach playable output | **NO** | `WB-IMAGE-001` is exactly that path, in one flow, ending in a playable build. |
| F05 | source image destructively overwritten | **NO** | Sources are written once under `.sw2d/source-assets/`; `WB-DERIVE-001` asserts the hash is unchanged after four derivations. |
| F06 | filenames / paths are fragile identity | **NO** | Identity is the frozen `id`; `WB-REIMPORT-001` changes bytes, hash, dimensions and name and asserts the id survives. |
| F07 | reimport breaks roles or derivative lineage | **NO** | Asserted retained, plus the shipped bytes replaced - a second bug found here, where an existence-only copy check left the previous image shipped under the same name. |
| F08 | creation bypasses the canonical generator | **NO** | One `createGame`, used by both `sw2d new` and the workbench. |
| F09 | preview is an editor mock | **NO** | Both preview modes are real servers; the QA oracle runs inside the game's own frame. |
| F10 | user must edit JSON for normal level refinement | **NO** | The Scene Composer covers move / resize / add / delete / duplicate / properties, validated before every write. |
| F11 | a foreground object makes covered objects unselectable | **NO** | `WB-OVERLAP-001` cycles 3 objects at one pixel, plus list selection and hide/lock. |
| F12 | browser can execute arbitrary shell commands | **NO** | No such endpoint exists; asserted by enumeration. Every subprocess uses a fixed executable, an argument array and `shell: false`. |
| F13 | workbench can read/write arbitrary machine paths | **NO** | No endpoint takes a path. Every path is derived from a validated id through `resolveContained`. |
| F14 | provenance / release gate bypassable | **NO** | `WB-PROVENANCE-001`. The CLI's gate is untouched; the workbench only records the truth into the manifest. |
| F15 | recipe-only presets presented as equally proven | **NO** | Maturity and kit depth are shown verbatim on every card and seed; `starterKits.test.ts` asserts a recipe preset reports `generated-shell`. Seeds are drawn only from proof- and smoke-validated presets. |
| F16 | required workflow needs cloud / key / account / credits | **NO** | None exists anywhere in the product. |
| F17 | large import has unbounded concurrency or all-in-memory behaviour | **NO** | `WB-BATCH-001` measures a peak of 3 concurrent uploads against a cap of 3 over 60 files. Staged bytes go straight to disk; thumbnails are lazy with a bounded cache. |
| F18 | inherited regression suites removed, weakened or failing | **NO** | No test was deleted or weakened. 1787 inherited tests still pass, and the whole ladder is green. |
| F19 | normal Validate / Build / Pack still requires the terminal | **NO** | All three are top-bar buttons with visible job state; `WB-BUILD-001` drives them. |
| F20 | completion claimed without a real browser proof | **NO** | W16 binds the rendered texture to the fixture's own content hash. |

---

## Regression ladder

| Command | Inherited baseline | Now |
|---|---|---|
| `npm run validate` | PASS | **PASS** |
| `npm run test` | 1787/1787 | **1900/1900** (1787 inherited + 113 workbench) |
| `npm run qa:smoke` | 14/14 | **14/14** |
| `npm run qa:proof` | 5/5 | **5/5** |
| `npm run qa:responsive` | 19/19 | **19/19** |
| `npm run release:verify` | 6/6 | **PASS, all controller-shell families** |
| `npm run qa:matrix` | 40/40 | **40/40** |
| `npm run qa:workbench` | — | **16/16** |

---

## Shared code that was changed, and why

The workbench is a product layer, but three shared surfaces were touched. Each
is additive and each is covered by the inherited suites, which stayed green.

1. **`packages/cli/src/factory.ts` (new)** plus a `./factory` export subpath.
   The canonical generation seam, so the CLI and the workbench cannot become
   two factories. `commands/new.ts` is now a thin wrapper over it.
2. **`vitest.config.ts` / `tsconfig.json`** - `workbench/**` added to the
   include lists.
3. **root `package.json`** - `dev` now points at the workbench;
   `starter:dev`, `workbench:*` and `qa:workbench` added; `workbench` added to
   the workspace list.

No runtime package, schema, pack, preset, demo or proof was modified.

---

## Honest remaining limitations

These are real and are not claimed to be solved:

- **Animation playback is not implemented.** Frame groups are detected and
  recorded; the runtime draws one representative frame per role, with
  procedural motion (facing flip, idle bob, lean, squash, hit flash) supplying
  the life. A sprite-sheet animation system was deliberately not built - it
  would have destabilised the core for a benefit the asset-to-game workflow
  does not need.
- **JPEG and WebP are decoded only in the browser.** The host stores their
  bytes verbatim; a derivative of one is rebuilt by the workbench client rather
  than headlessly. PNG has a full host-side codec.
- **Background removal is colour-based, not semantic.** It is described that
  way throughout.
- **Rich starter kits exist for 5 of 74 presets.** The other 69 get the
  canonical generated shell, and every surface says so.
- **The Scene Composer is not a Tiled replacement.** It edits the supported
  object-class subset; it does not author tile layers.
- **Interlaced (Adam7) PNGs are refused** by the host decoder with a message
  saying so.
- **No performance or wall-clock claim is made.** The concurrency evidence is a
  measured cap, not a benchmark, and the QA harness uses deterministic frame
  stepping throughout.
- **Real-device touch is still unverified**, as in the inherited baseline. The
  responsive journey uses viewport emulation.
