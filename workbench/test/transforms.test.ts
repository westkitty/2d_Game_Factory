import { describe, expect, it } from 'vitest';
import { createRaster, rasterFrom, setPixel, parseHexColor, toHexColor, RasterError } from '../shared/image/raster.ts';
import {
  alphaBounds,
  crop,
  desaturate,
  extractComponent,
  extractPalette,
  featherAlpha,
  findComponents,
  flip,
  gridCell,
  growAlpha,
  hasAlpha,
  invertMask,
  looksLikePixelArt,
  maskStroke,
  outline,
  removeBackground,
  rotate,
  scale,
  shrinkAlpha,
  silhouette,
  suggestGrids,
  tint,
  trimAlpha,
} from '../shared/image/transforms.ts';

/**
 * Fills a solid rectangle inside an otherwise transparent raster - the
 * fixture shape most of these assertions need.
 */
function withRect(width: number, height: number, rect: { x: number; y: number; width: number; height: number }, color: [number, number, number, number]) {
  const raster = createRaster(width, height);
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) setPixel(raster, x, y, ...color);
  }
  return raster;
}

describe('raster primitives', () => {
  it('rejects non-positive dimensions rather than producing an empty buffer', () => {
    expect(() => createRaster(0, 4)).toThrow(RasterError);
    expect(() => createRaster(4, -1)).toThrow(RasterError);
  });

  it('rejects a data buffer whose length contradicts the dimensions', () => {
    expect(() => rasterFrom(2, 2, new Uint8ClampedArray(8))).toThrow(RasterError);
  });

  it('round-trips hex colours in all three accepted forms', () => {
    expect(parseHexColor('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('#65d0a8')).toEqual({ r: 0x65, g: 0xd0, b: 0xa8 });
    expect(parseHexColor('#65d0a8ff')).toEqual({ r: 0x65, g: 0xd0, b: 0xa8 });
    expect(toHexColor(0x65, 0xd0, 0xa8)).toBe('#65d0a8');
  });

  it('refuses an unparseable colour instead of defaulting to black', () => {
    expect(() => parseHexColor('rebeccapurple')).toThrow(RasterError);
  });
});

describe('crop and trim', () => {
  it('finds the visible bounds of a padded shape', () => {
    const raster = withRect(20, 20, { x: 5, y: 6, width: 4, height: 3 }, [255, 0, 0, 255]);
    expect(alphaBounds(raster)).toEqual({ x: 5, y: 6, width: 4, height: 3 });
  });

  it('trims transparent margins down to the visible bounds', () => {
    const raster = withRect(20, 20, { x: 5, y: 6, width: 4, height: 3 }, [255, 0, 0, 255]);
    const trimmed = trimAlpha(raster);
    expect(trimmed.width).toBe(4);
    expect(trimmed.height).toBe(3);
    expect([...trimmed.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('leaves a fully transparent image alone rather than collapsing it to nothing', () => {
    const raster = createRaster(8, 8);
    const trimmed = trimAlpha(raster);
    expect(trimmed.width).toBe(8);
    expect(trimmed.height).toBe(8);
    expect(alphaBounds(raster)).toBeNull();
  });

  it('clamps a crop rectangle that overhangs the image', () => {
    const raster = withRect(10, 10, { x: 0, y: 0, width: 10, height: 10 }, [1, 2, 3, 255]);
    const cropped = crop(raster, { x: 8, y: 8, width: 10, height: 10 });
    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
  });

  it('refuses a crop rectangle that misses the image entirely', () => {
    const raster = createRaster(10, 10);
    expect(() => crop(raster, { x: 40, y: 40, width: 4, height: 4 })).toThrow(RasterError);
  });

  it('does not mutate its input', () => {
    const raster = withRect(10, 10, { x: 2, y: 2, width: 3, height: 3 }, [9, 9, 9, 255]);
    const before = new Uint8ClampedArray(raster.data);
    crop(raster, { x: 0, y: 0, width: 5, height: 5 });
    trimAlpha(raster);
    expect([...raster.data]).toEqual([...before]);
  });
});

describe('flip and rotate', () => {
  it('mirrors horizontally', () => {
    const raster = withRect(4, 1, { x: 0, y: 0, width: 1, height: 1 }, [255, 0, 0, 255]);
    const flipped = flip(raster, 'horizontal');
    expect(flipped.data[3 * 4 + 3]).toBe(255);
    expect(flipped.data[3]).toBe(0);
  });

  it('is its own inverse', () => {
    const raster = withRect(6, 4, { x: 1, y: 1, width: 2, height: 2 }, [12, 34, 56, 200]);
    expect([...flip(flip(raster, 'vertical'), 'vertical').data]).toEqual([...raster.data]);
  });

  it('swaps dimensions on a quarter turn and restores them on four', () => {
    const raster = withRect(6, 4, { x: 0, y: 0, width: 2, height: 1 }, [1, 2, 3, 255]);
    const turned = rotate(raster, 1);
    expect(turned.width).toBe(4);
    expect(turned.height).toBe(6);
    expect([...rotate(raster, 4).data]).toEqual([...raster.data]);
  });

  it('normalises negative and over-large quarter turns', () => {
    const raster = withRect(6, 4, { x: 0, y: 0, width: 2, height: 1 }, [1, 2, 3, 255]);
    expect([...rotate(raster, -1).data]).toEqual([...rotate(raster, 3).data]);
    expect([...rotate(raster, 5).data]).toEqual([...rotate(raster, 1).data]);
  });
});

describe('scale', () => {
  it('doubles with nearest neighbour without inventing intermediate colours', () => {
    const raster = withRect(2, 2, { x: 0, y: 0, width: 1, height: 1 }, [255, 0, 0, 255]);
    const scaled = scale(raster, 4, 4, 'nearest');
    expect(scaled.width).toBe(4);
    const seen = new Set<string>();
    for (let i = 0; i < scaled.data.length; i += 4) seen.add(`${scaled.data[i]},${scaled.data[i + 1]},${scaled.data[i + 2]},${scaled.data[i + 3]}`);
    expect(seen).toEqual(new Set(['255,0,0,255', '0,0,0,0']));
  });

  it('does not bleed transparent pixels into the average when downscaling', () => {
    // A red square on transparent black: a naive (non-premultiplied) box
    // filter darkens the edges toward 0,0,0. This asserts it does not.
    const raster = withRect(8, 8, { x: 0, y: 0, width: 4, height: 8 }, [255, 0, 0, 255]);
    const scaled = scale(raster, 4, 4, 'smooth');
    for (let i = 0; i < scaled.data.length; i += 4) {
      if (scaled.data[i + 3]! === 0) continue;
      expect(scaled.data[i]).toBe(255);
      expect(scaled.data[i + 1]).toBe(0);
    }
  });

  it('rejects a non-integer or non-positive target', () => {
    const raster = createRaster(4, 4);
    expect(() => scale(raster, 0, 4, 'nearest')).toThrow(RasterError);
    expect(() => scale(raster, 4.5, 4, 'smooth')).toThrow(RasterError);
  });
});

describe('background removal and masking', () => {
  it('clears an edge-connected background but keeps a matching colour inside the subject', () => {
    const raster = createRaster(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) setPixel(raster, x, y, 255, 255, 255, 255);
    // A ring of red with a white hole at its centre.
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) setPixel(raster, x, y, 255, 0, 0, 255);
    setPixel(raster, 4, 4, 255, 255, 255, 255);

    const cleared = removeBackground(raster, 0, 0, 10, true);
    expect(cleared.data[(0 * 9 + 0) * 4 + 3]).toBe(0);
    // The enclosed white pixel is not reachable from the border, so it survives.
    expect(cleared.data[(4 * 9 + 4) * 4 + 3]).toBe(255);
  });

  it('clears every matching pixel in global mode, enclosed or not', () => {
    const raster = createRaster(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) setPixel(raster, x, y, 255, 255, 255, 255);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) setPixel(raster, x, y, 255, 0, 0, 255);
    setPixel(raster, 4, 4, 255, 255, 255, 255);

    const cleared = removeBackground(raster, 0, 0, 10, false);
    expect(cleared.data[(4 * 9 + 4) * 4 + 3]).toBe(0);
  });

  it('erases and restores through the brush, and restore never invents pixels', () => {
    const original = withRect(10, 10, { x: 0, y: 0, width: 5, height: 10 }, [10, 20, 30, 255]);
    const erased = maskStroke(original, original, 'erase', [[2, 2]], 2);
    expect(erased.data[(2 * 10 + 2) * 4 + 3]).toBe(0);

    const restored = maskStroke(erased, original, 'restore', [[2, 2]], 2);
    expect(restored.data[(2 * 10 + 2) * 4 + 3]).toBe(255);

    // Restoring over a region the source never had is a no-op, not an invention.
    const overEmpty = maskStroke(erased, original, 'restore', [[8, 8]], 2);
    expect(overEmpty.data[(8 * 10 + 8) * 4 + 3]).toBe(0);
  });

  it('inverts the alpha channel', () => {
    const raster = withRect(4, 4, { x: 0, y: 0, width: 2, height: 4 }, [1, 2, 3, 255]);
    const inverted = invertMask(raster);
    expect(inverted.data[3]).toBe(0);
    expect(inverted.data[(0 * 4 + 3) * 4 + 3]).toBe(255);
  });

  it('grows and shrinks the mask by whole pixels', () => {
    const raster = withRect(9, 9, { x: 4, y: 4, width: 1, height: 1 }, [200, 100, 50, 255]);
    const grown = growAlpha(raster, 1);
    expect(grown.data[(4 * 9 + 5) * 4 + 3]).toBe(255);
    const shrunk = shrinkAlpha(grown, 1);
    expect(shrunk.data[(4 * 9 + 5) * 4 + 3]).toBe(0);
    expect(shrunk.data[(4 * 9 + 4) * 4 + 3]).toBe(255);
  });

  it('feathers alpha at the edge without touching colour', () => {
    const raster = withRect(9, 9, { x: 3, y: 3, width: 3, height: 3 }, [200, 100, 50, 255]);
    const feathered = featherAlpha(raster, 1);
    // The centre of a 3x3 block has all nine radius-1 neighbours inside the
    // block, so it stays fully opaque - that is the correct box-blur result,
    // not a no-op.
    const centre = (4 * 9 + 4) * 4;
    expect(feathered.data[centre + 3]).toBe(255);
    // A corner of the block does have transparent neighbours, so it softens.
    const corner = (3 * 9 + 3) * 4;
    expect(feathered.data[corner]).toBe(200);
    expect(feathered.data[corner + 3]).toBeLessThan(255);
    expect(feathered.data[corner + 3]).toBeGreaterThan(0);
  });
});

describe('connected components', () => {
  it('finds separate blobs and orders them stably top-to-bottom then left-to-right', () => {
    const raster = createRaster(20, 20);
    for (let y = 12; y < 15; y++) for (let x = 12; x < 15; x++) setPixel(raster, x, y, 0, 255, 0, 255);
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) setPixel(raster, x, y, 255, 0, 0, 255);

    const components = findComponents(raster);
    expect(components).toHaveLength(2);
    expect(components[0]!.bounds).toEqual({ x: 2, y: 2, width: 3, height: 3 });
    expect(components[1]!.bounds).toEqual({ x: 12, y: 12, width: 3, height: 3 });
    // The order does not depend on which blob the scan happened to reach first.
    expect(components[0]!.index).toBe(0);
  });

  it('extracts one component by its stable index', () => {
    const raster = createRaster(20, 20);
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) setPixel(raster, x, y, 255, 0, 0, 255);
    for (let y = 12; y < 16; y++) for (let x = 12; x < 16; x++) setPixel(raster, x, y, 0, 255, 0, 255);

    const second = extractComponent(raster, 1);
    expect(second.width).toBe(4);
    expect(second.data[1]).toBe(255);
  });

  it('names the real component count when asked for one that does not exist', () => {
    const raster = withRect(10, 10, { x: 1, y: 1, width: 3, height: 3 }, [1, 2, 3, 255]);
    expect(() => extractComponent(raster, 5)).toThrow(/1 visible component/);
  });

  it('ignores specks below the minimum pixel count', () => {
    const raster = createRaster(20, 20);
    setPixel(raster, 1, 1, 255, 0, 0, 255);
    expect(findComponents(raster)).toHaveLength(0);
  });
});

describe('grid slicing', () => {
  it('suggests grids the dimensions actually divide into', () => {
    const suggestions = suggestGrids(128, 32);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(128 % suggestion.columns).toBe(0);
      expect(32 % suggestion.rows).toBe(0);
      expect(suggestion.frameWidth).toBe(128 / suggestion.columns);
    }
    // 4x1 gives square 32x32 frames, which is the most plausible reading.
    expect(suggestions[0]).toEqual({ columns: 4, rows: 1, frameWidth: 32, frameHeight: 32 });
  });

  it('suggests nothing for dimensions with no plausible division', () => {
    expect(suggestGrids(17, 13)).toHaveLength(0);
  });

  it('extracts the requested cell', () => {
    const raster = createRaster(8, 4);
    for (let y = 0; y < 4; y++) for (let x = 4; x < 8; x++) setPixel(raster, x, y, 0, 0, 255, 255);
    const cell = gridCell(raster, 2, 1, 1);
    expect(cell.width).toBe(4);
    expect(cell.data[2]).toBe(255);
  });

  it('refuses a cell outside the grid and a grid that does not fit', () => {
    const raster = createRaster(8, 4);
    expect(() => gridCell(raster, 2, 1, 5)).toThrow(RasterError);
    expect(() => gridCell(raster, 0, 1, 0)).toThrow(RasterError);
  });
});

describe('visual variants', () => {
  it('adds an outline outside the silhouette and grows the canvas so nothing clips', () => {
    const raster = withRect(6, 6, { x: 2, y: 2, width: 2, height: 2 }, [255, 255, 255, 255]);
    const outlined = outline(raster, '#ff0000', 1);
    expect(outlined.width).toBe(8);
    expect(outlined.height).toBe(8);
    // Original pixels survive at their offset position.
    expect(outlined.data[((2 + 1) * 8 + (2 + 1)) * 4]).toBe(255);
    // The ring immediately around them is the outline colour.
    const ring = ((2 + 1 - 1) * 8 + (2 + 1)) * 4;
    expect(outlined.data[ring]).toBe(255);
    expect(outlined.data[ring + 1]).toBe(0);
  });

  it('flattens colour but preserves alpha in a silhouette', () => {
    const raster = withRect(4, 4, { x: 1, y: 1, width: 2, height: 2 }, [10, 200, 30, 128]);
    const flat = silhouette(raster, '#000000');
    const at = (1 * 4 + 1) * 4;
    expect(flat.data[at]).toBe(0);
    expect(flat.data[at + 3]).toBe(128);
    expect(flat.data[3]).toBe(0);
  });

  it('tints toward a colour proportionally and leaves transparent pixels alone', () => {
    const raster = withRect(4, 4, { x: 0, y: 0, width: 2, height: 4 }, [0, 0, 0, 255]);
    const half = tint(raster, '#ffffff', 0.5);
    expect(half.data[0]).toBeGreaterThan(120);
    expect(half.data[0]).toBeLessThan(136);
    const full = tint(raster, '#ffffff', 1);
    expect(full.data[0]).toBe(255);
    expect(full.data[(0 * 4 + 3) * 4]).toBe(0);
  });

  it('desaturates toward luma', () => {
    const raster = withRect(2, 2, { x: 0, y: 0, width: 2, height: 2 }, [255, 0, 0, 255]);
    const grey = desaturate(raster, 1);
    expect(grey.data[0]).toBe(grey.data[1]);
    expect(grey.data[1]).toBe(grey.data[2]);
  });
});

describe('palette and analysis', () => {
  it('extracts dominant colours deterministically across repeated runs', () => {
    const raster = createRaster(10, 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) setPixel(raster, x, y, x < 5 ? 255 : 0, x < 5 ? 0 : 0, x < 5 ? 0 : 255, 255);
    const first = extractPalette(raster, 4);
    const second = extractPalette(raster, 4);
    expect(first).toEqual(second);
    expect(first).toContain('#ff0000');
    expect(first).toContain('#0000ff');
  });

  it('returns no palette for a fully transparent image rather than inventing one', () => {
    expect(extractPalette(createRaster(8, 8))).toEqual([]);
  });

  it('reports alpha presence honestly', () => {
    const opaque = withRect(4, 4, { x: 0, y: 0, width: 4, height: 4 }, [1, 2, 3, 255]);
    expect(hasAlpha(opaque)).toBe(false);
    expect(hasAlpha(withRect(4, 4, { x: 0, y: 0, width: 2, height: 2 }, [1, 2, 3, 255]))).toBe(true);
  });

  it('flags a small, few-colour image as likely pixel art and a large gradient as not', () => {
    const small = withRect(32, 32, { x: 0, y: 0, width: 32, height: 32 }, [200, 40, 40, 255]);
    expect(looksLikePixelArt(small)).toBe(true);

    const big = createRaster(600, 600);
    for (let y = 0; y < 600; y++) for (let x = 0; x < 600; x++) setPixel(big, x, y, x % 256, y % 256, (x + y) % 256, 255);
    expect(looksLikePixelArt(big)).toBe(false);
  });
});
