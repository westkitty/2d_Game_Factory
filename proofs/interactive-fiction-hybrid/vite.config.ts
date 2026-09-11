import { defineConfig } from 'vite';

/**
 * Static, self-contained build - the same shape as starter/vite.config.ts.
 * `base: './'` keeps output portable; `assetsInlineLimit: 0` keeps assets as
 * real files so the offline check can see exactly what ships.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['@sw2d/contracts', '@sw2d/runtime', '@sw2d/schemas', '@sw2d/content-pipeline', '@sw2d/packs'],
  },
});
