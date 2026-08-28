import { describe, expect, it } from 'vitest';
import { assertTransformRecipe } from '../server/recipeValidation.ts';
import { SecurityError } from '../server/security.ts';

describe('transform recipe input boundary', () => {
  it('accepts a complete valid sprite-frame recipe', () => {
    const recipe = {
      version: 1,
      steps: [
        { op: 'gridCell', columns: 4, rows: 2, cell: 3 },
        { op: 'alignFrame', anchor: 'bottom-center', alphaThreshold: 8 },
        { op: 'tint', color: '#65d0a8', amount: 0.3 },
      ],
    };
    expect(assertTransformRecipe(recipe)).toBe(recipe);
  });

  it('rejects a non-array step payload instead of persisting a time bomb', () => {
    expect(() => assertTransformRecipe({ version: 1, steps: 'crop' })).toThrow(SecurityError);
  });

  it('rejects unknown operations and unsafe allocations', () => {
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'downloadInternet' }] })).toThrow(/unknown operation/);
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'scale', width: 1_000_000_000, height: 32, mode: 'nearest' }] })).toThrow(/scale dimensions/);
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'featherAlpha', radius: Number.POSITIVE_INFINITY }] })).toThrow(/feather radius/);
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'silhouette', color: '#abcde' }] })).toThrow(/color/);
  });

  it('rejects fractional or out-of-range grid coordinates', () => {
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'gridCell', columns: 2.5, rows: 1, cell: 0 }] })).toThrow(/grid values/);
    expect(() => assertTransformRecipe({ version: 1, steps: [{ op: 'gridCell', columns: 2, rows: 1, cell: 2 }] })).toThrow(/outside/);
  });
});
