import { defineConfig } from 'vitest/config';

// E2E tests: each file starts its own PostgreSQL container, so files run one at a time.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
