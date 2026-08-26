/**
 * The browser's bridge between image files and the shared pure raster core.
 *
 * The browser has decoders the host deliberately does not (JPEG, WebP), so
 * this is where those formats become pixels. Everything past that point is the
 * same `applyRecipe` the host runs, which is what makes a derivative
 * reproducible either side (principle P03).
 *
 * Memory discipline lives here too (section 14): decoded bitmaps are closed
 * as soon as they have been read, canvases used for one-shot work are sized
 * to zero afterwards, and nothing holds a full-resolution decode longer than
 * the operation that needed it.
 */

import { rasterFrom, type Raster } from '../../shared/image/raster.ts';
import { alphaBounds, extractPalette, fitWithin, hasAlpha, looksLikePixelArt } from '../../shared/image/transforms.ts';

/** Guard against a decode that would allocate more than the browser can comfortably hold. */
const MAX_DECODE_PIXELS = 8192 * 8192;

export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

function canvasFor(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new ImageDecodeError('This browser refused a 2D canvas context.');
  return { canvas, context };
}

/** Frees a canvas's backing store immediately rather than waiting for GC - a handful of 4K canvases is hundreds of megabytes. */
function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function blobToRaster(blob: Blob): Promise<Raster> {
  const bitmap = await createImageBitmap(blob).catch((error: unknown) => {
    throw new ImageDecodeError(`Could not decode this image: ${error instanceof Error ? error.message : String(error)}`);
  });
  try {
    if (bitmap.width * bitmap.height > MAX_DECODE_PIXELS) {
      throw new ImageDecodeError(`This image is ${bitmap.width}x${bitmap.height}, which is too large to edit. Scale it down before importing.`);
    }
    const { canvas, context } = canvasFor(bitmap.width, bitmap.height);
    try {
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return rasterFrom(bitmap.width, bitmap.height, data.data);
    } finally {
      releaseCanvas(canvas);
    }
  } finally {
    bitmap.close();
  }
}

export async function urlToRaster(url: string): Promise<Raster> {
  const response = await fetch(url);
  if (!response.ok) throw new ImageDecodeError(`Could not load image (${response.status}).`);
  return blobToRaster(await response.blob());
}

export function rasterToCanvas(raster: Raster): HTMLCanvasElement {
  const { canvas, context } = canvasFor(raster.width, raster.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  return canvas;
}

export function drawRasterInto(canvas: HTMLCanvasElement, raster: Raster): void {
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageDecodeError('This browser refused a 2D canvas context.');
  context.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
}

/** PNG always: a derivative may carry alpha, and the workbench never re-encodes a user's art lossily. */
export function rasterToPngBlob(raster: Raster): Promise<Blob> {
  const canvas = rasterToCanvas(raster);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      releaseCanvas(canvas);
      if (blob) resolve(blob);
      else reject(new ImageDecodeError('The browser could not encode this image as PNG.'));
    }, 'image/png');
  });
}

export function rasterToDataUrl(raster: Raster): string {
  const canvas = rasterToCanvas(raster);
  const url = canvas.toDataURL('image/png');
  releaseCanvas(canvas);
  return url;
}

export interface AnalysisHints {
  readonly palette: readonly string[];
  readonly hasAlpha: boolean;
  readonly alphaBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly pixelArtLikely: boolean;
}

/**
 * Advisory analysis the host cannot do for JPEG/WebP.
 *
 * Deliberately computed on a downscaled copy: a palette and an alpha check do
 * not need 24 megapixels, and doing it at full resolution for every file in a
 * folder import is exactly the memory behaviour section 14 forbids.
 */
export async function analyseFile(file: Blob): Promise<AnalysisHints> {
  const raster = await blobToRaster(file);
  const sample = fitWithin(raster, 512, 512, 'smooth');
  const bounds = alphaBounds(raster);
  return {
    palette: extractPalette(sample, 6),
    hasAlpha: hasAlpha(sample),
    alphaBounds: bounds,
    pixelArtLikely: looksLikePixelArt(raster),
  };
}

/**
 * Runs `worker` over `items` with at most `limit` in flight.
 *
 * Import is the one place in the UI where the number of concurrent decodes
 * genuinely matters: a dropped folder of 300 PNGs decoded at once is the
 * failure Godot's import-memory reports describe (F17).
 */
export async function mapWithLimit<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const bound = Math.max(1, limit);
  const results = new Array<R>(items.length);
  let next = 0;
  async function pump(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(bound, items.length) }, () => pump()));
  return results;
}

/**
 * Lazily produces a small thumbnail data URL, cached by a caller-supplied key.
 *
 * The cache is bounded and evicts oldest-first: an asset library with 2000
 * entries must not accumulate 2000 data URLs in memory just because the user
 * scrolled past them once.
 */
const THUMB_CACHE = new Map<string, string>();
const THUMB_CACHE_LIMIT = 400;

export async function thumbnailFor(key: string, url: string, size = 96): Promise<string> {
  const cached = THUMB_CACHE.get(key);
  if (cached) return cached;
  const raster = await urlToRaster(url);
  const small = fitWithin(raster, size, size, raster.width <= 128 ? 'nearest' : 'smooth');
  const dataUrl = rasterToDataUrl(small);
  if (THUMB_CACHE.size >= THUMB_CACHE_LIMIT) {
    const oldest = THUMB_CACHE.keys().next();
    if (!oldest.done) THUMB_CACHE.delete(oldest.value);
  }
  THUMB_CACHE.set(key, dataUrl);
  return dataUrl;
}

export function forgetThumbnail(key: string): void {
  THUMB_CACHE.delete(key);
}
