import { defineConfig } from 'vitest/config';

// Scope tests to source only. Without this, the compiled copies under dist/ are
// also collected, double-running the suite (and doubling the reported test count).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
