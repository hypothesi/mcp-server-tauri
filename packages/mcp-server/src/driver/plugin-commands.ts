import { z } from 'zod';
import { ensureSessionAndConnect, getExistingPluginClient } from './plugin-client.js';

export const ExecuteIPCCommandSchema = z.object({
   command: z.string(),
   args: z.unknown().optional(),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

export async function executeIPCCommand(options: {
   command: string;
   args?: unknown;
   appIdentifier?: string | number;
}): Promise<string> {
   try {
      const { command, args = {}, appIdentifier } = options;

      // Ensure we have an active session and are connected
      const client = await ensureSessionAndConnect(appIdentifier);

      // Send IPC command via WebSocket to the mcp-bridge plugin
      const response = await client.sendCommand({
         command: 'invoke_tauri',
         args: { command, args },
      });

      if (!response.success) {
         return JSON.stringify({ success: false, error: response.error || 'Unknown error' });
      }

      return JSON.stringify({ success: true, result: response.data });
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      return JSON.stringify({ success: false, error: message });
   }
}

// Combined schema for managing IPC monitoring
export const ManageIPCMonitoringSchema = z.object({
   action: z.enum([ 'start', 'stop' ]).describe('Action to perform: start or stop IPC monitoring'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

// Keep individual schemas for backward compatibility if needed
export const StartIPCMonitoringSchema = z.object({});
export const StopIPCMonitoringSchema = z.object({});

export async function manageIPCMonitoring(action: 'start' | 'stop', appIdentifier?: string | number): Promise<string> {
   if (action === 'start') {
      return startIPCMonitoring(appIdentifier);
   }
   return stopIPCMonitoring(appIdentifier);
}

export async function startIPCMonitoring(appIdentifier?: string | number): Promise<string> {
   try {
      // Start the Rust-side monitor state
      const result = await executeIPCCommand({ command: 'plugin:mcp-bridge|start_ipc_monitor', appIdentifier });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      // Start the JS-side IPC interception
      const client = await ensureSessionAndConnect(appIdentifier);

      const jsResponse = await client.sendCommand({
         command: 'execute_js',
         args: {
            script: 'window.__MCP_START_IPC_MONITOR__ && window.__MCP_START_IPC_MONITOR__(); true;',
            windowLabel: 'main',
         },
      }, 5000);

      if (!jsResponse.success) {
         // Log but don't fail - Rust-side monitoring is still active
         console.error('Failed to start JS-side IPC interception:', jsResponse.error);
      }

      return JSON.stringify(parsed.result);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to start IPC monitoring: ${message}`);
   }
}

export async function stopIPCMonitoring(appIdentifier?: string | number): Promise<string> {
   try {
      // Stop the JS-side IPC interception first
      const client = await ensureSessionAndConnect(appIdentifier);

      const jsResponse = await client.sendCommand({
         command: 'execute_js',
         args: {
            script: 'window.__MCP_STOP_IPC_MONITOR__ && window.__MCP_STOP_IPC_MONITOR__(); true;',
            windowLabel: 'main',
         },
      }, 5000);

      if (!jsResponse.success) {
         // Log but don't fail - continue to stop Rust-side monitoring
         console.error('Failed to stop JS-side IPC interception:', jsResponse.error);
      }

      // Stop the Rust-side monitor state
      const result = await executeIPCCommand({ command: 'plugin:mcp-bridge|stop_ipc_monitor', appIdentifier });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      return JSON.stringify(parsed.result);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to stop IPC monitoring: ${message}`);
   }
}

export const GetIPCEventsSchema = z.object({
   filter: z.string().optional().describe('Filter events by command name'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

export async function getIPCEvents(filter?: string, appIdentifier?: string | number): Promise<string> {
   try {
      const result = await executeIPCCommand({ command: 'plugin:mcp-bridge|get_ipc_events', appIdentifier });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      let events = parsed.result;

      if (filter && Array.isArray(events)) {
         events = events.filter((e: unknown) => {
            const event = e as { command?: string };

            return event.command && event.command.includes(filter);
         });
      }

      return JSON.stringify(events);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to get IPC events: ${message}`);
   }
}

export const EmitTestEventSchema = z.object({
   eventName: z.string(),
   payload: z.unknown(),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

export async function emitTestEvent(eventName: string, payload: unknown, appIdentifier?: string | number): Promise<string> {
   try {
      const result = await executeIPCCommand({
         command: 'plugin:mcp-bridge|emit_event',
         args: {
            eventName,
            payload,
         },
         appIdentifier,
      });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      return JSON.stringify(parsed.result);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to emit event: ${message}`);
   }
}

export const GetWindowInfoSchema = z.object({
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

export async function getWindowInfo(appIdentifier?: string | number): Promise<string> {
   try {
      const result = await executeIPCCommand({ command: 'plugin:mcp-bridge|get_window_info', appIdentifier });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      return JSON.stringify(parsed.result);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to get window info: ${message}`);
   }
}

export const GetBackendStateSchema = z.object({
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

/**
 * Get backend state from the connected Tauri app.
 *
 * This function can work in two modes:
 * 1. Normal mode: Requires an active session (for MCP tool calls)
 * 2. Setup mode: Uses existing connected client (for session setup)
 *
 * @param useExistingClient If true, uses the existing connected client without
 *        session validation. Used during session setup before currentSession is set.
 */
export async function getBackendState(options: {
   useExistingClient?: boolean;
   appIdentifier?: string | number;
} = {}): Promise<string> {
   try {
      const { useExistingClient = false, appIdentifier } = options;

      if (useExistingClient) {
         // During session setup, use the already-connected client directly
         const client = getExistingPluginClient();

         if (!client || !client.isConnected()) {
            throw new Error('No connected client available');
         }

         const response = await client.sendCommand({
            command: 'invoke_tauri',
            args: { command: 'plugin:mcp-bridge|get_backend_state', args: {} },
         });

         if (!response.success) {
            throw new Error(response.error || 'Unknown error');
         }

         return JSON.stringify(response.data);
      }

      // Normal mode: use executeIPCCommand which validates session
      const result = await executeIPCCommand({ command: 'plugin:mcp-bridge|get_backend_state', appIdentifier });

      const parsed = JSON.parse(result);

      if (!parsed.success) {
         throw new Error(parsed.error || 'Unknown error');
      }

      return JSON.stringify(parsed.result);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to get backend state: ${message}`);
   }
}

// ============================================================================
// Window Management
// ============================================================================

export const ListWindowsSchema = z.object({});

/**
 * Lists all open webview windows in the Tauri application.
 */
export async function listWindows(appIdentifier?: string | number): Promise<string> {
   try {
      const client = await ensureSessionAndConnect(appIdentifier);

      const response = await client.sendCommand({
         command: 'list_windows',
      });

      if (!response.success) {
         throw new Error(response.error || 'Unknown error');
      }

      const windows = response.data as unknown[];

      return JSON.stringify({
         windows,
         defaultWindow: 'main',
         totalCount: windows.length,
      });
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to list windows: ${message}`);
   }
}

export const ResizeWindowSchema = z.object({
   width: z.number().int().positive().describe('Width in pixels'),
   height: z.number().int().positive().describe('Height in pixels'),
   windowId: z.string().optional().describe('Window label to resize (defaults to "main")'),
   logical: z.boolean().optional().default(true)
      .describe('Use logical pixels (true, default) or physical pixels (false)'),
});

/**
 * Resizes a window to the specified dimensions.
 *
 * @param options - Resize options including width, height, and optional windowId
 * @returns JSON string with the result of the resize operation
 */
export async function resizeWindow(options: {
   width: number;
   height: number;
   windowId?: string;
   logical?: boolean;
   appIdentifier?: string | number;
}): Promise<string> {
   try {
      const client = await ensureSessionAndConnect(options.appIdentifier);

      const response = await client.sendCommand({
         command: 'resize_window',
         args: {
            width: options.width,
            height: options.height,
            windowId: options.windowId,
            logical: options.logical ?? true,
         },
      });

      if (!response.success) {
         throw new Error(response.error || 'Unknown error');
      }

      return JSON.stringify(response.data);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to resize window: ${message}`);
   }
}

export const ManageWindowSchema = z.object({
   action: z.enum([ 'list', 'info', 'resize' ])
      .describe('Action: "list" all windows, get "info" for one window, or "resize" a window'),
   windowId: z.string().optional()
      .describe('Window label to target (defaults to "main"). Required for "info", optional for "resize"'),
   width: z.number().int().positive().optional()
      .describe('Width in pixels (required for "resize" action)'),
   height: z.number().int().positive().optional()
      .describe('Height in pixels (required for "resize" action)'),
   logical: z.boolean().optional().default(true)
      .describe('Use logical pixels (true, default) or physical pixels (false). Only for "resize"'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

/**
 * Unified window management function.
 *
 * Actions:
 * - `list`: List all open webview windows with their labels, titles, URLs, and state
 * - `info`: Get detailed info for a window (size, position, title, focus, visibility)
 * - `resize`: Resize a window to specified dimensions
 *
 * @param options - Action and parameters
 * @returns JSON string with the result
 */
export async function manageWindow(options: {
   action: 'list' | 'info' | 'resize';
   windowId?: string;
   width?: number;
   height?: number;
   logical?: boolean;
   appIdentifier?: string | number;
}): Promise<string> {
   const { action, windowId, width, height, logical, appIdentifier } = options;

   switch (action) {
      case 'list': {
         return listWindows(appIdentifier);
      }

      case 'info': {
         try {
            const client = await ensureSessionAndConnect(appIdentifier);

            const response = await client.sendCommand({
               command: 'get_window_info',
               args: { windowId },
            });

            if (!response.success) {
               throw new Error(response.error || 'Unknown error');
            }

            return JSON.stringify(response.data);
         } catch(error: unknown) {
            const message = error instanceof Error ? error.message : String(error);

            throw new Error(`Failed to get window info: ${message}`);
         }
      }

      case 'resize': {
         if (width === undefined || height === undefined) {
            throw new Error('width and height are required for resize action');
         }

         return resizeWindow({ width, height, windowId, logical, appIdentifier });
      }

      default: {
         throw new Error(`Unknown action: ${action}`);
      }
   }
}
