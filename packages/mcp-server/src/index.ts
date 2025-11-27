#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
   CallToolRequestSchema,
   ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import the single source of truth for all tools
import { TOOLS, TOOL_MAP } from './tools-registry.js';

/* eslint-disable no-process-exit */

// Read version from package.json
const currentDir = dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(readFileSync(join(currentDir, '..', 'package.json'), 'utf-8'));

const VERSION = packageJson.version as string;

// Initialize server
const server = new Server(
   {
      name: 'mcp-server-tauri',
      version: VERSION,
   },
   {
      capabilities: {
         tools: {},
      },
   }
);

// Handle connection errors gracefully - don't crash on broken pipe
server.onerror = (error) => {
   // Ignore broken pipe errors - they happen when the client disconnects
   const message = error instanceof Error ? error.message : String(error);

   if (message.includes('broken pipe') || message.includes('EPIPE')) {
      // Client disconnected, exit gracefully
      process.exit(0);
   }
   // For other errors, log to stderr (will be captured by MCP client)

   console.error('[MCP Server Error]', message);
};

// Handle connection close - exit gracefully
server.onclose = () => {
   process.exit(0);
};

// Tool list handler - generated from registry
server.setRequestHandler(ListToolsRequestSchema, async () => {
   return {
      tools: TOOLS.map((tool) => {
         return {
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
         };
      }),
   };
});

// Tool call handler - generated from registry
server.setRequestHandler(CallToolRequestSchema, async (request) => {
   try {
      const tool = TOOL_MAP.get(request.params.name);

      if (!tool) {
         throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const output = await tool.handler(request.params.arguments);

      return { content: [ { type: 'text', text: output } ] };
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      return {
         content: [ { type: 'text', text: `Error: ${message}` } ],
         isError: true,
      };
   }
});

// Start server
async function main(): Promise<void> {
   const transport = new StdioServerTransport();

   await server.connect(transport);
   // Don't log to stderr - it interferes with MCP protocol
}

main().catch(() => {
   // Don't log errors to stderr - just exit silently
   // The error will be in the MCP response if needed
   process.exit(1);
});
