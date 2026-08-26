/**
 * The Asset Lab's transform library.
 *
 * Every function is `(Raster, params) => Raster` and never mutates its input:
 * the source is sacred (principle P01) and a recipe step must be replayable in
 * any order any number of times (P03). Nothing here touches a canvas, a file
 * or a network - which is exactly why `test/transforms.test.ts` can assert
 * determinism byte-for-byte.
 */

import {
  type Raster,
  type Rgb,
  RasterError,
  cloneRaster,
  colorDistanceSquared,
  createRaster,
  getPixel,
  luma,
  parseHexColor,
  pixelIndex,
  toHexColor,
} from './raster.ts';
import type { RectSpec } from '../types.ts';

export const DEFAULT_ALPHA_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Clamps `rect` to the raster and returns the intersection, or null when they do not overlap. */
export function clampRect(raster: Raster, rect: RectSpec): RectSpec | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(raster.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(raster.height, Math.ceil(rect.y + rect.height));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function crop(raster: Raster, rect: RectSpec): Raster {
  const clamped = clampRect(raster, rect);
  if (!clamped) throw new RasterError(`Crop rectangle ${JSON.stringify(rect)} does not intersect a ${raster.width}x${raster.height} image.`);
  const out = createRaster(clamped.width, clamped.height);
  for (let y = 0; y < clamped.height; y++) {
    const srcStart = pixelIndex(raster, clamped.x, clamped.y + y);
    const srcEnd = srcStart + clamped.width * 4;
    out.data.set(raster.data.subarray(srcStart, srcEnd), y * clamped.width * 4);
  }
  return out;
}

/** The bounding box of every pixel whose alpha exceeds `threshold`, or null when the image is entirely below it. */
export function alphaBounds(raster: Raster, threshold = DEFAULT_ALPHA_THRESHOLD): RectSpec | null {
  let minX = raster.width;
  let minY = raster.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (raster.data[pixelIndex(raster, x, y) + 3]! <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Trims fully/near transparent margins. A fully transparent image is returned unchanged rather than collapsed to nothing. */
export function trimAlpha(raster: Raster, threshold = DEFAULT_ALPHA_THRESHOLD): Raster {
  const bounds = alphaBounds(raster, threshold);
  if (!bounds) return cloneRaster(raster);
  return crop(raster, bounds);
}

export function flip(raster: Raster, axis: 'horizontal' | 'vertical'): Raster {
  const out = createRaster(raster.width, raster.height);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const sx = axis === 'horizontal' ? raster.width - 1 - x : x;
      const sy = axis === 'vertical' ? raster.height - 1 - y : y;
      const si = pixelIndex(raster, sx, sy);
      const di = pixelIndex(out, x, y);
      out.data[di] = raster.data[si]!;
      out.data[di + 1] = raster.data[si + 1]!;
      out.data[di + 2] = raster.data[si + 2]!;
      out.data[di + 3] = raster.data[si + 3]!;
    }
  }
  return out;
}

/** Rotation in 90-degree steps only. `quarterTurns` is taken modulo 4, so 5 and 1 agree and -1 means 270. */
export function rotate(raster: Raster, quarterTurns: number): Raster {
  const turns = ((Math.trunc(quarterTurns) % 4) + 4) % 4;
  if (turns === 0) return cloneRaster(raster);
  const swapped = turns === 1 || turns === 3;
  const outWidth = swapped ? raster.height : raster.width;
  const outHeight = swapped ? raster.width : raster.height;
  const out = createRaster(outWidth, outHeight);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      let dx: number;
      let dy: number;
      if (turns === 1) {
        dx = raster.height - 1 - y;
        dy = x;
      } else if (turns === 2) {
        dx = raster.width - 1 - x;
        dy = raster.height - 1 - y;
      } else {
        dx = y;
        dy = raster.width - 1 - x;
      }
      const si = pixelIndex(raster, x, y);
      const di = pixelIndex(out, dx, dy);
      out.data[di] = raster.data[si]!;
      out.data[di + 1] = raster.data[si + 1]!;
      out.data[di + 2] = raster.data[si + 2]!;
      out.data[di + 3] = raster.data[si + 3]!;
    }
  }
  return out;
}

/**
 * `nearest` preserves hard pixel-art edges; `smooth` is a box-average
 * resample. Both are implemented here rather than deferred to
 * `drawImage`, because a canvas's own smoothing is browser-dependent and a
 * recipe must replay identically on the host (P03).
 */
export function scale(raster: Raster, width: number, height: number, mode: 'nearest' | 'smooth'): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RasterError(`Scale target must be positive integers; got ${width}x${height}.`);
  }
  const out = createRaster(width, height);
  const xRatio = raster.width / width;
  const yRatio = raster.height / height;

  if (mode === 'nearest') {
    for (let y = 0; y < height; y++) {
      const sy = Math.min(raster.height - 1, Math.floor(y * yRatio));
      for (let x = 0; x < width; x++) {
        const sx = Math.min(raster.width - 1, Math.floor(x * xRatio));
        const si = pixelIndex(raster, sx, sy);
        const di = pixelIndex(out, x, y);
        out.data[di] = raster.data[si]!;
        out.data[di + 1] = raster.data[si + 1]!;
        out.data[di + 2] = raster.data[si + 2]!;
        out.data[di + 3] = raster.data[si + 3]!;
      }
    }
    return out;
  }

  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.max(sy0 + 1, Math.min(raster.height, Math.ceil((y + 1) * yRatio)));
    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.max(sx0 + 1, Math.min(raster.width, Math.ceil((x + 1) * xRatio)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const si = pixelIndex(raster, sx, sy);
          // Premultiply so a transparent pixel's arbitrary RGB never bleeds
          // into the average - the classic halo bug when downscaling cutouts.
          const alpha = raster.data[si + 3]!;
          r += raster.data[si]! * alpha;
          g += raster.data[si + 1]! * alpha;
          b += raster.data[si + 2]! * alpha;
          a += alpha;
          weight += 1;
        }
      }
      const di = pixelIndex(out, x, y);
      if (a === 0) {
        out.data[di] = 0;
        out.data[di + 1] = 0;
        out.data[di + 2] = 0;
        out.data[di + 3] = 0;
      } else {
        out.data[di] = Math.round(r / a);
        out.data[di + 1] = Math.round(g / a);
        out.data[di + 2] = Math.round(b / a);
        out.data[di + 3] = Math.round(a / weight);
      }
    }
  }
  return out;
}

/** Scale to fit inside `maxWidth`x`maxHeight` preserving aspect ratio. Never upscales. */
export function fitWithin(raster: Raster, maxWidth: number, maxHeight: number, mode: 'nearest' | 'smooth' = 'smooth'): Raster {
  const ratio = Math.min(maxWidth / raster.width, maxHeight / raster.height, 1);
  if (ratio >= 1) return cloneRaster(raster);
  const width = Math.max(1, Math.round(raster.width * ratio));
  const height = Math.max(1, Math.round(raster.height * ratio));
  return scale(raster, width, height, mode);
}

// ---------------------------------------------------------------------------
// Masking / background removal
// ---------------------------------------------------------------------------

/**
 * Offline background removal. Not semantic segmentation and never described
 * as such: it samples one pixel and clears everything within `tolerance` of
 * it, either flood-filled from the image border (`edgeConnected`, the safe
 * default - a matching colour *inside* the subject survives) or globally.
 */
export function removeBackground(
  raster: Raster,
  sampleX: number,
  sampleY: number,
  tolerance: number,
  edgeConnected: boolean,
): Raster {
  const out = cloneRaster(raster);
  const [sr, sg, sb] = getPixel(raster, Math.floor(sampleX), Math.floor(sampleY));
  const toleranceSquared = tolerance * tolerance * 3;

  const matches = (x: number, y: number): boolean => {
    const i = pixelIndex(raster, x, y);
    if (raster.data[i + 3]! === 0) return true;
    return colorDistanceSquared(raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!, sr, sg, sb) <= toleranceSquared;
  };

  if (!edgeConnected) {
    for (let y = 0; y < raster.height; y++) {
      for (let x = 0; x < raster.width; x++) {
        if (matches(x, y)) out.data[pixelIndex(out, x, y) + 3] = 0;
      }
    }
    return out;
  }

  // Iterative flood fill from every border pixel. An explicit stack, not
  // recursion: a 4000x4000 background would blow the call stack.
  const visited = new Uint8Array(raster.width * raster.height);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return;
    const flat = y * raster.width + x;
    if (visited[flat] === 1) return;
    visited[flat] = 1;
    if (!matches(x, y)) return;
    stack.push(flat);
    out.data[pixelIndex(out, x, y) + 3] = 0;
  };
  for (let x = 0; x < raster.width; x++) {
    push(x, 0);
    push(x, raster.height - 1);
  }
  for (let y = 0; y < raster.height; y++) {
    push(0, y);
    push(raster.width - 1, y);
  }
  while (stack.length > 0) {
    const flat = stack.pop()!;
    const x = flat % raster.width;
    const y = (flat - x) / raster.width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}

/** Erase/restore brush. `restore` can only bring back alpha the *original* raster still carries, so a stroke never invents pixels. */
export function maskStroke(
  raster: Raster,
  original: Raster,
  mode: 'erase' | 'restore',
  points: readonly (readonly [number, number])[],
  radius: number,
): Raster {
  const out = cloneRaster(raster);
  const r = Math.max(0.5, radius);
  const rSquared = r * r;
  for (const point of points) {
    const cx = point[0];
    const cy = point[1];
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(raster.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(raster.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > rSquared) continue;
        const i = pixelIndex(out, x, y);
        if (mode === 'erase') {
          out.data[i + 3] = 0;
        } else if (original.width === raster.width && original.height === raster.height) {
          const oi = pixelIndex(original, x, y);
          out.data[i] = original.data[oi]!;
          out.data[i + 1] = original.data[oi + 1]!;
          out.data[i + 2] = original.data[oi + 2]!;
          out.data[i + 3] = original.data[oi + 3]!;
        }
      }
    }
  }
  return out;
}

export function invertMask(raster: Raster): Raster {
  const out = cloneRaster(raster);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255 - out.data[i]!;
  return out;
}

/** Expands opaque alpha by `pixels` (a square dilate). Cheap and predictable; a circular kernel buys nothing at the 1-3px sizes this control offers. */
export function growAlpha(raster: Raster, pixels: number): Raster {
  let current = cloneRaster(raster);
  for (let pass = 0; pass < Math.max(0, Math.trunc(pixels)); pass++) {
    const next = cloneRaster(current);
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const i = pixelIndex(current, x, y);
        if (current.data[i + 3]! > 0) continue;
        let best = 0;
        let bestIndex = -1;
        for (const [dx, dy] of NEIGHBOURS4) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= current.width || ny >= current.height) continue;
          const ni = pixelIndex(current, nx, ny);
          if (current.data[ni + 3]! > best) {
            best = current.data[ni + 3]!;
            bestIndex = ni;
          }
        }
        if (bestIndex >= 0) {
          next.data[i] = current.data[bestIndex]!;
          next.data[i + 1] = current.data[bestIndex + 1]!;
          next.data[i + 2] = current.data[bestIndex + 2]!;
          next.data[i + 3] = best;
        }
      }
    }
    current = next;
  }
  return current;
}

export function shrinkAlpha(raster: Raster, pixels: number): Raster {
  let current = cloneRaster(raster);
  for (let pass = 0; pass < Math.max(0, Math.trunc(pixels)); pass++) {
    const next = cloneRaster(current);
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const i = pixelIndex(current, x, y);
        if (current.data[i + 3]! === 0) continue;
        for (const [dx, dy] of NEIGHBOURS4) {
          const nx = x + dx;
          const ny = y + dy;
          const transparent =
            nx < 0 || ny < 0 || nx >= current.width || ny >= current.height || current.data[pixelIndex(current, nx, ny) + 3]! === 0;
          if (transparent) {
            next.data[i + 3] = 0;
            break;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

/** Box-blurs the alpha channel only, leaving colour untouched. */
export function featherAlpha(raster: Raster, radius: number): Raster {
  const r = Math.max(0, Math.trunc(radius));
  if (r === 0) return cloneRaster(raster);
  const out = cloneRaster(raster);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      let total = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= raster.width || ny >= raster.height) continue;
          total += raster.data[pixelIndex(raster, nx, ny) + 3]!;
          count += 1;
        }
      }
      out.data[pixelIndex(out, x, y) + 3] = Math.round(total / Math.max(1, count));
    }
  }
  return out;
}

const NEIGHBOURS4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// ---------------------------------------------------------------------------
// Connected components
// ---------------------------------------------------------------------------

export interface ComponentInfo {
  readonly index: number;
  readonly bounds: RectSpec;
  readonly pixelCount: number;
}

/**
 * 8-connected labelling over "alpha above threshold". Returned in a stable
 * order (top-to-bottom, then left-to-right by bounding box) so a recipe that
 * names `component 2` still means the same thing after a reload - a
 * discovery-order list would not survive that (P03).
 */
export function findComponents(raster: Raster, alphaThreshold = DEFAULT_ALPHA_THRESHOLD, minPixels = 4): readonly ComponentInfo[] {
  const labels = new Int32Array(raster.width * raster.height).fill(-1);
  const found: { bounds: { x0: number; y0: number; x1: number; y1: number }; pixelCount: number }[] = [];
  const stack: number[] = [];

  for (let startY = 0; startY < raster.height; startY++) {
    for (let startX = 0; startX < raster.width; startX++) {
      const startFlat = startY * raster.width + startX;
      if (labels[startFlat] !== -1) continue;
      if (raster.data[startFlat * 4 + 3]! <= alphaThreshold) continue;

      const label = found.length;
      const box = { x0: startX, y0: startY, x1: startX, y1: startY };
      let pixelCount = 0;
      labels[startFlat] = label;
      stack.push(startFlat);

      while (stack.length > 0) {
        const flat = stack.pop()!;
        const x = flat % raster.width;
        const y = (flat - x) / raster.width;
        pixelCount += 1;
        if (x < box.x0) box.x0 = x;
        if (x > box.x1) box.x1 = x;
        if (y < box.y0) box.y0 = y;
        if (y > box.y1) box.y1 = y;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= raster.width || ny >= raster.height) continue;
            const nf = ny * raster.width + nx;
            if (labels[nf] !== -1) continue;
            if (raster.data[nf * 4 + 3]! <= alphaThreshold) continue;
            labels[nf] = label;
            stack.push(nf);
          }
        }
      }
      found.push({ bounds: box, pixelCount });
    }
  }

  return found
    .filter((component) => component.pixelCount >= minPixels)
    .map((component) => ({
      bounds: {
        x: component.bounds.x0,
        y: component.bounds.y0,
        width: component.bounds.x1 - component.bounds.x0 + 1,
        height: component.bounds.y1 - component.bounds.y0 + 1,
      },
      pixelCount: component.pixelCount,
    }))
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
    .map((component, index) => ({ index, bounds: component.bounds, pixelCount: component.pixelCount }));
}

/** Crops out one component by its stable index, keeping only that component's own pixels. */
export function extractComponent(raster: Raster, index: number, alphaThreshold = DEFAULT_ALPHA_THRESHOLD): Raster {
  const components = findComponents(raster, alphaThreshold);
  const component = components[index];
  if (!component) {
    throw new RasterError(`Component ${index} does not exist; this image has ${components.length} visible component(s).`);
  }
  return crop(raster, component.bounds);
}

// ---------------------------------------------------------------------------
// Grid slicing
// ---------------------------------------------------------------------------

export interface GridSuggestion {
  readonly columns: number;
  readonly rows: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

/**
 * Grids the dimensions strongly imply: divisor pairs that produce square-ish,
 * plausibly-sized frames. Suggestions only - the Import Inbox always lets the
 * user override, because a sheet with padding divides evenly by nothing.
 */
export function suggestGrids(width: number, height: number): readonly GridSuggestion[] {
  const suggestions: GridSuggestion[] = [];
  for (let columns = 1; columns <= 16; columns++) {
    if (width % columns !== 0) continue;
    const frameWidth = width / columns;
    if (frameWidth < 8) continue;
    for (let rows = 1; rows <= 16; rows++) {
      if (height % rows !== 0) continue;
      if (columns === 1 && rows === 1) continue;
      const frameHeight = height / rows;
      if (frameHeight < 8) continue;
      const aspect = frameWidth / frameHeight;
      if (aspect < 0.5 || aspect > 2) continue;
      suggestions.push({ columns, rows, frameWidth, frameHeight });
    }
  }
  // Squarest frames first, then fewest cells: the most likely reading of a
  // sheet is the one whose frames look like sprites.
  return suggestions
    .sort((a, b) => {
      const squarenessA = Math.abs(Math.log(a.frameWidth / a.frameHeight));
      const squarenessB = Math.abs(Math.log(b.frameWidth / b.frameHeight));
      return squarenessA - squarenessB || a.columns * a.rows - b.columns * b.rows;
    })
    .slice(0, 8);
}

export function gridCell(raster: Raster, columns: number, rows: number, cell: number): Raster {
  if (columns <= 0 || rows <= 0) throw new RasterError(`Grid must have positive columns and rows; got ${columns}x${rows}.`);
  const count = columns * rows;
  if (cell < 0 || cell >= count) throw new RasterError(`Cell ${cell} is outside a ${columns}x${rows} grid (${count} cells).`);
  const frameWidth = Math.floor(raster.width / columns);
  const frameHeight = Math.floor(raster.height / rows);
  if (frameWidth <= 0 || frameHeight <= 0) throw new RasterError(`A ${columns}x${rows} grid does not fit a ${raster.width}x${raster.height} image.`);
  const column = cell % columns;
  const row = Math.floor(cell / columns);
  return crop(raster, { x: column * frameWidth, y: row * frameHeight, width: frameWidth, height: frameHeight });
}

// ---------------------------------------------------------------------------
// Visual variants
// ---------------------------------------------------------------------------

/** Adds an `thickness`-px outline outside the visible silhouette, growing the canvas so nothing is clipped. */
export function outline(raster: Raster, color: string, thickness: number): Raster {
  const rgb = parseHexColor(color);
  const t = Math.max(1, Math.trunc(thickness));
  const out = createRaster(raster.width + t * 2, raster.height + t * 2);
  const tSquared = t * t;

  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const sx = x - t;
      const sy = y - t;
      const inside = sx >= 0 && sy >= 0 && sx < raster.width && sy < raster.height;
      if (inside && raster.data[pixelIndex(raster, sx, sy) + 3]! > 0) continue;
      let near = false;
      for (let dy = -t; dy <= t && !near; dy++) {
        for (let dx = -t; dx <= t; dx++) {
          if (dx * dx + dy * dy > tSquared) continue;
          const nx = sx + dx;
          const ny = sy + dy;
          if (nx < 0 || ny < 0 || nx >= raster.width || ny >= raster.height) continue;
          if (raster.data[pixelIndex(raster, nx, ny) + 3]! > 0) {
            near = true;
            break;
          }
        }
      }
      if (near) {
        const i = pixelIndex(out, x, y);
        out.data[i] = rgb.r;
        out.data[i + 1] = rgb.g;
        out.data[i + 2] = rgb.b;
        out.data[i + 3] = 255;
      }
    }
  }
  compositeOver(out, raster, t, t);
  return out;
}

export function dropShadow(raster: Raster, offsetX: number, offsetY: number, color: string, blur: number): Raster {
  const rgb = parseHexColor(color);
  const padLeft = Math.max(0, -Math.trunc(offsetX)) + blur;
  const padTop = Math.max(0, -Math.trunc(offsetY)) + blur;
  const padRight = Math.max(0, Math.trunc(offsetX)) + blur;
  const padBottom = Math.max(0, Math.trunc(offsetY)) + blur;
  const out = createRaster(raster.width + padLeft + padRight, raster.height + padTop + padBottom);

  const shadow = createRaster(out.width, out.height);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const alpha = raster.data[pixelIndex(raster, x, y) + 3]!;
      if (alpha === 0) continue;
      const dx = x + padLeft + Math.trunc(offsetX);
      const dy = y + padTop + Math.trunc(offsetY);
      if (dx < 0 || dy < 0 || dx >= shadow.width || dy >= shadow.height) continue;
      const i = pixelIndex(shadow, dx, dy);
      shadow.data[i] = rgb.r;
      shadow.data[i + 1] = rgb.g;
      shadow.data[i + 2] = rgb.b;
      shadow.data[i + 3] = Math.round(alpha * 0.55);
    }
  }
  const blurred = blur > 0 ? featherAlpha(shadow, blur) : shadow;
  out.data.set(blurred.data);
  compositeOver(out, raster, padLeft, padTop);
  return out;
}

export function silhouette(raster: Raster, color: string): Raster {
  const rgb = parseHexColor(color);
  const out = cloneRaster(raster);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3]! === 0) continue;
    out.data[i] = rgb.r;
    out.data[i + 1] = rgb.g;
    out.data[i + 2] = rgb.b;
  }
  return out;
}

export function tint(raster: Raster, color: string, amount: number): Raster {
  const rgb = parseHexColor(color);
  const mix = Math.max(0, Math.min(1, amount));
  const out = cloneRaster(raster);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3]! === 0) continue;
    out.data[i] = Math.round(out.data[i]! * (1 - mix) + rgb.r * mix);
    out.data[i + 1] = Math.round(out.data[i + 1]! * (1 - mix) + rgb.g * mix);
    out.data[i + 2] = Math.round(out.data[i + 2]! * (1 - mix) + rgb.b * mix);
  }
  return out;
}

export function desaturate(raster: Raster, amount: number): Raster {
  const mix = Math.max(0, Math.min(1, amount));
  const out = cloneRaster(raster);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3]! === 0) continue;
    const grey = luma(out.data[i]!, out.data[i + 1]!, out.data[i + 2]!);
    out.data[i] = Math.round(out.data[i]! * (1 - mix) + grey * mix);
    out.data[i + 1] = Math.round(out.data[i + 1]! * (1 - mix) + grey * mix);
    out.data[i + 2] = Math.round(out.data[i + 2]! * (1 - mix) + grey * mix);
  }
  return out;
}

/** The hit-flash variant: pushes every visible pixel hard toward one colour without flattening it completely. */
export function damageFlash(raster: Raster, color: string, amount: number): Raster {
  return tint(raster, color, Math.max(0, Math.min(1, amount)));
}

/** Standard source-over composite of `top` onto `base` at (`atX`, `atY`). Mutates `base`. */
export function compositeOver(base: Raster, top: Raster, atX: number, atY: number): void {
  for (let y = 0; y < top.height; y++) {
    const dy = atY + y;
    if (dy < 0 || dy >= base.height) continue;
    for (let x = 0; x < top.width; x++) {
      const dx = atX + x;
      if (dx < 0 || dx >= base.width) continue;
      const si = pixelIndex(top, x, y);
      const sa = top.data[si + 3]! / 255;
      if (sa === 0) continue;
      const di = pixelIndex(base, dx, dy);
      const da = base.data[di + 3]! / 255;
      const outA = sa + da * (1 - sa);
      if (outA === 0) continue;
      base.data[di] = Math.round((top.data[si]! * sa + base.data[di]! * da * (1 - sa)) / outA);
      base.data[di + 1] = Math.round((top.data[si + 1]! * sa + base.data[di + 1]! * da * (1 - sa)) / outA);
      base.data[di + 2] = Math.round((top.data[si + 2]! * sa + base.data[di + 2]! * da * (1 - sa)) / outA);
      base.data[di + 3] = Math.round(outA * 255);
    }
  }
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * Deterministic dominant-colour extraction by 4-bit-per-channel bucketing.
 * Deterministic on purpose: k-means with a random seed would make the same
 * image produce a different theme on every import, and the theme is a
 * committed content document.
 */
export function extractPalette(raster: Raster, maxColors = 6, alphaThreshold = 24): readonly string[] {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < raster.data.length; i += 4) {
    const a = raster.data[i + 3]!;
    if (a <= alphaThreshold) continue;
    const r = raster.data[i]!;
    const g = raster.data[i + 1]!;
    const b = raster.data[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }
  if (buckets.size === 0) return [];

  const ranked = [...buckets.entries()]
    // Ties broken by bucket key so the order never depends on Map iteration
    // luck - two runs over the same pixels must produce the same palette.
    .sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
    .map(([, bucket]) => ({
      count: bucket.count,
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    }));

  // Greedy spread: skip a colour too close to one already chosen, so a
  // near-single-hue image still yields distinguishable theme tokens.
  const chosen: Rgb[] = [];
  const minDistanceSquared = 40 * 40 * 3;
  for (const candidate of ranked) {
    if (chosen.length >= maxColors) break;
    const tooClose = chosen.some((c) => colorDistanceSquared(c.r, c.g, c.b, candidate.r, candidate.g, candidate.b) < minDistanceSquared);
    if (tooClose) continue;
    chosen.push({ r: candidate.r, g: candidate.g, b: candidate.b });
  }
  for (const candidate of ranked) {
    if (chosen.length >= maxColors) break;
    chosen.push({ r: candidate.r, g: candidate.g, b: candidate.b });
  }
  return chosen.map((c) => toHexColor(c.r, c.g, c.b));
}

/** True when the image looks like pixel art: few distinct colours and large flat runs relative to its size. */
export function looksLikePixelArt(raster: Raster): boolean {
  if (raster.width > 512 || raster.height > 512) return false;
  const distinct = new Set<number>();
  let sampled = 0;
  for (let i = 0; i < raster.data.length && distinct.size <= 64; i += 4) {
    if (raster.data[i + 3]! <= 24) continue;
    distinct.add((raster.data[i]! << 16) | (raster.data[i + 1]! << 8) | raster.data[i + 2]!);
    sampled += 1;
  }
  if (sampled === 0) return false;
  return distinct.size <= 64;
}

export function hasAlpha(raster: Raster): boolean {
  for (let i = 3; i < raster.data.length; i += 4) {
    if (raster.data[i]! < 255) return true;
  }
  return false;
}
