# Getting started with the workbench

```bash
npm install
npm run dev
```

Open the URL it prints. Everything runs on your machine: no account, no API
key, no upload, no network.

---

## The four things on the home screen

### Make Something From an Image

The fastest route. Drop in one image you already have - a character cut-out, a
background, a sprite sheet - and the workbench:

1. reads it (size, transparency, palette, whether it looks like pixel art);
2. asks **what it is**, because a background and a character are not the same
   kind of source and pretending otherwise is how a tool ends up stretching a
   photo across a 28px player sprite;
3. offers up to three **Game Seeds** - real playable directions, each showing
   its honest maturity, what your image covers, and what will fall back to
   generated art;
4. builds the one you pick, maps your image onto the right semantic role, and
   drops you in the editor with a game you can press Preview on.

Only presets with a proof kit or a committed smoke-tested demo behind them are
offered as seeds. Everything else is still one click away in the preset
browser, labelled for what it is.

### Create From Assets

Name a project and pick a preset first, then bring your art in. Use this when
you already know the genre, or when you are starting from a folder rather than
a single image.

### Open Existing Project

Reopens anything under `games/`, including projects made with the CLI. A
project the workbench has not seen before is marked **adopt on open**: opening
it reads the preset from `package.json` and the palette from the existing
theme, and writes workbench metadata into `.sw2d/` without touching a single
game file.

### Browse Presets

All 74 genre recipes with their real maturity, required packs, required
content and known limitations. Nothing on that page is dressed up - see
[the honesty note](#a-note-on-honesty) below.

---

## The editor

```
┌────────────────────────────────────────────────────────────────────┐
│ SW2D Workbench │ project │ Import  Re-theme │ Preview Validate ... │
├───────────┬────────────────────────────────────────┬───────────────┤
│ Assets    │ Asset Lab │ Scene │ Preview           │ Inspector      │
│           │                                        │                │
│ search    │  the working surface                   │ role coverage  │
│ folders   │                                        │ palette        │
│ thumbs    │                                        │ asset details  │
│ roles     │                                        │ provenance     │
├───────────┴────────────────────────────────────────┴───────────────┤
│ ● Idle │ 12 assets │ fast preview running │ local only │ Activity ▸│
└────────────────────────────────────────────────────────────────────┘
```

- **Assets** (left) - everything you have imported or derived. Search, folders,
  grid or list, role badges, and a `stale` badge on any derivative whose source
  has changed since it was made.
- **Asset Lab / Scene / Preview** (centre) - see
  [ASSET_LAB.md](ASSET_LAB.md) and [SCENE_COMPOSER.md](SCENE_COMPOSER.md).
- **Inspector** (right) - the **Role Mapper** at the top is the important part:
  it is the actual mapping from semantic role to asset that the game will draw.
  Changing anything here rewrites the game's theme immediately.
- **Status bar** - what is running, whether provenance is blocking a release,
  and the Activity panel.

Panel widths, the collapsed state, grid/list mode and the active tab are all
remembered per project.

---

## From art to a release, without a terminal

| Action | What actually happens |
|---|---|
| **Import** | Files are staged, analysed and shown as a plan you can correct. Nothing enters the project until you press Import. |
| **Assign a role** | `content/themes/default/theme.json` is rewritten and the file is copied into the game's own `public/assets/workbench/`. |
| **Preview** | Fast preview runs the game's own dev server; production preview serves a real build. Both are the real generated Phaser game. |
| **Validate** | Schema and unit tests, TypeScript, production build - the same ladder `sw2d validate` runs. |
| **Build** | `vite build` into the game's `dist/`. |
| **Pack** | The CLI's own release packer: a clean static build, `RELEASE_MANIFEST.json`, `SHA256SUMS`, `THIRD_PARTY_NOTICES.txt`, and an offline guard. |
| **Reveal** | Opens the project (or its `pack/`) in your file browser. |

---

## Keyboard

| Key | Where | Does |
|---|---|---|
| <kbd>Cmd/Ctrl</kbd>+<kbd>Z</kbd> | Asset Lab | Undo the last edit |
| <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Asset Lab | Redo |
| Arrow keys | Scene | Nudge the selection 1px |
| <kbd>Shift</kbd>+arrows | Scene | Nudge by one tile |
| <kbd>Cmd/Ctrl</kbd>+<kbd>D</kbd> | Scene | Duplicate the selection |
| <kbd>Delete</kbd> | Scene | Delete the selection |
| <kbd>Shift</kbd>+drag | Scene | Pan |
| <kbd>Alt</kbd>+drag | Scene | Move without snapping |
| <kbd>Esc</kbd> | Any dialog | Close |

---

## A note on honesty

The workbench never upgrades a preset's presentation. A `recipe` preset is a
working composition - it boots, installs its packs and takes input - but the
genre mechanics are yours to write, and the card says so. Five presets are
`proof-validated` and have a rich starter kit here: **chase-platformer**,
**twin-stick-shooter**, **tower-defense**, **sokoban** and
**idle-incremental**. Those give you a designed level and real mechanics with
your art wired in.

Likewise, a role with no asset is labelled `auto` and draws generated art built
from your palette - the game is always playable, and you can always see which
parts are yours.

---

## Other commands

```bash
npm run dev              # the workbench
npm run workbench:build  # production build of the workbench UI
npm run workbench:start  # serve that build instead of the dev server
npm run workbench:test   # workbench unit tests
npm run qa:workbench     # the real-browser workbench journeys
npm run starter:dev      # the Phase 1 foundation slice (engine evidence)
```

The `sw2d` CLI still exists and is still canonical - the workbench calls the
same generator. See [`../cli/CLI_REFERENCE.md`](../cli/CLI_REFERENCE.md).
