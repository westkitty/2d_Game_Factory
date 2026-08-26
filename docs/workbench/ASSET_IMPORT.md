# Importing assets

Every way of getting art into a project goes through the same three steps:

```
stage  ->  plan  ->  commit
```

Nothing enters the project until you have seen the plan and pressed Import.
That is deliberate: an importer that acts immediately is one you have to undo,
and undoing an import that already rewrote your theme is not a pleasant
operation.

---

## What you can bring in

| Source | How |
|---|---|
| One file | Click the drop zone, or **Choose files…** |
| Many files | Multi-select in the picker, or drop them together |
| A folder | **Choose a folder…**, or drag the folder in |
| A ZIP | Drop it or pick it - it is expanded during staging |

Supported formats are **PNG**, **JPEG** and **WebP**. A GIF is recognised and
refused with a message that says to export frames as PNG, rather than a generic
"unsupported file".

### ZIP limits

A ZIP from the internet is hostile input, so:

- entries are read from the central directory, not by scanning for headers;
- any entry whose name is absolute, contains `..`, or carries a drive letter is
  **refused by name**, never sanitised into something that might still escape;
- at most 2000 entries, 24 MiB per entry, 192 MiB expanded in total;
- only stored and deflated entries; nothing is executed or interpreted;
- macOS resource forks and `Thumbs.db` are skipped and listed as such.

Everything skipped appears in the plan's **ignored** list with its reason.

---

## What the plan tells you

For each staged file:

- **dimensions, size, transparency, pixel-art likelihood** - read from the
  bytes, not the filename;
- **duplicate** - detected by content hash against the whole project, not by
  name. Two files called `hero.png` from different folders are two assets; the
  same bytes under two names is one. Duplicates arrive **unticked**, not
  refused - occasionally you do mean it;
- **frame group** - see below;
- **suggested role** - a suggestion, always overridable before you commit.

---

## Frame grouping tolerates your naming

Artists and exporters do not agree on a convention, so the workbench does not
require one. All of these land in the same group:

```
walk_01.png   walk-2.png   walk0003.png   walk_04.png
```

The rule is: strip the trailing number in whatever form it takes, lowercase,
flatten separators, and keep the folder as part of the key so `hero/walk_01`
and `enemy/walk_01` stay apart. A file whose name is *only* digits (`01.png`)
is treated as its own name rather than being merged with every other
numerically-named file in the project.

A group of one is not reported as a group - that would be a false claim about
what was detected.

Groups are recorded on the imported assets. The current runtime draws one
representative frame per role; you choose which in the Asset Lab.

---

## Provenance

Every import asks where the art came from, because copyright is not something a
decoder can read:

| Answer | Recorded as | Effect |
|---|---|---|
| I made or own this | project-owned, approved | ships normally |
| Generated for this project | project-owned, generated | ships normally |
| Third-party, source and licence known | third-party with source + licence | ships, attribution recorded |
| Source or licence unknown | **pending** | **Pack refuses until resolved** |
| Reference only | kept in `.sw2d/`, never copied to `public/` | palette only; pixels never ship |

The status bar warns as soon as a project contains a pending asset, so you find
out before you press Pack rather than during a release.

A derivative inherits its source's provenance and is marked *modified*.
Changing a source's provenance flows down to its derivatives - otherwise a
project could ship a cropped copy of an unknown-licence image with a clean
record.

**Reference-only** exists for the common case where an image is inspiration
rather than something you can ship. You still get its palette, its theme tokens
and generated art derived from it; the pixels stay in `.sw2d/`.

---

## Large imports

Decoding, hashing and uploading are capped at three files in flight. Progress
is shown while it runs, staged bytes go straight to a disposable directory
under `.sw2d/cache/` rather than being buffered in memory, and thumbnails are
generated lazily with a bounded cache.

This is a structural guarantee, not a performance claim: the committed QA
journey imports a 60-file pack and asserts the measured peak concurrency
against the cap.
