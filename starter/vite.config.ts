import { defineConfig } from 'vite';

/**
 * Static, self-contained build.
 *
 * `base: './'` keeps the output portable to any static host or subdirectory, and
 * `assetsInlineLimit: 0` keeps assets as real files so the offline check can see
 * exactly what ships. Nothing here reaches a CDN.
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
    // Workspace packages are consumed as TypeScript source, not prebundled.
    exclude: ['@sw2d/contracts', '@sw2d/runtime', '@sw2d/schemas'],
  },
  server: { port: 5173, strictPort: true },
});
