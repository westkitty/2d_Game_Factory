/**
 * Generates the workbench's QA fixture art.
 *
 * Every fixture is drawn here, procedurally and deterministically, so the
 * committed files are unambiguously project-owned and generated - no
 * third-party asset with unclear clearance enters this repository, which is
 * the same rule `resource-policy.json` applies to everything else.
 *
 * Run with: node workbench/fixtures/generate.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRaster, setPixel, parseHexColor } from '../shared/image/raster.ts';
import { compositeOver } from '../shared/image/transforms.ts';
import { encodePng } from '../server/png.ts';
import type { Raster } from '../shared/image/raster.ts';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

function fillRect(raster: Raster, x0: number, y0: number, width: number, height: number, hex: string, alpha = 255): void {
  const { r, g, b } = parseHexColor(hex);
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) setPixel(raster, x, y, r, g, b, alpha);
  }
}

function fillEllipse(raster: Raster, cx: number, cy: number, rx: number, ry: number, hex: string): void {
  const { r, g, b } = parseHexColor(hex);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(raster, x, y, r, g, b, 255);
    }
  }
}

/**
 * A transparent character cut-out: a rounded body, two eyes and two feet on a
 * fully transparent field. Distinctive on purpose - the W16 proof needs a
 * texture that could not be mistaken for the generated placeholder, and its
 * unusual 96x128 size is itself part of the assertion.
 */
function weasel(): Raster {
  const raster = createRaster(96, 128);
  fillEllipse(raster, 48, 74, 30, 46, '#c86a2e'); // body
  fillEllipse(raster, 48, 34, 24, 24, '#e08a44'); // head
  fillEllipse(raster, 48, 88, 20, 30, '#f0c9a0'); // belly
  fillEllipse(raster, 36, 30, 5, 6, '#12161d'); // eyes
  fillEllipse(raster, 60, 30, 5, 6, '#12161d');
  fillEllipse(raster, 48, 42, 4, 3, '#7a2f1c'); // nose
  fillEllipse(raster, 32, 16, 8, 9, '#c86a2e'); // ears
  fillEllipse(raster, 64, 16, 8, 9, '#c86a2e');
  fillEllipse(raster, 34, 120, 11, 7, '#8f4a1e'); // feet
  fillEllipse(raster, 62, 120, 11, 7, '#8f4a1e');
  fillEllipse(raster, 82, 96, 12, 26, '#a5551f'); // tail
  return raster;
}

/** An opaque scene: sky gradient, hills, a sun. Wide and fully opaque, so the role heuristics read it as scenery. */
function palace(): Raster {
  const raster = createRaster(480, 270);
  for (let y = 0; y < 270; y++) {
    const t = y / 270;
    const r = Math.round(28 + t * 60);
    const g = Math.round(38 + t * 90);
    const b = Math.round(74 + t * 60);
    for (let x = 0; x < 480; x++) setPixel(raster, x, y, r, g, b, 255);
  }
  fillEllipse(raster, 388, 62, 30, 30, '#f6d98a');
  for (let x = 0; x < 480; x++) {
    const hill = Math.round(200 + Math.sin(x / 46) * 16 + Math.sin(x / 17) * 5);
    for (let y = hill; y < 270; y++) setPixel(raster, x, y, 40, 78, 62, 255);
  }
  fillRect(raster, 150, 120, 74, 92, '#5d4a7a');
  fillRect(raster, 168, 96, 38, 30, '#6f5990');
  fillRect(raster, 176, 156, 22, 56, '#2b2340');
  return raster;
}

/** A 4x2 sprite sheet: eight distinctly-coloured shapes on a 256x128 field, so grid suggestions have an obvious right answer. */
function sheet(): Raster {
  const raster = createRaster(256, 128);
  const colors = ['#e0574f', '#f0c274', '#65d0a8', '#4f9ee0', '#b98af0', '#e05fa0', '#5affe0', '#ffb454'];
  for (let index = 0; index < 8; index++) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    fillEllipse(raster, column * 64 + 32, row * 64 + 32, 22 - index, 22, colors[index]!);
  }
  return raster;
}

/** Two clearly separated blobs, for the connected-component split journey. */
function twoPieces(): Raster {
  const raster = createRaster(160, 80);
  fillEllipse(raster, 36, 40, 26, 30, '#61d3a4');
  fillEllipse(raster, 122, 40, 22, 26, '#e05fa0');
  return raster;
}

/** One walk frame: the character shifted and tinted per frame, so a frame group is visibly a group. */
function walkFrame(index: number): Raster {
  const base = weasel();
  const raster = createRaster(96, 128);
  // Offsets chosen so no two frames are byte-identical. They were, once:
  // a sine that returned to zero made frame 0 and frame 4 the same image, so
  // the "separate group" fixture was silently a duplicate of the first frame.
  // No zero offset: frame 0 must not be byte-identical to the base weasel
  // fixture either, or the two would collide as duplicates across files.
  const lean = [2, 4, -3, 6, -6][index % 5]!;
  const bob = [1, 2, 3, 1, 4][index % 5]!;
  compositeOver(raster, base, lean, bob);
  return raster;
}

/** A small, distinctly-coloured tile - the batch pack is made of these so the pack stays a few hundred KB. */
function packTile(index: number): Raster {
  const raster = createRaster(48, 48);
  const hue = (index * 37) % 360;
  const hex = hslToHex(hue, 0.55, 0.5);
  fillRect(raster, 0, 0, 48, 48, hex);
  fillRect(raster, 6, 6, 36, 36, hslToHex((hue + 40) % 360, 0.6, 0.35));
  fillEllipse(raster, 24, 24, 10, 10, '#f4f7fb');
  return raster;
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const part = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function write(relativePath: string, raster: Raster): void {
  const full = path.join(ROOT, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, encodePng(raster));
  console.log(`${relativePath}  ${raster.width}x${raster.height}`);
}

write('weasel.png', weasel());
write('weasel-alt.png', (() => {
  // A visibly different second version of the same character - the reimport
  // journey needs a replacement whose pixels are unmistakably not the original.
  const raster = weasel();
  for (let i = 0; i < raster.data.length; i += 4) {
    if (raster.data[i + 3]! === 0) continue;
    const r = raster.data[i]!;
    raster.data[i] = raster.data[i + 2]!;
    raster.data[i + 2] = r;
  }
  return raster;
})());
write('palace.png', palace());
write('sheet-4x2.png', sheet());
write('two-pieces.png', twoPieces());

// Mixed naming conventions on purpose (P07): a tolerant grouper must put all
// five in one group despite three different conventions.
write('frames/walk_01.png', walkFrame(0));
write('frames/walk-2.png', walkFrame(1));
write('frames/walk0003.png', walkFrame(2));
write('frames/walk_04.png', walkFrame(3));
write('frames/hero_idle_0.png', walkFrame(4));

// A pack large enough that decoding it all at once would be visible, without
// being obnoxious: 60 small tiles.
for (let index = 0; index < 60; index++) {
  write(`pack/tile-${String(index).padStart(3, '0')}.png`, packTile(index));
}

console.log('Fixtures generated.');
