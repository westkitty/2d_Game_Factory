/**
 * Format sniffing and dimension reading straight from file headers.
 *
 * The host needs a mime and a size for every uploaded image, including the
 * JPEG and WebP files it deliberately does not decode (see
 * docs/architecture/ASSET_DRIVEN_FACTORY_WORKBENCH.md section 3.3). Reading a
 * header is a few dozen lines; decoding is a dependency. The declared
 * `Content-Type` is never trusted - the bytes decide.
 */

export interface SniffResult {
  readonly mime: string;
  readonly width: number;
  readonly height: number;
}

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) if (bytes[offset + i] !== signature[i]) return false;
  return true;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

function sniffPng(bytes: Uint8Array): SniffResult | null {
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (bytes.length < 24) throw new UnsupportedImageError('Truncated PNG: no IHDR.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * Walks JPEG markers to the first SOFn frame header.
 *
 * Skipping by segment length rather than scanning for `0xFFC0` matters: the
 * byte pair can occur inside entropy-coded data, and a naive scan of a photo
 * with an embedded thumbnail reports the thumbnail's dimensions.
 */
function sniffJpeg(bytes: Uint8Array): SniffResult | null {
  if (!startsWith(bytes, [0xff, 0xd8])) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      offset += 2;
      continue;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const length = view.getUint16(offset + 2);
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (offset + 9 > bytes.length) throw new UnsupportedImageError('Truncated JPEG frame header.');
      return { mime: 'image/jpeg', height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (length < 2) throw new UnsupportedImageError('Malformed JPEG segment length.');
    offset += 2 + length;
  }
  throw new UnsupportedImageError('JPEG has no frame header; dimensions could not be read.');
}

/** VP8 (lossy), VP8L (lossless) and VP8X (extended) all carry dimensions in different places. */
function sniffWebp(bytes: Uint8Array): SniffResult | null {
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) || bytes.length < 30) return null;
  if (ascii(bytes, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === 'VP8 ') {
    // Frame header sits after the 3-byte frame tag and the 3-byte start code.
    return { mime: 'image/webp', width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { mime: 'image/webp', width, height };
  }
  throw new UnsupportedImageError(`Unrecognised WebP chunk "${chunk}".`);
}

function sniffGif(bytes: Uint8Array): SniffResult | null {
  if (!startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) || bytes.length < 10) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Recognised so the Import Inbox can say "GIF is not supported yet" instead
  // of "unrecognised file", which is a materially more useful message.
  return { mime: 'image/gif', width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

/** Throws UnsupportedImageError naming what was seen, rather than returning a null the caller might ignore. */
export function sniffImage(bytes: Uint8Array): SniffResult {
  const result = sniffPng(bytes) ?? sniffJpeg(bytes) ?? sniffWebp(bytes) ?? sniffGif(bytes);
  if (!result) {
    const head = [...bytes.subarray(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    throw new UnsupportedImageError(`Not a supported image. First bytes: ${head}`);
  }
  if (result.width <= 0 || result.height <= 0) {
    throw new UnsupportedImageError(`Image reports impossible dimensions ${result.width}x${result.height}.`);
  }
  return result;
}
