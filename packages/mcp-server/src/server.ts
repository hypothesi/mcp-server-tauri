import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
   CallToolRequestSchema,
   ListToolsRequestSchema,
   ListPromptsRequestSchema,
   GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

function fixSchema(obj: Record<string, unknown>): Record<string, unknown> {
   const result: Record<string, unknown> = {};

   for (const [ k, v ] of Object.entries(obj)) {
      if (k === '$schema') {
         continue;
      }
      // Bedrock rejects numeric exclusiveMinimum/Maximum (draft 2019-09 syntax)
      if ((k === 'exclusiveMinimum' || k === 'exclusiveMaximum') && typeof v === 'number') {
         continue;
      }
      if (k === 'type' && Array.isArray(v)) {
         result.anyOf = (v as string[]).map((t) => { return { type: t }; });
      } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
         result[k] = fixSchema(v as Record<string, unknown>);
      } else if (Array.isArray(v)) {
         result[k] = v.map((i) => { return (i !== null && typeof i === 'object' ? fixSchema(i as Record<string, unknown>) : i); });
      } else {
         result[k] = v;
      }
   }
   return result;
}

function toInputSchema(schema: Parameters<typeof zodToJsonSchema>[0]): Record<string, unknown> {
   const result = fixSchema(zodToJsonSchema(schema) as Record<string, unknown>);

   result.$schema = 'https://json-schema.org/draft/2020-12/schema';
   return result;
}

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
         inputSchema: toInputSchema(tool.schema),
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
               inputSchema: toInputSchema(tool.schema),
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
