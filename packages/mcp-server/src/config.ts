/**
 * Configuration for the MCP Bridge connection.
 *
 * This module provides configuration options for connecting to Tauri apps,
 * with support for environment variables and sensible defaults.
 */

export interface BridgeConfig {
   host: string;
   port: number;
}

/**
 * Gets the default host for MCP Bridge connections.
 *
 * Resolution priority:
 * 1. MCP_BRIDGE_HOST environment variable
 * 2. TAURI_DEV_HOST environment variable (set by Tauri CLI for mobile dev)
 * 3. 'localhost' (default)
 */
export function getDefaultHost(): string {
   // eslint-disable-next-line no-process-env
   return process.env.MCP_BRIDGE_HOST || process.env.TAURI_DEV_HOST || 'localhost';
}

/**
 * Gets the default port for MCP Bridge connections.
 *
 * Resolution priority:
 * 1. MCP_BRIDGE_PORT environment variable
 * 2. 9223 (default)
 */
export function getDefaultPort(): number {
   // eslint-disable-next-line no-process-env
   const port = process.env.MCP_BRIDGE_PORT;

   return port ? parseInt(port, 10) : 9223;
}

/**
 * Gets the CWD hint used to route tool calls to the right Tauri instance
 * when multiple are connected at once.
 *
 * Resolution priority:
 * 1. MCP_BRIDGE_CWD environment variable (explicit override; useful when a
 *    wrapper script wants to pin routing to a specific worktree regardless
 *    of where the TS server happened to be launched from)
 * 2. process.cwd() (natural inheritance from the calling shell / IDE)
 *
 * Returns null only when both are unavailable, which is extremely rare:
 * process.cwd() is set on every healthy POSIX process.
 */
export function getCwdHint(): string | null {
   // eslint-disable-next-line no-process-env
   const override = process.env.MCP_BRIDGE_CWD;

   if (override && override.length > 0) {
      return override;
   }
   try {
      return process.cwd();
   } catch {
      return null;
   }
}

/**
 * Gets the full bridge configuration from environment variables.
 */
export function getConfig(): BridgeConfig {
   return {
      host: getDefaultHost(),
      port: getDefaultPort(),
   };
}

/**
 * Builds a WebSocket URL from host and port.
 */
export function buildWebSocketURL(host: string, port: number): string {
   return `ws://${host}:${port}`;
}
