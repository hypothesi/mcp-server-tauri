declare module '@hypothesi/tauri-mcp-server' {
   export interface CliToolDefinition {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
   }

   export function getCliToolDefinitions(): CliToolDefinition[];
}

declare module '@hypothesi/tauri-mcp-server/screenshot-path' {
   export function getScreenshotJailRoot(): string;
   export function ensureScreenshotJail(jailRoot?: string): Promise<string>;
   export function resolveScreenshotOutputPath(filePath: string, jailRoot?: string): string;
   export function isPathInsideScreenshotJail(candidate: string, jailRoot: string): boolean;
}
