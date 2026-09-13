import { defineConfig } from 'vitest/config';

export default defineConfig({
   test: {
      globals: true,
      environment: 'node',
      testTimeout: 10000, // 10s for individual tests
      hookTimeout: 5000, // 5s for hooks
      include: [ 'tests/**/*.test.ts' ],
      maxConcurrency: 1, // Run tests sequentially to avoid port conflicts
      fileParallelism: false, // Disable file-level parallelism
      pool: 'forks', // Use separate processes for isolation
      globalSetup: './vitest.global-setup.ts', // Start app once globally
      setupFiles: [ './tests/setup-env.ts' ], // Keep token-file fallback hermetic
      env: {
         // eslint-disable-next-line no-process-env -- honour an operator-supplied token
         MCP_BRIDGE_TOKEN: process.env.MCP_BRIDGE_TOKEN || 'wp4-e2e-test-token',
      },
   },
});
