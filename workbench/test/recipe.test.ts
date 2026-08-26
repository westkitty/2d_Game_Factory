import { describe, expect, it } from 'vitest';
import { createRaster, setPixel } from '../shared/image/raster.ts';
import { RecipeError, applyRecipe, describeRecipe, describeStep, pushStep, truncateRecipe } from '../shared/image/recipe.ts';
import { decodePng, encodePng } from '../server/png.ts';
import { EMPTY_RECIPE, type TransformRecipe } from '../shared/types.ts';

function fixture(): ReturnType<typeof createRaster> {
  const raster = createRaster(16, 16);
  for (let y = 4; y < 12; y++) {
    for (let x = 4; x < 12; x++) setPixel(raster, x, y, 200, 60, 40, 255);
  }
  return raster;
}

describe('recipe replay', () => {
  it('an empty recipe yields a copy of the source, not the source itself', () => {
    const source = fixture();
    const out = applyRecipe(source, EMPTY_RECIPE);
    expect([...out.data]).toEqual([...source.data]);
    expect(out.data).not.toBe(source.data);
  });

  it('never mutates the source, however many derivatives are taken from it (P01)', () => {
    const source = fixture();
    const before = new Uint8ClampedArray(source.data);
    const recipes: TransformRecipe[] = [
      { version: 1, steps: [{ op: 'trimAlpha', threshold: 8 }] },
      { version: 1, steps: [{ op: 'flip', axis: 'horizontal' }, { op: 'scale', width: 8, height: 8, mode: 'nearest' }] },
      { version: 1, steps: [{ op: 'outline', color: '#000000', thickness: 1 }] },
      { version: 1, steps: [{ op: 'desaturate', amount: 1 }, { op: 'tint', color: '#00ff00', amount: 0.4 }] },
      { version: 1, steps: [{ op: 'removeBackground', sampleX: 0, sampleY: 0, tolerance: 10, edgeConnected: true }] },
    ];
    for (const recipe of recipes) applyRecipe(source, recipe);
    expect([...source.data]).toEqual([...before]);
  });

  it('is deterministic: replaying the same recipe twice produces identical bytes (P03)', () => {
    const source = fixture();
    const recipe: TransformRecipe = {
      version: 1,
      steps: [
        { op: 'trimAlpha', threshold: 8 },
        { op: 'scale', width: 24, height: 24, mode: 'smooth' },
        { op: 'outline', color: '#101318', thickness: 2 },
        { op: 'tint', color: '#65d0a8', amount: 0.35 },
      ],
    };
    const first = encodePng(applyRecipe(source, recipe));
    const second = encodePng(applyRecipe(source, recipe));
    expect([...first]).toEqual([...second]);
  });

  it('survives a PNG round trip, so a rebuilt derivative equals the stored one', () => {
    const source = fixture();
    const recipe: TransformRecipe = { version: 1, steps: [{ op: 'trimAlpha', threshold: 8 }, { op: 'flip', axis: 'horizontal' }] };
    const direct = applyRecipe(source, recipe);
    const viaFile = applyRecipe(decodePng(encodePng(source)), recipe);
    expect([...viaFile.data]).toEqual([...direct.data]);
  });

  it('reports which step failed and why, rather than a bare stack', () => {
    const source = fixture();
    const recipe: TransformRecipe = {
      version: 1,
      steps: [{ op: 'trimAlpha', threshold: 8 }, { op: 'gridCell', columns: 3, rows: 1, cell: 9 }],
    };
    expect(() => applyRecipe(source, recipe)).toThrow(RecipeError);
    expect(() => applyRecipe(source, recipe)).toThrow(/step 1 \("gridCell"\)/);
  });

  it('executes every declared step kind without an unhandled op', () => {
    const source = fixture();
    const everyStep: TransformRecipe = {
      version: 1,
      steps: [
        { op: 'removeBackground', sampleX: 0, sampleY: 0, tolerance: 8, edgeConnected: true },
        { op: 'trimAlpha', threshold: 8 },
        { op: 'maskStroke', mode: 'erase', points: [[1, 1]], radius: 1 },
        { op: 'maskStroke', mode: 'restore', points: [[1, 1]], radius: 1 },
        { op: 'growAlpha', pixels: 1 },
        { op: 'shrinkAlpha', pixels: 1 },
        { op: 'featherAlpha', radius: 1 },
        { op: 'invertMask' },
        { op: 'invertMask' },
        { op: 'crop', rect: { x: 0, y: 0, width: 6, height: 6 } },
        { op: 'gridCell', columns: 2, rows: 2, cell: 0 },
        { op: 'scale', width: 12, height: 12, mode: 'nearest' },
        { op: 'flip', axis: 'vertical' },
        { op: 'rotate', quarterTurns: 1 },
        { op: 'desaturate', amount: 0.5 },
        { op: 'tint', color: '#ff8800', amount: 0.3 },
        { op: 'damageFlash', color: '#ffffff', amount: 0.6 },
        { op: 'silhouette', color: '#000000' },
        { op: 'dropShadow', offsetX: 2, offsetY: 2, color: '#000000', blur: 1 },
        { op: 'outline', color: '#ffffff', thickness: 1 },
      ],
    };
    const out = applyRecipe(source, everyStep);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('extracts a component as a recipe step', () => {
    const source = createRaster(20, 20);
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) setPixel(source, x, y, 255, 0, 0, 255);
    for (let y = 12; y < 17; y++) for (let x = 12; x < 17; x++) setPixel(source, x, y, 0, 0, 255, 255);
    const out = applyRecipe(source, { version: 1, steps: [{ op: 'component', index: 1, alphaThreshold: 8 }] });
    expect(out.width).toBe(5);
    expect(out.data[2]).toBe(255);
  });
});

describe('recipe editing and labels', () => {
  it('appends without mutating the previous recipe - the undo stack depends on it (W08)', () => {
    const base = EMPTY_RECIPE;
    const next = pushStep(base, { op: 'invertMask' });
    expect(base.steps).toHaveLength(0);
    expect(next.steps).toHaveLength(1);
  });

  it('truncates for undo and clamps out-of-range lengths', () => {
    const recipe: TransformRecipe = {
      version: 1,
      steps: [{ op: 'invertMask' }, { op: 'trimAlpha', threshold: 8 }, { op: 'flip', axis: 'horizontal' }],
    };
    expect(truncateRecipe(recipe, 1).steps).toHaveLength(1);
    expect(truncateRecipe(recipe, 0).steps).toHaveLength(0);
    expect(truncateRecipe(recipe, 99).steps).toHaveLength(3);
    expect(truncateRecipe(recipe, -5).steps).toHaveLength(0);
  });

  it('labels every step kind with something a person can read', () => {
    const labels = [
      describeStep({ op: 'crop', rect: { x: 0, y: 0, width: 12, height: 8 } }),
      describeStep({ op: 'rotate', quarterTurns: -1 }),
      describeStep({ op: 'maskStroke', mode: 'erase', points: [[0, 0]], radius: 2 }),
      describeStep({ op: 'component', index: 0, alphaThreshold: 8 }),
      describeStep({ op: 'gridCell', columns: 4, rows: 2, cell: 3 }),
    ];
    expect(labels[0]).toBe('Crop 12x8');
    expect(labels[1]).toBe('Rotate 270 degrees');
    expect(labels[2]).toBe('Erase brush (1 point)');
    expect(labels[3]).toBe('Extract component 1');
    expect(labels[4]).toBe('Grid cell 4 of 4x2');
  });

  it('describes an empty recipe as a copy rather than as nothing', () => {
    expect(describeRecipe(EMPTY_RECIPE)).toBe('Copy of source');
    expect(describeRecipe({ version: 1, steps: [{ op: 'invertMask' }, { op: 'invertMask' }] })).toContain('+1 more');
  });
});
