/**
 * Color utilities for the workbench and generated games.
 *
 * Pure functions for color manipulation, palette extraction, and theme
 * generation. No DOM or canvas dependencies - works in any JavaScript
 * environment.
 */

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface HSL {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/**
 * Converts a hex color string to RGB.
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const value = parseInt(full, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/**
 * Converts RGB to hex string.
 */
export function rgbToHex(rgb: RGB): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((clamp(rgb.r) << 16) | (clamp(rgb.g) << 8) | clamp(rgb.b)).toString(16).padStart(6, '0')}`;
}

/**
 * Converts RGB to HSL.
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h, s, l };
}

/**
 * Calculates the perceived luminance of a color (0-1).
 */
export function luminance(rgb: RGB): number {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const toLinear = (c: number): number => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates WCAG contrast ratio between two colors.
 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Lightens a color by a given amount (0-1).
 */
export function lighten(rgb: RGB, amount: number): RGB {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

/**
 * Darkens a color by a given amount (0-1).
 */
export function darken(rgb: RGB, amount: number): RGB {
  return {
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
  };
}

/**
 * Mixes two colors together by a given ratio (0 = first color, 1 = second).
 */
export function mix(a: RGB, b: RGB, ratio: number): RGB {
  return {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  };
}

/**
 * Generates a complementary color palette from a base color.
 */
export function complementaryPalette(base: RGB): readonly RGB[] {
  const hsl = rgbToHsl(base);
  const complementH = (hsl.h + 0.5) % 1;
  // Approximate HSL to RGB for complement
  return [
    base,
    { r: base.r, g: base.b, b: base.g }, // Simple hue rotation approximation
    lighten(base, 0.3),
    darken(base, 0.3),
  ];
}

/**
 * Checks if a color is "light" (luminance > 0.5).
 */
export function isLight(rgb: RGB): boolean {
  return luminance(rgb) > 0.5;
}

/**
 * Returns black or white depending on which has better contrast.
 */
export function readableTextColor(background: RGB): RGB {
  return isLight(background) ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}
