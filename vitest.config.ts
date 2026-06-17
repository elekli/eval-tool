import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // overridden per-file to jsdom for React tests
    setupFiles: ['./test/setup.ts'],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, 'core'),
      '@app': path.resolve(import.meta.dirname, 'app'),
    },
  },
});
