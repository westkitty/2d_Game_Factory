/**
 * The workbench's pixel type and its primitives.
 *
 * Pure: no DOM, no Node API, no dependency. The browser feeds this from
 * `getImageData`; the local host feeds it from `server/png.ts`. Keeping one
 * implementation is what makes "replaying a recipe reproduces the derivative"
 * (principle P03) testable headlessly against the exact code path the UI runs.
 *
 * Index arithmetic inside the pixel loops below uses `!` rather than a guard.
 * Every such index is derived from the loop bounds and the invariant
 * `data.length === width * height * 4`, which `createRaster`/`assertRaster`
 * establish - a runtime check per channel per pixel would cost more than the
 * whole transform.
 */

export interface Raster {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;
}

export class RasterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RasterError';
  }
}

export function createRaster(width: number, height: number): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RasterError(`Raster dimensions must be positive integers; got ${width}x${height}.`);
  }
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function rasterFrom(width: number, height: number, data: Uint8ClampedArray): Raster {
  if (data.length !== width * height * 4) {
    throw new RasterError(`Raster data length ${data.length} does not match ${width}x${height}x4 (${width * height * 4}).`);
  }
  return { width, height, data };
}

export function cloneRaster(raster: Raster): Raster {
  return { width: raster.width, height: raster.height, data: new Uint8ClampedArray(raster.data) };
}

export function pixelIndex(raster: Raster, x: number, y: number): number {
  return (y * raster.width + x) * 4;
}

/** Reads one pixel as `[r, g, b, a]`. Out-of-bounds reads return fully transparent black rather than throwing - edge kernels rely on it. */
export function getPixel(raster: Raster, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return [0, 0, 0, 0];
  const i = pixelIndex(raster, x, y);
  return [raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!, raster.data[i + 3]!];
}

export function setPixel(raster: Raster, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return;
  const i = pixelIndex(raster, x, y);
  raster.data[i] = r;
  raster.data[i + 1] = g;
  raster.data[i + 2] = b;
  raster.data[i + 3] = a;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`. Throws on anything else - a silent black default would hide a typo'd theme colour. */
export function parseHexColor(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    const r = value[0]!;
    const g = value[1]!;
    const b = value[2]!;
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
  }
  if (value.length === 6 || value.length === 8) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }
  throw new RasterError(`Unsupported colour "${hex}": expected #rgb, #rrggbb or #rrggbbaa.`);
}

export function toHexColor(r: number, g: number, b: number): string {
  const part = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Squared RGB distance. Squared, because every caller compares against another distance and the square root would only cost time. */
export function colorDistanceSquared(ar: number, ag: number, ab: number, br: number, bg: number, bb: number): number {
  const dr = ar - br;
  const dg = ag - bg;
  const db = ab - bb;
  return dr * dr + dg * dg + db * db;
}

/** Rec. 601 luma - the same weighting the desaturate and silhouette transforms use. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
