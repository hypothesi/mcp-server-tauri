export interface McpLogger {
   info: (...args: unknown[]) => void;
   warn: (...args: unknown[]) => void;
   error: (...args: unknown[]) => void;
}

/**
 * Creates a logger that writes to stderr only.
 *
 * IMPORTANT: MCP uses stdio for JSON-RPC communication. The server sends
 * JSON responses over stdout, and the client parses them. Any non-JSON
 * output to stdout (like console.log) will corrupt the protocol and cause
 * parsing errors like "invalid character 'M' looking for beginning of value".
 *
 * All logging MUST go to stderr to avoid interfering with MCP communication.
 */
export function createMcpLogger(scope: string): McpLogger {
   return {
      info: (...args: unknown[]): void => {
         // Use console.error (stderr) instead of console.log (stdout)
         // to avoid corrupting MCP's JSON-RPC protocol on stdout
         console.error('[MCP][' + scope + '][INFO]', ...args);
      },
      warn: (...args: unknown[]): void => {
         console.error('[MCP][' + scope + '][WARN]', ...args);
      },
      error: (...args: unknown[]): void => {
         console.error('[MCP][' + scope + '][ERROR]', ...args);
      },
   };
}
