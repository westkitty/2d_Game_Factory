# The Scene Composer

The Composer edits your game's real `content/levels/<id>.json` - the same
Tiled-shaped document the running game loads. There is no workbench-private
level format, so a project edited here stays editable in Tiled, in a text
editor, or with `sw2d add-level`.

It is **not** a Tiled replacement. It supports the semantic object-class subset
the content pipeline understands, and it is meant for the thing you actually do
most: moving the level around until it plays right.

---

## Editing

| Action | How |
|---|---|
| Pan | <kbd>Shift</kbd>+drag, or middle-drag |
| Zoom | Scroll wheel, **Fit** to frame the level |
| Select | Click, or click a row in the object list |
| Multi-select | <kbd>Cmd/Ctrl</kbd>+click |
| Move | Drag (snaps to half a tile), or arrow keys |
| Move by a tile | <kbd>Shift</kbd>+arrows |
| Move freely | <kbd>Alt</kbd>+drag |
| Resize | The Width/Height fields in the property editor |
| Duplicate | <kbd>Cmd/Ctrl</kbd>+<kbd>D</kbd>, or **Duplicate** |
| Delete | <kbd>Delete</kbd>, or **Delete** |
| Add | **Add…**, then pick a class |

Adding an object fills every required property with a valid default derived
from its new id, so the level still validates the moment it appears.

---

## Covered objects stay reachable

A full-screen background object must never make the platform behind it
unselectable. Three things guarantee that:

1. **The object list** is a first-class selection surface, with search. It
   always reaches everything.
2. **Clicking the same point cycles the stack.** Hits are ordered
   smallest-first, because a small object on top of a large one is exactly the
   case where "topmost wins" is the wrong answer.
3. **Hide and lock** are one click per row. A hidden object is not drawn; a
   locked one is drawn dimmed and is not hit-testable or movable.

Drawing order is largest-first, so small objects render on top and are visible
even when they sit inside a big one.

---

## Validation happens before the write

Every save runs three gates in order:

1. object ids are unique integers, and every class is one the pipeline knows;
2. the document normalises through `@sw2d/content-pipeline`;
3. the normalised result passes the level-document schema.

Only then is the file replaced, atomically. An edit that would not load is
**refused, not persisted** - the file on disk stays the last good one, and the
toast says why. That matters because a generated game imports its level at
module load: an invalid document does not fail validation later, it stops the
game booting.

Tile layers are passed through untouched. The Composer edits objects, and
silently rewriting a layer it does not understand would be a good way to
destroy hand-authored content.

---

## Object classes

The full catalogue is `Solid`, `PlayerSpawn`, `Checkpoint`, `Exit`, `Enemy`,
`Hazard`, `Collectible`, `Powerup`, `Spring`, `Updraft`, `DashPanel`,
`Trigger`, `CameraZone`, `MusicZone`, `DialogueTrigger`, `BossTrigger`,
`SpawnZone`, `Objective` and `Interactable`.

A class being *valid* is not a claim that every game does something with it -
that is the entity registry's business, and a starter kit registers handlers
only for the classes its genre uses. An object of a class the running game does
not handle is loaded and ignored, not an error.
