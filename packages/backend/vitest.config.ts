import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace package from source so tests run on a fresh
      // checkout (e.g. CI) without building packages/shared/dist first
      '@wiremock-hub/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    pool: 'forks',
    maxWorkers: 1,
    isolate: false
  }
});
