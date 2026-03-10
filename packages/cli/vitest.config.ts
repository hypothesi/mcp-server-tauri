import { defineConfig } from 'vitest/config';

export default defineConfig({
   test: {
      globals: true,
      environment: 'node',
      testTimeout: 30000,
      hookTimeout: 10000,
      include: [ 'tests/**/*.test.ts' ],
      maxConcurrency: 1,
      fileParallelism: false,
      pool: 'forks',
      globalSetup: '../mcp-server/vitest.global-setup.ts',
   },
});
