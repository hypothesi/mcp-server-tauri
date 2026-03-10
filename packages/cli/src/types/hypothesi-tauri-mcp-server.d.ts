declare module '@hypothesi/tauri-mcp-server' {
   export interface CliToolDefinition {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
   }

   export function getCliToolDefinitions(): CliToolDefinition[];
}
