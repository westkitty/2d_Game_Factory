import { defineConfig } from 'vite';

/**
 * Static, self-contained build.
 *
 * `base: './'` keeps the output portable to any static host or subdirectory, and
 * `assetsInlineLimit: 0` keeps assets as real files so the offline check can see
 * exactly what ships. Nothing here reaches a CDN.
 *
 * Two HTML entries: the original foundation-slice proof (index.html,
 * untouched since Phase 5) and the Phase 6 Tiled/theme content-pipeline
 * proof (tiled-proof.html) - a separate page rather than a change to the
 * first, so Phase 6 cannot silently regress the already-verified Phase 1-5
 * browser journey (MASTER_PROJECT.md section 3.10).
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        tiledProof: 'tiled-proof.html',
      },
    },
  },
  optimizeDeps: {
    // Workspace packages are consumed as TypeScript source, not prebundled.
    exclude: ['@sw2d/contracts', '@sw2d/runtime', '@sw2d/schemas', '@sw2d/content-pipeline', '@sw2d/packs'],
  },
  server: { port: 5173, strictPort: true },
});
