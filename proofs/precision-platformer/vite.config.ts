import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@sw2d/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@sw2d/schemas': path.resolve(__dirname, '../../packages/schemas/src/index.ts'),
      '@sw2d/packs': path.resolve(__dirname, '../../packages/packs/src/index.ts'),
      '@sw2d/runtime': path.resolve(__dirname, '../../packages/runtime/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});
