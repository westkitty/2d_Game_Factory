# The Asset Lab

The Lab is non-destructive by construction. Your source image is loaded once
and never written to; every operation appends a step to a **recipe**, and what
you see on the canvas is that recipe replayed from the source.

```
source  +  [trim, scale, remove background, outline, …]  =  what you see
```

That single design choice buys three things:

- **Undo and redo are a cursor into the step list**, not a pixel buffer - so
  undo works across operations that change the image's dimensions.
- **A derivative can be rebuilt from its source at any time**, months later.
- **Reimport works**: replace the source and every derivative regenerates by
  replaying its own recipe.

---

## Tools

| Group | Tools |
|---|---|
| History | Undo, Redo, and a clickable step list - click any step to jump there |
| Crop | Drag a rectangle, **Trim** transparent margins, **Fit bounds** to visible pixels |
| Transform | Flip horizontally/vertically, rotate 90°, **Scale…** (nearest or smooth) |
| Background | **Pick background** eyedropper with tolerance, and an *edge only* toggle |
| Mask | **Erase** / **Restore** brushes with a size slider, **Invert**, **+1px**, **−1px**, **Feather** |
| Extract | **Split pieces…** (connected components), **Slice sheet…** (grid) |
| Variants | Outline, drop shadow, silhouette, damage flash, desaturated, tinted |

### Background removal, described accurately

It samples the pixel you click and clears everything within tolerance of it. In
**edge only** mode (the default) it flood-fills inward from the image border, so
a colour that also appears *inside* your subject survives. Global mode clears
every match anywhere.

This is not semantic segmentation and is not described as such. For a
photograph on a busy background you will want the mask brushes.

### Restore never invents pixels

The Restore brush can only bring back alpha the *original source* still
carries. Painting Restore over a region the source never had is a no-op.

### Split pieces

Finds disconnected visible shapes and lets you extract one. The numbering is
stable - sorted top-to-bottom then left-to-right, not by discovery order - so a
recipe that names "piece 2" still means the same piece after a reload.

### Slice sheet

Offers the grids your image's dimensions actually divide into, squarest frames
first, and lets you set columns, rows and cell by hand when it divides into
nothing (a sheet with padding usually does not).

### Scaling

Both resamplers are implemented in the workbench rather than deferred to the
canvas, because a browser's own smoothing is browser-dependent and a recipe has
to replay identically on the host. **Nearest** keeps pixel-art edges hard;
**smooth** is a premultiplied box average, so downscaling a cut-out does not
darken its edges toward black.

---

## Saving

**Save as new asset** writes the current result as a *derived* asset alongside
your untouched source. The derivative records:

```
sourceAssetId  +  the ordered recipe  +  its own content hash
```

Editing a derivative continues its history and records the combined recipe
against the *original* source, so lineage never becomes a chain the rebuild
path would have to walk.

---

## Replacing a source (reimport)

Select a source asset and use **Replace source…** in the inspector.

What is kept: the asset's **id**, its **role assignments**, and every
derivative's **lineage and recipe**.
What changes: the bytes, the dimensions, the hash, and the file the game loads.

Derivatives are marked *stale* and rebuilt by replaying their recipes -
PNG-backed ones on the host, others in the browser, which has decoders the host
deliberately does not carry.

Reimporting identical bytes reports "those are the same bytes" and changes
nothing, rather than churning the project.

---

## Where the pixels are actually processed

The transform core is pure TypeScript over an RGBA buffer with no DOM and no
Node APIs. The browser feeds it from a canvas; the host feeds it from a
dependency-free PNG decoder built on `node:zlib`.

One consequence is worth stating plainly: **JPEG and WebP sources are decoded
only in the browser**. The host stores their bytes verbatim, and a derivative
of a JPEG is rebuilt by the workbench client rather than headlessly. This is
the one asymmetric part of the architecture and it exists so the repository
does not need an image-codec dependency - see
[`../architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md`](../architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md)
section 3.3.
