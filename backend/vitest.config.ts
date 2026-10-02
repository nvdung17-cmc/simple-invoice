import { defineConfig } from 'vitest/config';

// Unit tests: pure functions, DTOs and services with mocked dependencies.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
