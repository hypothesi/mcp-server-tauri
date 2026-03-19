/* eslint-env node */
/* eslint-disable no-undef */
const config = require('@silvermine/eslint-config');


module.exports = [
   ...config,
   {
      ignores: [
         '**/node_modules/**',
         '**/dist/**',
         '**/dist-js/**',
         '**/target/**',
         '**/build/**',
         '**/target/**',
         '**/.git/**',
         '**/coverage/**',
         '**/*.min.js',
         '**/vendor/**',
         '**/.vitepress/cache/**',
         // Webview injection scripts - these run in browser context, not Node
         '**/src/driver/scripts/**',
      ],
   },
   {
      files: [
         'packages/mcp-server/src/**/*.ts',
         'packages/mcp-server/src/**/*.js',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/mcp-server/tsconfig.json',
         },
      },
   },
   {
      files: [
         'packages/mcp-server/tests/**/*.ts',
         'packages/mcp-server/tests/**/*.js',
         'packages/mcp-server/vitest.config.ts',
         'packages/mcp-server/vitest.config.unit.ts',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/mcp-server/tsconfig.test.json',
         },
      },
   },
   {
      files: [
         'packages/test-app/**/*.ts',
         'packages/test-app/**/*.js',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/test-app/tsconfig.json',
         },
      },
   },
   {
      files: [
         'packages/tauri-plugin-mcp-bridge/guest-js/**/*.ts',
         'packages/tauri-plugin-mcp-bridge/guest-js/**/*.js',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/tauri-plugin-mcp-bridge/tsconfig.json',
         },
      },
   },
   {
      files: [
         'docs/.vitepress/**/*.ts',
         'docs/.vitepress/**/*.vue',
      ],
      languageOptions: {
         parserOptions: {
            project: 'docs/tsconfig.json',
         },
      },
   },
   {
      files: [
         'packages/mcp-server/scripts/**/*.ts',
         'packages/mcp-server/vitest.global-setup.ts',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/mcp-server/tsconfig.test.json',
         },
      },
   },
   {
      files: [
         'packages/cli/src/**/*.ts',
         'packages/cli/src/**/*.js',
         'packages/cli/src/types/**/*.d.ts',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/cli/tsconfig.json',
         },
      },
   },
   {
      files: [
         'packages/cli/tests/**/*.ts',
         'packages/cli/tests/**/*.js',
         'packages/cli/vitest.config.ts',
      ],
      languageOptions: {
         parserOptions: {
            project: 'packages/cli/tsconfig.test.json',
         },
      },
   },
   {
      files: [
         '**/tests/**/*.ts',
         '**/tests/**/*.js',
         '**/*.test.ts',
         '**/*.test.js',
      ],
      rules: {
         'no-console': 'off',
         'no-process-env': 'off',
         '@typescript-eslint/naming-convention': 'off',
      },
   },
   {
      rules: {
         'no-console': 'off',
      },
   },
];
