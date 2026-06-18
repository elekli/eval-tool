import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
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
