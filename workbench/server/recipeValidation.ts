/** Runtime validation for transform recipes crossing the browser/host boundary. */

import type { TransformRecipe } from '../shared/types.ts';
import { SecurityError } from './security.ts';

const MAX_STEPS = 256;
const MAX_DIMENSION = 8192;
const MAX_POINTS = 4096;

type UnknownRecord = Readonly<Record<string, unknown>>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;
}

function finite(value: unknown, min: number, max: number, integer = false): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
}

function color(value: unknown): boolean {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

function fail(index: number, message: string): never {
  throw new SecurityError(400, `Invalid transform recipe step ${index + 1}: ${message}`);
}

function validRect(value: unknown): boolean {
  const rect = record(value);
  return rect !== null
    && finite(rect.x, -MAX_DIMENSION, MAX_DIMENSION)
    && finite(rect.y, -MAX_DIMENSION, MAX_DIMENSION)
    && finite(rect.width, 1, MAX_DIMENSION)
    && finite(rect.height, 1, MAX_DIMENSION);
}

/**
 * Parses the untrusted JSON shape rather than casting it. Bounds are part of
 * the contract: a recipe is persisted and replayed later, so accepting a
 * billion-pixel scale or blur here merely schedules a future memory failure.
 */
export function assertTransformRecipe(value: unknown): TransformRecipe {
  const recipe = record(value);
  if (recipe?.version !== 1 || !Array.isArray(recipe.steps)) {
    throw new SecurityError(400, 'Transform recipe must have version 1 and a steps array.');
  }
  if (recipe.steps.length > MAX_STEPS) {
    throw new SecurityError(400, `Transform recipe has ${recipe.steps.length} steps; the limit is ${MAX_STEPS}.`);
  }

  for (let index = 0; index < recipe.steps.length; index++) {
    const step = record(recipe.steps[index]);
    if (!step || typeof step.op !== 'string') fail(index, 'step must be an object with an operation name.');
    switch (step.op) {
      case 'crop':
        if (!validRect(step.rect)) fail(index, 'crop rectangle is malformed or out of bounds.');
        break;
      case 'trimAlpha':
        if (!finite(step.threshold, 0, 255)) fail(index, 'alpha threshold must be between 0 and 255.');
        break;
      case 'scale':
        if (!finite(step.width, 1, MAX_DIMENSION, true) || !finite(step.height, 1, MAX_DIMENSION, true)) fail(index, `scale dimensions must be whole pixels from 1 to ${MAX_DIMENSION}.`);
        if (step.mode !== 'nearest' && step.mode !== 'smooth') fail(index, 'scale mode must be nearest or smooth.');
        break;
      case 'flip':
        if (step.axis !== 'horizontal' && step.axis !== 'vertical') fail(index, 'flip axis must be horizontal or vertical.');
        break;
      case 'rotate':
        if (!finite(step.quarterTurns, -1_000_000, 1_000_000, true)) fail(index, 'rotation must be a finite whole number of quarter turns.');
        break;
      case 'removeBackground':
        if (!finite(step.sampleX, 0, MAX_DIMENSION, true) || !finite(step.sampleY, 0, MAX_DIMENSION, true)) fail(index, 'background sample must use bounded whole-pixel coordinates.');
        if (!finite(step.tolerance, 0, 442) || typeof step.edgeConnected !== 'boolean') fail(index, 'background tolerance or edge mode is invalid.');
        break;
      case 'maskStroke': {
        if (step.mode !== 'erase' && step.mode !== 'restore') fail(index, 'mask mode must be erase or restore.');
        if (!Array.isArray(step.points) || step.points.length === 0 || step.points.length > MAX_POINTS) fail(index, `mask stroke must contain 1 to ${MAX_POINTS} points.`);
        if (!step.points.every((point) => Array.isArray(point) && point.length === 2 && finite(point[0], -MAX_DIMENSION, MAX_DIMENSION) && finite(point[1], -MAX_DIMENSION, MAX_DIMENSION))) fail(index, 'mask stroke contains an invalid point.');
        if (!finite(step.radius, 1, 512)) fail(index, 'mask radius must be between 1 and 512.');
        break;
      }
      case 'invertMask':
        break;
      case 'growAlpha':
      case 'shrinkAlpha':
        if (!finite(step.pixels, 0, 512, true)) fail(index, 'mask growth must be a whole number from 0 to 512.');
        break;
      case 'featherAlpha':
        if (!finite(step.radius, 0, 64, true)) fail(index, 'feather radius must be a whole number from 0 to 64.');
        break;
      case 'component':
        if (!finite(step.index, 0, 65_535, true) || !finite(step.alphaThreshold, 0, 255)) fail(index, 'component index or alpha threshold is invalid.');
        break;
      case 'gridCell':
        if (!finite(step.columns, 1, 256, true) || !finite(step.rows, 1, 256, true) || !finite(step.cell, 0, 65_535, true)) fail(index, 'grid values must be bounded whole numbers.');
        if ((step.cell as number) >= (step.columns as number) * (step.rows as number)) fail(index, 'grid cell lies outside its rows and columns.');
        break;
      case 'alignFrame':
        if (step.anchor !== 'center' && step.anchor !== 'bottom-center') fail(index, 'frame anchor must be center or bottom-center.');
        if (!finite(step.alphaThreshold, 0, 255)) fail(index, 'frame alpha threshold must be between 0 and 255.');
        break;
      case 'outline':
        if (!color(step.color) || !finite(step.thickness, 1, 512, true)) fail(index, 'outline color or thickness is invalid.');
        break;
      case 'dropShadow':
        if (!finite(step.offsetX, -MAX_DIMENSION, MAX_DIMENSION) || !finite(step.offsetY, -MAX_DIMENSION, MAX_DIMENSION) || !color(step.color) || !finite(step.blur, 0, 128, true)) fail(index, 'drop-shadow offset, color, or blur is invalid.');
        break;
      case 'silhouette':
        if (!color(step.color)) fail(index, 'silhouette color is invalid.');
        break;
      case 'tint':
      case 'damageFlash':
        if (!color(step.color) || !finite(step.amount, 0, 1)) fail(index, 'effect color or amount is invalid.');
        break;
      case 'desaturate':
        if (!finite(step.amount, 0, 1)) fail(index, 'desaturation amount must be between 0 and 1.');
        break;
      default:
        fail(index, `unknown operation ${JSON.stringify(step.op)}.`);
    }
  }

  return value as TransformRecipe;
}
