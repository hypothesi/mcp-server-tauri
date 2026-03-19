import fsPromises from 'fs/promises';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import type { ServerDefinition } from 'mcporter';

export const SERVER_NAME = 'tauri-mcp-server';

const CLI_CONFIG_PATH = path.join(os.homedir(), '.mcporter', 'tauri-mcp-cli.json');

const SERVER_BOOTSTRAP_LINES = [
   'const spec = process.env.TAURI_MCP_SERVER_ENTRY;',
   'if (!spec) { throw new Error("TAURI_MCP_SERVER_ENTRY is not set."); }',
   'const serverModule = await import(spec);',
   'if (typeof serverModule.startStdioServer !== "function") {',
   '  throw new Error("The Tauri MCP server package does not export startStdioServer().");',
   '}',
   'await serverModule.startStdioServer({ name: "mcp-server-tauri", version: process.env.TAURI_MCP_SERVER_VERSION ?? "0.0.0" });',
];

const SERVER_BOOTSTRAP = SERVER_BOOTSTRAP_LINES.join('\n');

function resolveServerEntryUrl(): string {
   const serverEntryPath = fileURLToPath(import.meta.resolve('@hypothesi/tauri-mcp-server'));

   return pathToFileURL(serverEntryPath).href;
}

async function resolveServerVersion(): Promise<string> {
   const serverEntryPath = fileURLToPath(import.meta.resolve('@hypothesi/tauri-mcp-server'));

   const serverPackageJsonPath = path.join(path.dirname(serverEntryPath), '..', 'package.json');

   const packageJsonText = await fsPromises.readFile(serverPackageJsonPath, 'utf-8');

   const packageJson = JSON.parse(packageJsonText) as { version?: string };

   return packageJson.version ?? '0.0.0';
}

export async function createServerDefinition(): Promise<ServerDefinition> {
   return {
      name: SERVER_NAME,
      description: 'Embedded Tauri MCP server CLI transport',
      command: {
         kind: 'stdio',
         command: process.execPath,
         args: [ '--input-type=module', '--eval', SERVER_BOOTSTRAP ],
         cwd: process.cwd(),
      },
      env: {
         TAURI_MCP_SERVER_ENTRY: resolveServerEntryUrl(),
         TAURI_MCP_SERVER_VERSION: await resolveServerVersion(),
      },
      lifecycle: {
         mode: 'keep-alive',
      },
   };
}

async function ensureCliConfigFile(): Promise<void> {
   const definition = await createServerDefinition();

   const command = definition.command.kind === 'stdio' ? definition.command : null;

   const payload = {
      mcpServers: {
         [SERVER_NAME]: {
            description: definition.description,
            command: command?.command ?? process.execPath,
            args: command?.args ?? [],
            env: definition.env,
            lifecycle: 'keep-alive',
         },
      },
   };

   const serialized = `${JSON.stringify(payload, null, 2)}\n`;

   await fsPromises.mkdir(path.dirname(CLI_CONFIG_PATH), { recursive: true });

   if (await fileExists(CLI_CONFIG_PATH)) {
      const current = await fsPromises.readFile(CLI_CONFIG_PATH, 'utf-8');

      if (current === serialized) {
         return;
      }
   }

   await fsPromises.writeFile(CLI_CONFIG_PATH, serialized, 'utf-8');
}

function resolveMcporterCliPath(): string {
   return fileURLToPath(import.meta.resolve('mcporter/cli'));
}

export async function runMcporterCommand(args: string[]): Promise<string> {
   await ensureCliConfigFile();

   const outputPath = path.join(os.tmpdir(), `tauri-mcp-${process.pid}-${Date.now()}.out`);

   const outputFileHandle = await fsPromises.open(outputPath, 'w');

   return new Promise((resolve, reject) => {
      const child = spawn(
         process.execPath,
         [ resolveMcporterCliPath(), '--config', CLI_CONFIG_PATH, ...args ],
         { stdio: [ 'ignore', outputFileHandle.fd, 'pipe' ] }
      );

      let stderr = '';

      if (child.stderr) {
         child.stderr.setEncoding('utf8');
         child.stderr.on('data', (chunk: string) => {
            stderr += chunk;
         });
      }

      child.on('error', (error) => {
         closeOutputFile(outputFileHandle).then(async () => {
            await cleanupOutputFile(outputPath);
            reject(error);
         }, reject);
      });

      child.on('close', (code) => {
         closeOutputFile(outputFileHandle).then(async () => {
            const stdout = await readOutputFile(outputPath);

            await cleanupOutputFile(outputPath);

            if (code === 0) {
               resolve(stdout);
               return;
            }

            reject(new Error((stderr || stdout).trim() || `mcporter exited with code ${code}`));
         }, reject);
      });
   });
}

async function fileExists(filePath: string): Promise<boolean> {
   try {
      await fsPromises.access(filePath);
      return true;
   } catch{
      return false;
   }
}

async function readOutputFile(filePath: string): Promise<string> {
   if (!await fileExists(filePath)) {
      return '';
   }

   return fsPromises.readFile(filePath, 'utf-8');
}

async function cleanupOutputFile(filePath: string): Promise<void> {
   await fsPromises.rm(filePath, { force: true });
}

async function closeOutputFile(fileHandle: fsPromises.FileHandle): Promise<void> {
   try {
      await fileHandle.close();
   } catch(error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== 'EBADF') {
         throw error;
      }
   }
}
