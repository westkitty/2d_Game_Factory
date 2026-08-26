import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { createRaster, setPixel } from '../shared/image/raster.ts';
import { PngError, decodePng, encodePng, isPng } from '../server/png.ts';

/** Builds a minimal PNG chunk with a correct CRC, so decode-path tests are not written against hand-typed bytes. */
function buildPng(ihdr: Uint8Array, extra: readonly { type: string; data: Uint8Array }[]): Uint8Array {
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = (bytes: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const parts = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extra.map((e) => chunk(e.type, e.data)),
    chunk('IEND', new Uint8Array(0)),
  ];
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

function ihdr(width: number, height: number, bitDepth: number, colorType: number, interlace = 0): Uint8Array {
  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  bytes[8] = bitDepth;
  bytes[9] = colorType;
  bytes[12] = interlace;
  return bytes;
}

describe('PNG codec', () => {
  it('round-trips an RGBA raster byte-for-byte', () => {
    const raster = createRaster(7, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) setPixel(raster, x, y, x * 30, y * 50, (x + y) * 20, x === 0 ? 0 : 255);
    }
    const decoded = decodePng(encodePng(raster));
    expect(decoded.width).toBe(7);
    expect(decoded.height).toBe(5);
    expect([...decoded.data]).toEqual([...raster.data]);
  });

  it('encodes deterministically: the same pixels produce the same bytes', () => {
    const raster = createRaster(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPixel(raster, x, y, x * 16, y * 16, 128, 255);
    expect([...encodePng(raster)]).toEqual([...encodePng(raster)]);
  });

  it('recognises its own signature and rejects other bytes', () => {
    const raster = createRaster(2, 2);
    expect(isPng(encodePng(raster))).toBe(true);
    expect(isPng(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(() => decodePng(Uint8Array.from([1, 2, 3]))).toThrow(PngError);
  });

  it('decodes greyscale, greyscale+alpha, RGB and palette colour types', () => {
    // 2x1 greyscale: filter byte then two samples per row.
    const grey = buildPng(ihdr(2, 1, 8, 0), [{ type: 'IDAT', data: new Uint8Array(deflateSync(Uint8Array.from([0, 10, 200]))) }]);
    const greyOut = decodePng(grey);
    expect([...greyOut.data.slice(0, 4)]).toEqual([10, 10, 10, 255]);
    expect([...greyOut.data.slice(4, 8)]).toEqual([200, 200, 200, 255]);

    const greyAlpha = buildPng(ihdr(2, 1, 8, 4), [{ type: 'IDAT', data: new Uint8Array(deflateSync(Uint8Array.from([0, 10, 128, 200, 0]))) }]);
    const greyAlphaOut = decodePng(greyAlpha);
    expect([...greyAlphaOut.data.slice(0, 4)]).toEqual([10, 10, 10, 128]);
    expect(greyAlphaOut.data[7]).toBe(0);

    const rgb = buildPng(ihdr(1, 1, 8, 2), [{ type: 'IDAT', data: new Uint8Array(deflateSync(Uint8Array.from([0, 1, 2, 3]))) }]);
    expect([...decodePng(rgb).data]).toEqual([1, 2, 3, 255]);

    const paletted = buildPng(ihdr(2, 1, 8, 3), [
      { type: 'PLTE', data: Uint8Array.from([255, 0, 0, 0, 255, 0]) },
      { type: 'tRNS', data: Uint8Array.from([255, 64]) },
      { type: 'IDAT', data: new Uint8Array(deflateSync(Uint8Array.from([0, 0, 1]))) },
    ]);
    const palettedOut = decodePng(paletted);
    expect([...palettedOut.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...palettedOut.data.slice(4, 8)]).toEqual([0, 255, 0, 64]);
  });

  it('reverses every scanline filter type', () => {
    // Four rows of one RGBA pixel each, using filters 0 (None), 1 (Sub),
    // 2 (Up), 3 (Average) and 4 (Paeth) in turn. With one pixel per row and
    // no left neighbour, Sub is a no-op and Up/Average/Paeth predict from
    // the row above.
    const rows = Uint8Array.from([
      0, 10, 20, 30, 255, // None       -> 10,20,30,255
      1, 5, 5, 5, 0, //     Sub (no left) -> 5,5,5,0
      2, 1, 1, 1, 0, //     Up          -> 6,6,6,0
      4, 2, 2, 2, 0, //     Paeth       -> 8,8,8,0
    ]);
    const png = buildPng(ihdr(1, 4, 8, 6), [{ type: 'IDAT', data: new Uint8Array(deflateSync(rows)) }]);
    const out = decodePng(png);
    expect([...out.data.slice(0, 4)]).toEqual([10, 20, 30, 255]);
    expect([...out.data.slice(4, 8)]).toEqual([5, 5, 5, 0]);
    expect([...out.data.slice(8, 12)]).toEqual([6, 6, 6, 0]);
    expect([...out.data.slice(12, 16)]).toEqual([8, 8, 8, 0]);
  });

  it('refuses an interlaced PNG with a message that says why, rather than scrambling it', () => {
    const png = buildPng(ihdr(2, 2, 8, 6, 1), [{ type: 'IDAT', data: new Uint8Array(deflateSync(new Uint8Array(18))) }]);
    expect(() => decodePng(png)).toThrow(/[Ii]nterlaced/);
  });

  it('refuses an unsupported bit depth and an unsupported colour type by name', () => {
    const lowDepth = buildPng(ihdr(2, 2, 4, 0), [{ type: 'IDAT', data: new Uint8Array(deflateSync(new Uint8Array(6))) }]);
    expect(() => decodePng(lowDepth)).toThrow(/bit depth 4/);

    const badType = buildPng(ihdr(2, 2, 8, 5), [{ type: 'IDAT', data: new Uint8Array(deflateSync(new Uint8Array(18))) }]);
    expect(() => decodePng(badType)).toThrow(/colour type 5/);
  });

  it('refuses a file with no IDAT and one with no IHDR', () => {
    const noIdat = buildPng(ihdr(2, 2, 8, 6), []);
    expect(() => decodePng(noIdat)).toThrow(/no IDAT/);
  });

  it('refuses truncated pixel data instead of returning a partly-black image', () => {
    const png = buildPng(ihdr(4, 4, 8, 6), [{ type: 'IDAT', data: new Uint8Array(deflateSync(new Uint8Array(10))) }]);
    expect(() => decodePng(png)).toThrow(/expected at least/);
  });
});
