/**
 * A dependency-free PNG codec.
 *
 * The repository's resource policy prefers removable dependencies and has no
 * image codec installed; adding one (sharp, jimp, canvas) would mean a native
 * binary or a large transitive tree for what the host actually needs, which is
 * "turn PNG bytes into RGBA and back". `node:zlib` already provides the only
 * hard part.
 *
 * Having this is what lets recipe replay and reimport run headlessly, against
 * the exact same pure transform core the browser uses - see
 * docs/architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md section 3.3. JPEG and
 * WebP are *not* decoded here: their bytes are stored verbatim and derivation
 * from them happens in the browser, which already has decoders. That
 * asymmetry is deliberate and documented rather than papered over.
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { rasterFrom, type Raster } from '../shared/image/raster.ts';

export class PngError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PngError';
  }
}

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) return false;
  return true;
}

// --- CRC32 (the PNG spec's own polynomial) ---------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- Decode ----------------------------------------------------------------

interface Header {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly interlace: number;
}

/** Channel count per colour type, per the PNG spec: 0 grey, 2 RGB, 3 palette index, 4 grey+alpha, 6 RGBA. */
function channelsFor(colorType: number): number {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 3:
      return 1;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new PngError(`Unsupported PNG colour type ${colorType}.`);
  }
}

function readHeader(bytes: Uint8Array, view: DataView, offset: number): Header {
  return {
    width: view.getUint32(offset),
    height: view.getUint32(offset + 4),
    bitDepth: bytes[offset + 8]!,
    colorType: bytes[offset + 9]!,
    interlace: bytes[offset + 12]!,
  };
}

/** Paeth predictor, filter type 4. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Reverses the per-scanline filters in place, returning the raw sample bytes without the filter-type prefix. */
function unfilter(raw: Uint8Array, width: number, height: number, bytesPerPixel: number, bytesPerRow: number): Uint8Array {
  const out = new Uint8Array(height * bytesPerRow);
  let inOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[inOffset++]!;
    const rowStart = y * bytesPerRow;
    const prevStart = rowStart - bytesPerRow;
    for (let x = 0; x < bytesPerRow; x++) {
      const rawByte = raw[inOffset++]!;
      const left = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel]! : 0;
      const up = y > 0 ? out[prevStart + x]! : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[prevStart + x - bytesPerPixel]! : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + left;
          break;
        case 2:
          value = rawByte + up;
          break;
        case 3:
          value = rawByte + ((left + up) >> 1);
          break;
        case 4:
          value = rawByte + paeth(left, up, upLeft);
          break;
        default:
          throw new PngError(`Unsupported PNG scanline filter ${filterType} on row ${y}.`);
      }
      out[rowStart + x] = value & 0xff;
    }
  }
  void width;
  return out;
}

/**
 * Decodes a non-interlaced 8- or 16-bit PNG of any colour type into RGBA.
 * Adam7-interlaced files are refused with a message that says so rather than
 * producing scrambled pixels - a wrong image is worse than a clear failure.
 */
export function decodePng(bytes: Uint8Array): Raster {
  if (!isPng(bytes)) throw new PngError('Not a PNG: signature mismatch.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let offset = 8;
  let header: Header | undefined;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  const idatParts: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const dataStart = offset + 8;
    if (dataStart + length > bytes.length) throw new PngError(`Truncated PNG: chunk "${type}" claims ${length} bytes past the end of the file.`);

    if (type === 'IHDR') header = readHeader(bytes, view, dataStart);
    else if (type === 'PLTE') palette = bytes.subarray(dataStart, dataStart + length);
    else if (type === 'tRNS') transparency = bytes.subarray(dataStart, dataStart + length);
    else if (type === 'IDAT') idatParts.push(bytes.subarray(dataStart, dataStart + length));
    else if (type === 'IEND') break;

    offset = dataStart + length + 4;
  }

  if (!header) throw new PngError('Malformed PNG: no IHDR chunk.');
  if (header.interlace !== 0) throw new PngError('Interlaced (Adam7) PNGs are not supported by the workbench host decoder. Re-export without interlacing.');
  if (header.bitDepth !== 8 && header.bitDepth !== 16) {
    throw new PngError(`Unsupported PNG bit depth ${header.bitDepth}; the workbench host decoder handles 8 and 16 bits per channel.`);
  }
  if (idatParts.length === 0) throw new PngError('Malformed PNG: no IDAT data.');

  const compressed = concat(idatParts);
  const raw = new Uint8Array(inflateSync(compressed));

  const channels = channelsFor(header.colorType);
  const bytesPerSample = header.bitDepth / 8;
  const bytesPerPixel = Math.max(1, Math.round(channels * bytesPerSample));
  const bytesPerRow = header.width * bytesPerPixel;
  const expected = header.height * (bytesPerRow + 1);
  if (raw.length < expected) throw new PngError(`Malformed PNG: inflated to ${raw.length} bytes, expected at least ${expected}.`);

  const samples = unfilter(raw, header.width, header.height, bytesPerPixel, bytesPerRow);
  const rgba = new Uint8ClampedArray(header.width * header.height * 4);
  const step = bytesPerSample === 2 ? 2 : 1;
  const readSample = (index: number): number => samples[index * step]!;

  for (let p = 0; p < header.width * header.height; p++) {
    const base = p * channels;
    const out = p * 4;
    switch (header.colorType) {
      case 0: {
        const grey = readSample(base);
        rgba[out] = grey;
        rgba[out + 1] = grey;
        rgba[out + 2] = grey;
        rgba[out + 3] = 255;
        break;
      }
      case 2: {
        rgba[out] = readSample(base);
        rgba[out + 1] = readSample(base + 1);
        rgba[out + 2] = readSample(base + 2);
        rgba[out + 3] = 255;
        break;
      }
      case 3: {
        if (!palette) throw new PngError('Malformed PNG: palette colour type with no PLTE chunk.');
        const index = readSample(base);
        rgba[out] = palette[index * 3] ?? 0;
        rgba[out + 1] = palette[index * 3 + 1] ?? 0;
        rgba[out + 2] = palette[index * 3 + 2] ?? 0;
        rgba[out + 3] = transparency ? (transparency[index] ?? 255) : 255;
        break;
      }
      case 4: {
        const grey = readSample(base);
        rgba[out] = grey;
        rgba[out + 1] = grey;
        rgba[out + 2] = grey;
        rgba[out + 3] = readSample(base + 1);
        break;
      }
      default: {
        rgba[out] = readSample(base);
        rgba[out + 1] = readSample(base + 1);
        rgba[out + 2] = readSample(base + 2);
        rgba[out + 3] = readSample(base + 3);
        break;
      }
    }
  }

  return rasterFrom(header.width, header.height, rgba);
}

// --- Encode ----------------------------------------------------------------

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * Encodes RGBA as an 8-bit, non-interlaced, colour-type-6 PNG with filter
 * type 0 on every scanline.
 *
 * Filter 0 rather than an adaptive heuristic: it makes the output a pure
 * function of the pixels at a fixed zlib level, so "replaying a recipe
 * reproduces the derivative" is byte-identical and testable (P03). Adaptive
 * filtering would compress a little better and cost that guarantee.
 */
export function encodePng(raster: Raster): Uint8Array {
  const bytesPerRow = raster.width * 4;
  const raw = new Uint8Array(raster.height * (bytesPerRow + 1));
  for (let y = 0; y < raster.height; y++) {
    const at = y * (bytesPerRow + 1);
    raw[at] = 0;
    raw.set(raster.data.subarray(y * bytesPerRow, (y + 1) * bytesPerRow), at + 1);
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, raster.width);
  ihdrView.setUint32(4, raster.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive (with filter 0 chosen per row)
  ihdr[12] = 0; // interlace: none

  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));

  return concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]);
}
