#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { startStdioServer } from './server.js';

/* eslint-disable no-process-exit */

// Read version from package.json
const currentDir = dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(readFileSync(join(currentDir, '..', 'package.json'), 'utf-8'));

const VERSION = packageJson.version as string;

async function main(): Promise<void> {
   await startStdioServer({
      name: 'mcp-server-tauri',
      version: VERSION,
   });
}

main().catch(() => {
   // Don't log errors to stderr - just exit silently
   // The error will be in the MCP response if needed
   process.exit(1);
});
