import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
   CallToolRequestSchema,
   ListToolsRequestSchema,
   ListPromptsRequestSchema,
   GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { TOOLS, TOOL_MAP, ToolResult, ToolContent } from './tools-registry.js';
import { PROMPTS, PROMPT_MAP } from './prompts-registry.js';
import { createMcpLogger } from './logger.js';

/* eslint-disable no-process-exit */

const serverLogger = createMcpLogger('SERVER');

export interface McpServerInfo {
   name: string;
   version: string;
}

export interface CliToolDefinition {
   name: string;
   description: string;
   inputSchema: Record<string, unknown>;
}

export function getCliToolDefinitions(): CliToolDefinition[] {
   return TOOLS.map((tool) => {
      return {
         name: tool.name,
         description: tool.description,
         inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
      };
   });
}

function toolResultToContent(result: ToolResult): Array<{ type: string; text?: string; data?: string; mimeType?: string }> {
   if (typeof result === 'string') {
      return [ { type: 'text', text: result } ];
   }

   if (Array.isArray(result)) {
      return result.map(contentToMcp);
   }

   return [ contentToMcp(result) ];
}

function contentToMcp(content: ToolContent): { type: string; text?: string; data?: string; mimeType?: string } {
   if (content.type === 'text') {
      return { type: 'text', text: content.text };
   }

   return { type: 'image', data: content.data, mimeType: content.mimeType };
}

export function createMcpServer(info: McpServerInfo): Server {
   const server = new Server(
      {
         name: info.name,
         version: info.version,
      },
      {
         capabilities: {
            tools: {},
            prompts: {},
         },
      }
   );

   server.onerror = (error) => {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('broken pipe') || message.includes('EPIPE')) {
         process.exit(0);
      }

      serverLogger.error(message);
   };

   server.onclose = () => {
      process.exit(0);
   };

   server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
         tools: TOOLS.map((tool) => {
            return {
               name: tool.name,
               description: tool.description,
               inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
               annotations: tool.annotations,
            };
         }),
      };
   });

   server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
         const tool = TOOL_MAP.get(request.params.name);

         if (!tool) {
            throw new Error(`Unknown tool: ${request.params.name}`);
         }

         const output = await tool.handler(request.params.arguments);

         return { content: toolResultToContent(output) };
      } catch(error: unknown) {
         const message = error instanceof Error ? error.message : String(error);

         return {
            content: [ { type: 'text', text: `Error: ${message}` } ],
            isError: true,
         };
      }
   });

   server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
         prompts: PROMPTS.map((prompt) => {
            return {
               name: prompt.name,
               description: prompt.description,
               arguments: prompt.arguments,
            };
         }),
      };
   });

   server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const prompt = PROMPT_MAP.get(request.params.name);

      if (!prompt) {
         throw new Error(`Unknown prompt: ${request.params.name}`);
      }

      const args = (request.params.arguments || {}) as Record<string, string>;

      return {
         description: prompt.description,
         messages: prompt.handler(args),
      };
   });

   return server;
}

export async function startStdioServer(info: McpServerInfo): Promise<void> {
   const transport = new StdioServerTransport(),
         server = createMcpServer(info);

   await server.connect(transport);
}
