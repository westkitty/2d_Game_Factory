import { defineConfig } from 'vite';

/**
 * The workbench UI build.
 *
 * `root` is this directory, so `index.html` and `src/` are the app; `server/`
 * is Node-side and never enters a browser bundle. `base: './'` keeps the
 * production build portable, and `assetsInlineLimit: 0` keeps every asset a
 * real file so the repository's offline guard can see exactly what ships -
 * the same shape `starter/vite.config.ts` and every generated game use.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['@sw2d/contracts', '@sw2d/schemas', '@sw2d/content-pipeline', '@sw2d/presets', '@sw2d/cli'],
  },
});
