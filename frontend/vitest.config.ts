import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:5173',
      },
    },
    // Run files serially to avoid jsdom + sandbox fork-bomb timeouts.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
