/**
 * Materialize the ignored medium-pack fixture required by WB-BATCH-001.
 *
 * `workbench/fixtures/pack/` is intentionally ignored by the repository's
 * generic `pack/` rule, so a clean checkout cannot rely on those generated
 * PNGs already being present. Build them deterministically before the browser
 * suite instead of smuggling machine state into the acceptance result.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRaster, setPixel } from '../shared/image/raster.ts';
import { encodePng } from '../server/png.ts';

const PACK_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../fixtures/pack');
const TILE_COUNT = 60;

rmSync(PACK_ROOT, { recursive: true, force: true });
mkdirSync(PACK_ROOT, { recursive: true });

for (let index = 0; index < TILE_COUNT; index++) {
  const raster = createRaster(48, 48);
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      const r = (index * 37 + x * 5 + y) % 256;
      const g = (index * 67 + x + y * 3) % 256;
      const b = (index * 97 + x * 2 + y * 7) % 256;
      setPixel(raster, x, y, r, g, b, 255);
    }
  }
  const name = `tile-${String(index).padStart(3, '0')}.png`;
  writeFileSync(path.join(PACK_ROOT, name), encodePng(raster));
}

console.log(`Prepared ${TILE_COUNT} deterministic batch-import fixtures.`);
