/**
 * Tests for color utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  luminance,
  contrastRatio,
  lighten,
  darken,
  mix,
  isLight,
  readableTextColor,
} from '../shared/colorUtils.ts';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('parses without hash', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
  });

  it('clamps values', () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });
});

describe('luminance', () => {
  it('white has luminance 1', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
  });

  it('black has luminance 0', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 2);
  });
});

describe('contrastRatio', () => {
  it('black and white have max contrast', () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('same color has ratio 1', () => {
    const ratio = contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
    expect(ratio).toBeCloseTo(1, 2);
  });
});

describe('lighten', () => {
  it('lightens toward white', () => {
    const result = lighten({ r: 0, g: 0, b: 0 }, 0.5);
    expect(result.r).toBeCloseTo(127.5);
    expect(result.g).toBeCloseTo(127.5);
    expect(result.b).toBeCloseTo(127.5);
  });
});

describe('darken', () => {
  it('darkens toward black', () => {
    const result = darken({ r: 200, g: 200, b: 200 }, 0.5);
    expect(result.r).toBeCloseTo(100);
    expect(result.g).toBeCloseTo(100);
    expect(result.b).toBeCloseTo(100);
  });
});

describe('mix', () => {
  it('mixes two colors', () => {
    const result = mix({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5);
    expect(result.r).toBeCloseTo(127.5);
  });

  it('ratio 0 returns first color', () => {
    const result = mix({ r: 100, g: 0, b: 0 }, { r: 0, g: 0, b: 100 }, 0);
    expect(result.r).toBe(100);
    expect(result.b).toBe(0);
  });

  it('ratio 1 returns second color', () => {
    const result = mix({ r: 100, g: 0, b: 0 }, { r: 0, g: 0, b: 100 }, 1);
    expect(result.r).toBe(0);
    expect(result.b).toBe(100);
  });
});

describe('isLight', () => {
  it('white is light', () => {
    expect(isLight({ r: 255, g: 255, b: 255 })).toBe(true);
  });

  it('black is not light', () => {
    expect(isLight({ r: 0, g: 0, b: 0 })).toBe(false);
  });
});

describe('readableTextColor', () => {
  it('returns black for light backgrounds', () => {
    const text = readableTextColor({ r: 255, g: 255, b: 255 });
    expect(text.r).toBe(0);
    expect(text.g).toBe(0);
    expect(text.b).toBe(0);
  });

  it('returns white for dark backgrounds', () => {
    const text = readableTextColor({ r: 0, g: 0, b: 0 });
    expect(text.r).toBe(255);
    expect(text.g).toBe(255);
    expect(text.b).toBe(255);
  });
});
