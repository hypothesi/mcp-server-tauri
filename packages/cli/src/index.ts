#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import vm from 'vm';
import { Command, Option } from 'commander';

import { getCliToolDefinitions } from '@hypothesi/tauri-mcp-server';
import { createCallResult } from 'mcporter';

import { runMcporterCommand, SERVER_NAME } from './runtime.js';

interface JsonSchemaProperty {
   anyOf?: JsonSchemaProperty[];
   description?: string;
   enum?: unknown[];
   items?: JsonSchemaProperty;
   oneOf?: JsonSchemaProperty[];
   type?: string | string[];
}

interface JsonSchemaDefinition {
   properties?: Record<string, JsonSchemaProperty>;
   required?: string[];
}

interface ToolCommandOptions {
   [key: string]: unknown;
   file?: string;
   json?: boolean;
   raw?: string;
   timeout?: number;
}

interface WrittenImage {
   mimeType: string;
   path: string;
}

type DaemonAction = 'status' | 'stop' | 'start' | 'restart';
type PrimitiveSchemaKind = 'string' | 'number' | 'boolean';
type SchemaKind = PrimitiveSchemaKind | 'array' | 'string-or-number';

const TOOL_DEFINITIONS = getCliToolDefinitions();

const program = new Command();

program
   .name('tauri-mcp')
   .description('Call the Tauri MCP server tools directly from the terminal')
   .showSuggestionAfterError(true);

const daemonCommand = program
   .command('daemon')
   .description('Inspect or manage the keep-alive daemon used for stateful Tauri sessions');

for (const action of [ 'status', 'stop', 'start', 'restart' ] as const) {
   daemonCommand.addCommand(createDaemonSubcommand(action));
}

for (const tool of TOOL_DEFINITIONS) {
   if (tool.name === 'driver_session') {
      program.addCommand(createDriverSessionCommand(tool.inputSchema as JsonSchemaDefinition));
      continue;
   }

   const command = createToolCommand(tool.name, tool.description, tool.inputSchema as JsonSchemaDefinition);

   program.addCommand(command);
}

async function main(): Promise<void> {
   await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
   const message = error instanceof Error ? error.message : String(error);

   console.error(message);
   process.exitCode = 1;
});

function createDaemonSubcommand(action: DaemonAction): Command {
   const command = new Command(action);

   let description = 'Restart the daemon';

   if (action === 'status') {
      description = 'Show daemon status';
   } else if (action === 'stop') {
      description = 'Stop the daemon';
   } else if (action === 'start') {
      description = 'Start or prewarm the daemon';
   }

   command
      .description(description)
      .action(async () => {
         const stdout = await runMcporterCommand([ 'daemon', action ]);

         process.stdout.write(stdout);
      });

   return command;
}

function createToolCommand(toolName: string, description: string, schema: JsonSchemaDefinition): Command {
   const commandName = toolName.replaceAll('_', '-');

   const command = new Command(commandName);

   command
      .description(description)
      .option('--raw <json>', 'Provide raw JSON arguments to the tool')
      .option('--file <path>', 'Write image output to a specific file path')
      .option('--json', 'Print structured JSON output')
      .option('--call-timeout <ms>', 'Call timeout in milliseconds', parseInteger, 30000)
      .action(async (options: ToolCommandOptions) => {
         await runTool(toolName, schema, options);
      });

   if (commandName !== toolName) {
      command.alias(toolName);
   }

   addSchemaOptions(command, schema);
   return command;
}

function addSchemaOptions(command: Command, schema: JsonSchemaDefinition): void {
   addSchemaOptionsWithExclusions(command, schema, new Set<string>());
}

function addSchemaOptionsWithExclusions(command: Command, schema: JsonSchemaDefinition, excludedProperties: Set<string>): void {
   const properties = schema.properties ?? {};

   const requiredSet = new Set(schema.required ?? []);

   for (const [ propertyName, propertySchema ] of Object.entries(properties)) {
      if (excludedProperties.has(propertyName)) {
         continue;
      }

      const optionName = propertyName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replaceAll('_', '-').toLowerCase();

      const summary = propertySchema.description ?? `Value for ${propertyName}`;

      const typeInfo = getSchemaTypeInfo(propertySchema);

      const flagLabel = typeInfo.kind === 'boolean' ? `--${optionName} <boolean>` : `--${optionName} <value>`;

      const option = new Option(flagLabel, summary);

      if (typeInfo.kind === 'number') {
         option.argParser(parseNumber);
      } else if (typeInfo.kind === 'boolean') {
         option.argParser(parseBoolean);
      } else if (typeInfo.kind === 'array') {
         option.argParser(createArrayParser(typeInfo.itemKind));
      } else if (typeInfo.kind === 'string-or-number') {
         option.argParser(parseStringOrNumber);
      }

      if (typeInfo.choices.length > 0) {
         option.choices(typeInfo.choices);
      }

      if (requiredSet.has(propertyName)) {
         command.addOption(option.makeOptionMandatory(true));
      } else {
         command.addOption(option);
      }
   }
}

function createDriverSessionCommand(schema: JsonSchemaDefinition): Command {
   const driverSession = new Command('driver-session')
      .description('Manage a long-lived automation session to a running Tauri app');

   for (const action of [ 'start', 'status', 'stop' ] as const) {
      const command = new Command(action);

      command
         .option('--raw <json>', 'Provide raw JSON arguments to the tool')
         .option('--json', 'Print structured JSON output')
         .option('--call-timeout <ms>', 'Call timeout in milliseconds', parseInteger, 30000)
         .action(async (options: ToolCommandOptions) => {
            await runTool('driver_session', schema, {
               ...options,
               action,
            });
         });

      addSchemaOptionsWithExclusions(command, schema, new Set([ 'action' ]));
      driverSession.addCommand(command);
   }

   driverSession.alias('driver_session');
   return driverSession;
}

async function runTool(toolName: string, schema: JsonSchemaDefinition, options: ToolCommandOptions): Promise<void> {
   const timeoutMs = options.callTimeout as number | undefined;

   const args = options.raw ? parseRawArguments(options.raw) : buildArgumentsFromOptions(schema, options);

   let rawResult = await invokeMcporterTool(toolName, args, timeoutMs),
       callResult = createCallResult(rawResult);

   if (toolName !== 'driver_session' && isNoActiveSessionError(callResult.text())) {
      await invokeMcporterTool('driver_session', { action: 'status' }, timeoutMs);
      rawResult = await invokeMcporterTool(toolName, args, timeoutMs);
      callResult = createCallResult(rawResult);
   }

   const imageFiles = await writeImageFiles(toolName, callResult.content(), options.file);

   if (options.json) {
      console.log(JSON.stringify(buildJsonPayload(callResult, imageFiles), null, 2));
      return;
   }

   printTextResult(callResult, imageFiles);
}

async function invokeMcporterTool(
   toolName: string,
   args: Record<string, unknown>,
   timeoutMs?: number
): Promise<unknown> {
   const stdout = await runMcporterCommand([
      'call',
      `${SERVER_NAME}.${toolName}`,
      '--args',
      JSON.stringify(args),
      '--output',
      'raw',
      '--timeout',
      String(timeoutMs ?? 30000),
   ]);

   return parseMcporterRawOutput(stdout);
}

function isNoActiveSessionError(text: string | null): boolean {
   return Boolean(text && text.includes('No active session. Call driver_session with action "start" first'));
}

function parseMcporterRawOutput(stdout: string): unknown {
   const trimmed = stdout.trim();

   const candidates = [ trimmed ];

   for (const [ startChar, endChar ] of [ [ '{', '}' ], [ '[', ']' ] ] as const) {
      const startIndex = trimmed.indexOf(startChar);

      const endIndex = trimmed.lastIndexOf(endChar);

      if (startIndex !== -1 && endIndex > startIndex) {
         candidates.push(trimmed.slice(startIndex, endIndex + 1));
      }
   }

   for (const candidate of candidates) {
      if (!candidate) {
         continue;
      }

      try {
         return JSON.parse(candidate);
      } catch{
         try {
            return vm.runInNewContext(`(${candidate})`);
         } catch{
            // Try the next candidate.
         }
      }
   }

   return trimmed;
}

function buildArgumentsFromOptions(schema: JsonSchemaDefinition, options: ToolCommandOptions): Record<string, unknown> {
   const properties = schema.properties ?? {};

   const args: Record<string, unknown> = {};

   for (const propertyName of Object.keys(properties)) {
      const optionName = toCommanderOptionName(propertyName);

      const value = options[optionName];

      if (value !== undefined) {
         args[propertyName] = value;
      }
   }

   return args;
}

function toCommanderOptionName(propertyName: string): string {
   return propertyName
      .replace(/[-_]+([a-zA-Z0-9])/g, (_, char: string) => {
         return char.toUpperCase();
      })
      .replace(/^[A-Z]/, (char) => {
         return char.toLowerCase();
      });
}

function parseRawArguments(raw: string): Record<string, unknown> {
   const parsed = JSON.parse(raw) as unknown;

   if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('--raw must parse to a JSON object.');
   }

   return parsed as Record<string, unknown>;
}

function getSchemaTypeInfo(schema: JsonSchemaProperty): {
   choices: string[];
   itemKind?: PrimitiveSchemaKind;
   kind: SchemaKind;
} {
   const variants = [ ...(schema.anyOf ?? []), ...(schema.oneOf ?? []) ];

   if (variants.length > 0) {
      const primitiveTypes = new Set(
         variants.flatMap((variant) => {
            return normalizeTypeList(variant.type);
         })
      );

      if (primitiveTypes.has('number') && primitiveTypes.has('string')) {
         return {
            kind: 'string-or-number',
            choices: extractChoices(schema, variants),
         };
      }
   }

   const [ firstType = 'string' ] = normalizeTypeList(schema.type);

   if (firstType === 'number' || firstType === 'integer') {
      return {
         kind: 'number',
         choices: extractChoices(schema, variants),
      };
   }

   if (firstType === 'boolean') {
      return {
         kind: 'boolean',
         choices: extractChoices(schema, variants),
      };
   }

   if (firstType === 'array') {
      return {
         kind: 'array',
         choices: [],
         itemKind: getArrayItemKind(schema.items),
      };
   }

   return {
      kind: 'string',
      choices: extractChoices(schema, variants),
   };
}

function getArrayItemKind(schema: JsonSchemaProperty | undefined): PrimitiveSchemaKind {
   const itemTypes = normalizeTypeList(schema?.type);

   const [ firstItemType = 'string' ] = itemTypes;

   if (firstItemType === 'number' || firstItemType === 'integer') {
      return 'number';
   }

   if (firstItemType === 'boolean') {
      return 'boolean';
   }

   return 'string';
}

function normalizeTypeList(typeValue: string | string[] | undefined): string[] {
   if (!typeValue) {
      return [];
   }

   return Array.isArray(typeValue) ? typeValue : [ typeValue ];
}

function extractChoices(schema: JsonSchemaProperty, variants: JsonSchemaProperty[]): string[] {
   const values = new Set<string>();

   for (const candidate of [ schema, ...variants ]) {
      for (const value of candidate.enum ?? []) {
         if (typeof value === 'string') {
            values.add(value);
         }
      }
   }

   return Array.from(values);
}

function parseInteger(value: string): number {
   const parsed = parseInt(value, 10);

   if (Number.isNaN(parsed)) {
      throw new Error(`Expected an integer but received "${value}".`);
   }

   return parsed;
}

function parseNumber(value: string): number {
   const parsed = Number(value);

   if (Number.isNaN(parsed)) {
      throw new Error(`Expected a number but received "${value}".`);
   }

   return parsed;
}

function parseBoolean(value: string): boolean {
   if (value === 'true') {
      return true;
   }

   if (value === 'false') {
      return false;
   }

   throw new Error(`Expected "true" or "false" but received "${value}".`);
}

function parseStringOrNumber(value: string): string | number {
   const numericValue = Number(value);

   return Number.isNaN(numericValue) ? value : numericValue;
}

function createArrayParser(itemKind: PrimitiveSchemaKind | undefined): (value: string) => unknown[] {
   return (value: string) => {
      const parts = value.split(',').map((part) => {
         return part.trim();
      });

      if (itemKind === 'number') {
         return parts.map(parseNumber);
      }

      if (itemKind === 'boolean') {
         return parts.map(parseBoolean);
      }

      return parts;
   };
}

async function writeImageFiles(
   toolName: string,
   content: unknown[] | null,
   requestedPath?: string
): Promise<WrittenImage[]> {
   const images = (content ?? []).filter(isImageContent);

   if (images.length === 0) {
      return [];
   }

   const outputPaths = buildOutputPaths(toolName, images, requestedPath);

   const writes = images.map(async (image, index) => {
      const outputPath = outputPaths[index];

      if (!outputPath) {
         throw new Error('Image output path resolution failed.');
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, image.data, 'base64');

      return {
         path: outputPath,
         mimeType: image.mimeType,
      };
   });

   return Promise.all(writes);
}

function buildOutputPaths(toolName: string, images: Array<{ mimeType: string }>, requestedPath?: string): string[] {
   if (requestedPath) {
      if (images.length === 1) {
         return [ path.resolve(requestedPath) ];
      }

      const resolved = path.resolve(requestedPath);

      const extension = path.extname(resolved);

      const baseName = extension ? resolved.slice(0, -extension.length) : resolved;

      return images.map((image, index) => {
         return `${baseName}-${index + 1}${extension || defaultExtension(image.mimeType)}`;
      });
   }

   const stamp = new Date().toISOString().replace(/[:.]/g, '-');

   return images.map((image, index) => {
      const suffix = images.length === 1 ? '' : `-${index + 1}`;

      return path.resolve(process.cwd(), `${toolName}-${stamp}${suffix}${defaultExtension(image.mimeType)}`);
   });
}

function defaultExtension(mimeType: string): string {
   switch (mimeType) {
      case 'image/jpeg': {
         return '.jpg';
      }
      case 'image/webp': {
         return '.webp';
      }
      default: {
         return '.png';
      }
   }
}

function isImageContent(value: unknown): value is { type: 'image'; data: string; mimeType: string } {
   if (!value || typeof value !== 'object') {
      return false;
   }

   const candidate = value as Record<string, unknown>;

   return candidate.type === 'image' && typeof candidate.data === 'string' && typeof candidate.mimeType === 'string';
}

function buildJsonPayload(callResult: ReturnType<typeof createCallResult>, imageFiles: WrittenImage[]): Record<string, unknown> {
   let imageIndex = 0;

   const content = (callResult.content() ?? []).map((entry) => {
      if (!isImageContent(entry)) {
         return entry;
      }

      const imageFile = imageFiles[imageIndex];

      imageIndex += 1;

      return {
         type: entry.type,
         mimeType: entry.mimeType,
         path: imageFile?.path ?? null,
      };
   });

   return {
      text: callResult.text(),
      markdown: callResult.markdown(),
      structuredContent: callResult.structuredContent(),
      content,
      files: imageFiles,
   };
}

function printTextResult(callResult: ReturnType<typeof createCallResult>, imageFiles: WrittenImage[]): void {
   const text = callResult.text();

   if (text) {
      console.log(text);
   } else if (callResult.structuredContent()) {
      console.log(JSON.stringify(callResult.structuredContent(), null, 2));
   }

   for (const image of imageFiles) {
      console.log(`Wrote image to ${image.path}`);
   }

   if (!text && imageFiles.length === 0) {
      console.log(JSON.stringify(callResult.raw, null, 2));
   }
}
