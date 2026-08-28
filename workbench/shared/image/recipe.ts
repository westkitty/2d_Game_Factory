/**
 * Recipe replay - the mechanism behind principles P03 (every derivative is
 * reproducible) and P04 (reimport is first-class).
 *
 * `applyRecipe(source, recipe)` is a pure fold over the steps. The same
 * function runs in the browser (fed by a canvas) and on the local host (fed by
 * the pure PNG decoder), so "rebuild this derivative from its source" is one
 * code path with one set of tests, not two implementations that drift.
 */

import type { TransformRecipe, TransformStep } from '../types.ts';
import { type Raster, cloneRaster } from './raster.ts';
import {
  alignFrame,
  crop,
  damageFlash,
  desaturate,
  dropShadow,
  extractComponent,
  featherAlpha,
  flip,
  gridCell,
  growAlpha,
  invertMask,
  maskStroke,
  outline,
  removeBackground,
  rotate,
  scale,
  shrinkAlpha,
  silhouette,
  tint,
  trimAlpha,
} from './transforms.ts';

export class RecipeError extends Error {
  constructor(stepIndex: number, op: string, cause: string) {
    super(`Recipe step ${stepIndex} ("${op}") failed: ${cause}`);
    this.name = 'RecipeError';
  }
}

/**
 * `original` is the untouched source. Only `maskStroke`'s restore mode needs
 * it - a restore brush may only bring back alpha the source actually had, so
 * a stroke can never invent pixels that were never there.
 */
export function applyStep(current: Raster, step: TransformStep, original: Raster): Raster {
  switch (step.op) {
    case 'crop':
      return crop(current, step.rect);
    case 'trimAlpha':
      return trimAlpha(current, step.threshold);
    case 'scale':
      return scale(current, step.width, step.height, step.mode);
    case 'flip':
      return flip(current, step.axis);
    case 'rotate':
      return rotate(current, step.quarterTurns);
    case 'removeBackground':
      return removeBackground(current, step.sampleX, step.sampleY, step.tolerance, step.edgeConnected);
    case 'maskStroke':
      return maskStroke(current, original, step.mode, step.points, step.radius);
    case 'invertMask':
      return invertMask(current);
    case 'growAlpha':
      return growAlpha(current, step.pixels);
    case 'shrinkAlpha':
      return shrinkAlpha(current, step.pixels);
    case 'featherAlpha':
      return featherAlpha(current, step.radius);
    case 'component':
      return extractComponent(current, step.index, step.alphaThreshold);
    case 'gridCell':
      return gridCell(current, step.columns, step.rows, step.cell);
    case 'alignFrame':
      return alignFrame(current, step.anchor, step.alphaThreshold);
    case 'outline':
      return outline(current, step.color, step.thickness);
    case 'dropShadow':
      return dropShadow(current, step.offsetX, step.offsetY, step.color, step.blur);
    case 'silhouette':
      return silhouette(current, step.color);
    case 'tint':
      return tint(current, step.color, step.amount);
    case 'desaturate':
      return desaturate(current, step.amount);
    case 'damageFlash':
      return damageFlash(current, step.color, step.amount);
  }
}

export function applyRecipe(source: Raster, recipe: TransformRecipe): Raster {
  let current = cloneRaster(source);
  for (let index = 0; index < recipe.steps.length; index++) {
    const step = recipe.steps[index]!;
    try {
      current = applyStep(current, step, source);
    } catch (error) {
      throw new RecipeError(index, step.op, error instanceof Error ? error.message : String(error));
    }
  }
  return current;
}

/** A short human-facing label for one step - what the Asset Lab's history list shows. */
export function describeStep(step: TransformStep): string {
  switch (step.op) {
    case 'crop':
      return `Crop ${Math.round(step.rect.width)}x${Math.round(step.rect.height)}`;
    case 'trimAlpha':
      return 'Trim transparent margins';
    case 'scale':
      return `Scale to ${step.width}x${step.height} (${step.mode})`;
    case 'flip':
      return `Flip ${step.axis}`;
    case 'rotate':
      return `Rotate ${(((step.quarterTurns % 4) + 4) % 4) * 90} degrees`;
    case 'removeBackground':
      return `Remove background (tolerance ${step.tolerance}${step.edgeConnected ? ', edge-connected' : ', global'})`;
    case 'maskStroke':
      return `${step.mode === 'erase' ? 'Erase' : 'Restore'} brush (${step.points.length} point${step.points.length === 1 ? '' : 's'})`;
    case 'invertMask':
      return 'Invert mask';
    case 'growAlpha':
      return `Expand mask ${step.pixels}px`;
    case 'shrinkAlpha':
      return `Contract mask ${step.pixels}px`;
    case 'featherAlpha':
      return `Feather mask ${step.radius}px`;
    case 'component':
      return `Extract component ${step.index + 1}`;
    case 'gridCell':
      return `Grid cell ${step.cell + 1} of ${step.columns}x${step.rows}`;
    case 'alignFrame':
      return `Align frame ${step.anchor === 'center' ? 'to center' : 'to bottom center'}`;
    case 'outline':
      return `Outline ${step.thickness}px ${step.color}`;
    case 'dropShadow':
      return `Drop shadow ${step.offsetX},${step.offsetY}`;
    case 'silhouette':
      return `Silhouette ${step.color}`;
    case 'tint':
      return `Tint ${step.color} ${Math.round(step.amount * 100)}%`;
    case 'desaturate':
      return `Desaturate ${Math.round(step.amount * 100)}%`;
    case 'damageFlash':
      return `Damage flash ${step.color}`;
  }
}

/** A short label for a whole recipe - what the asset library shows under a derived thumbnail. */
export function describeRecipe(recipe: TransformRecipe): string {
  if (recipe.steps.length === 0) return 'Copy of source';
  if (recipe.steps.length === 1) return describeStep(recipe.steps[0]!);
  return `${describeStep(recipe.steps[recipe.steps.length - 1]!)} (+${recipe.steps.length - 1} more)`;
}

export function pushStep(recipe: TransformRecipe, step: TransformStep): TransformRecipe {
  return { version: 1, steps: [...recipe.steps, step] };
}

export function truncateRecipe(recipe: TransformRecipe, length: number): TransformRecipe {
  return { version: 1, steps: recipe.steps.slice(0, Math.max(0, Math.min(length, recipe.steps.length))) };
}
