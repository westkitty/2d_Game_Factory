import { defineConfig } from 'vite';

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
