// Tests and the coverage gate from AGENTS.md: 100% of the service layer, 80% overall.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      thresholds: {
        lines: 80,
        'src/services/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
