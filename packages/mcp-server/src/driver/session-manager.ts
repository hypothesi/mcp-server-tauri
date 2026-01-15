import { z } from 'zod';

import { getDefaultHost, getDefaultPort } from '../config.js';
import { AppDiscovery } from './app-discovery.js';
import { PluginClient } from './plugin-client.js';
import { resetInitialization } from './webview-executor.js';
import { createMcpLogger } from '../logger.js';

const sessionLogger = createMcpLogger('SESSION');

/**
 * Session Manager - Native IPC-based session management
 *
 * This module provides lightweight native session management using Tauri IPC.
 * The "session" concept is maintained for API compatibility.
 *
 * Connection Strategy:
 * 1. Try localhost first (most reliable for simulators/emulators/desktop)
 * 2. If localhost fails and a remote host is configured, try that host
 * 3. Return error if all connection attempts fail
 */

// ============================================================================
// Schemas
// ============================================================================

export const ManageDriverSessionSchema = z.object({
   action: z.enum([ 'start', 'stop', 'status' ]).describe('Action to perform: start or stop the session, or check status'),
   host: z.string().optional().describe(
      'Host address to connect to (e.g., 192.168.1.100). Falls back to MCP_BRIDGE_HOST or TAURI_DEV_HOST env vars'
   ),
   port: z.number().optional().describe('Port to connect to (default: 9223)'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App identifier (port number or bundle ID) to stop. Only used with action "stop". If omitted, stops all sessions.'
   ),
});

// ============================================================================
// Types
// ============================================================================

export interface SessionInfo {
   name: string;
   identifier: string | null;
   host: string;
   port: number;
   client: PluginClient;
   connected: boolean;
}

// ============================================================================
// Module State
// ============================================================================

// AppDiscovery instance - recreated when host changes
let appDiscovery: AppDiscovery | null = null;

// Track multiple concurrent sessions keyed by port
const activeSessions = new Map<number, SessionInfo>();

// Track the default app (most recently connected)
let defaultPort: number | null = null;

/**
 * Check if any session is currently active.
 * @returns true if at least one session exists
 */
export function hasActiveSession(): boolean {
   return activeSessions.size > 0;
}

/**
 * Get a specific session by port.
 */
export function getSession(port: number): SessionInfo | null {
   return activeSessions.get(port) ?? null;
}

/**
 * Get the default session (most recently connected).
 */
export function getDefaultSession(): SessionInfo | null {
   if (defaultPort !== null && activeSessions.has(defaultPort)) {
      const session = activeSessions.get(defaultPort);

      return session ?? null;
   }
   return null;
}

/**
 * Get all active sessions.
 */
export function getAllSessions(): SessionInfo[] {
   return Array.from(activeSessions.values());
}

function getAppDiscovery(host: string): AppDiscovery {
   if (!appDiscovery || appDiscovery.host !== host) {
      appDiscovery = new AppDiscovery(host);
   }

   return appDiscovery;
}

/**
 * Resolve target app from port or identifier.
 * Returns the appropriate session based on the routing logic.
 */
export function resolveTargetApp(portOrIdentifier?: string | number): SessionInfo {
   if (activeSessions.size === 0) {
      throw new Error(
         'No active session. Call driver_session with action "start" first to connect to a Tauri app.'
      );
   }

   // Single app - return it
   if (activeSessions.size === 1) {
      const session = activeSessions.values().next().value;

      if (!session) {
         throw new Error('Session state inconsistent');
      }
      return session;
   }

   // Multiple apps - need identifier or use default
   if (portOrIdentifier !== undefined) {
      // Try port lookup first
      const port = typeof portOrIdentifier === 'number'
         ? portOrIdentifier
         : parseInt(String(portOrIdentifier), 10);

      if (!isNaN(port) && activeSessions.has(port)) {
         const session = activeSessions.get(port);

         if (session) {
            return session;
         }
      }

      // Try identifier match
      for (const session of activeSessions.values()) {
         if (session.identifier === String(portOrIdentifier)) {
            return session;
         }
      }

      throw new Error(formatAppNotFoundError(portOrIdentifier));
   }

   // Use default app
   if (defaultPort !== null && activeSessions.has(defaultPort)) {
      const session = activeSessions.get(defaultPort);

      if (session) {
         return session;
      }
   }

   throw new Error('No default app set. This should not happen.');
}

/**
 * Format error message when app not found.
 */
function formatAppNotFoundError(identifier: string | number): string {
   const appList = Array.from(activeSessions.values())
      .map((session) => {
         const isDefault = session.port === defaultPort;

         const defaultMarker = isDefault ? ' [DEFAULT]' : '';

         return `  - ${session.port}: ${session.identifier || 'unknown'} (${session.host}:${session.port})${defaultMarker}`;
      })
      .join('\n');

   return (
      `App "${identifier}" not found.\n\n` +
      `Connected apps:\n${appList}\n\n` +
      'Use driver_session with action "status" to list all connected apps.'
   );
}

/**
 * Promote the next default app when the current default is removed.
 * Selects the oldest remaining session (first in insertion order).
 */
function promoteNextDefault(): void {
   if (activeSessions.size > 0) {
      // Get first session (oldest)
      const firstSession = activeSessions.values().next().value;

      if (firstSession) {
         defaultPort = firstSession.port;
         sessionLogger.info(`Promoted port ${defaultPort} as new default app`);
      } else {
         defaultPort = null;
      }
   } else {
      defaultPort = null;
   }
}

async function handleStatusAction(): Promise<string> {
   if (activeSessions.size === 0) {
      return JSON.stringify({
         connected: false,
         app: null,
         identifier: null,
         host: null,
         port: null,
      });
   }

   if (activeSessions.size === 1) {
      const session = activeSessions.values().next().value;

      if (!session) {
         return JSON.stringify({
            connected: false,
            app: null,
            identifier: null,
            host: null,
            port: null,
         });
      }

      return JSON.stringify({
         connected: true,
         app: session.name,
         identifier: session.identifier,
         host: session.host,
         port: session.port,
      });
   }

   const apps = Array.from(activeSessions.values()).map((session) => {
      return {
         name: session.name,
         identifier: session.identifier,
         host: session.host,
         port: session.port,
         isDefault: session.port === defaultPort,
      };
   });

   return JSON.stringify({
      connected: true,
      apps,
      totalCount: apps.length,
      defaultPort,
   });
}

async function handleStartAction(host?: string, port?: number): Promise<string> {
   const configuredHost = host ?? getDefaultHost();

   const configuredPort = port ?? getDefaultPort();

   if (activeSessions.has(configuredPort)) {
      return `Already connected to app on port ${configuredPort}`;
   }

   let connectedSession: { name: string; host: string; port: number } | null = null;

   if (configuredHost !== 'localhost' && configuredHost !== '127.0.0.1') {
      try {
         connectedSession = await tryConnect('localhost', configuredPort);
      } catch{
         // ignore
      }
   }

   if (!connectedSession) {
      try {
         connectedSession = await tryConnect(configuredHost, configuredPort);
      } catch{
         // ignore
      }
   }

   if (!connectedSession) {
      const localhostDiscovery = getAppDiscovery('localhost');

      const firstApp = await localhostDiscovery.getFirstAvailableApp();

      if (firstApp) {
         try {
            connectedSession = await tryConnect('localhost', firstApp.port);
         } catch{
            // ignore
         }
      }
   }

   if (!connectedSession) {
      return `Session start failed - no Tauri app found at localhost or ${configuredHost}:${configuredPort}`;
   }

   const client = new PluginClient(connectedSession.host, connectedSession.port);

   await client.connect();

   const identifier = await fetchAppIdentifier(client);

   const sessionInfo: SessionInfo = {
      name: connectedSession.name,
      identifier,
      host: connectedSession.host,
      port: connectedSession.port,
      client,
      connected: true,
   };

   activeSessions.set(connectedSession.port, sessionInfo);
   defaultPort = connectedSession.port;

   sessionLogger.info(
      `Session started: ${sessionInfo.name} (${sessionInfo.host}:${sessionInfo.port}) [DEFAULT]`
   );

   return `Session started with app: ${sessionInfo.name} (${sessionInfo.host}:${sessionInfo.port}) [DEFAULT]`;
}

async function handleStopAction(appIdentifier?: string | number): Promise<string> {
   if (appIdentifier !== undefined) {
      const session = resolveTargetApp(appIdentifier);

      session.client.disconnect();
      activeSessions.delete(session.port);

      if (session.port === defaultPort) {
         promoteNextDefault();
      }

      sessionLogger.info(`Session stopped: ${session.name} (${session.host}:${session.port})`);
      return `Session stopped: ${session.name} (${session.host}:${session.port})`;
   }

   for (const session of activeSessions.values()) {
      session.client.disconnect();
   }

   activeSessions.clear();
   defaultPort = null;

   if (appDiscovery) {
      await appDiscovery.disconnectAll();
   }

   resetInitialization();

   sessionLogger.info('All sessions stopped');
   return 'All sessions stopped';
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Try to connect to a specific host and port.
 * Returns session info on success, throws on failure.
 */
async function tryConnect(host: string, port: number): Promise<{ name: string; host: string; port: number }> {
   const discovery = getAppDiscovery(host);

   const session = await discovery.connectToPort(port, undefined, host);

   return {
      name: session.name,
      host: session.host,
      port: session.port,
   };
}

/**
 * Fetch the app identifier from the backend state.
 * Must be called after a PluginClient is connected.
 *
 * @param client - The PluginClient to query
 * @returns The app identifier (bundle ID) or null if not available. Returns null when:
 *          - The plugin doesn't support the identifier field (older versions)
 *          - The backend state request fails
 *          - The identifier field is missing from the response
 */
async function fetchAppIdentifier(client: PluginClient): Promise<string | null> {
   try {
      const response = await client.sendCommand({
         command: 'invoke_tauri',
         args: { command: 'plugin:mcp-bridge|get_backend_state', args: {} },
      });

      if (!response.success || !response.data) {
         return null;
      }

      const state = response.data as { app?: { identifier?: string } };

      // Return null if identifier is not present (backward compat with older plugins)
      return state.app?.identifier ?? null;
   } catch{
      // Return null on any error (e.g., older plugin version that doesn't support this)
      return null;
   }
}

/**
 * Manage session lifecycle (start, stop, or status).
 *
 * Connection strategy for 'start':
 * 1. Try localhost:{port} first (most reliable for simulators/emulators/desktop)
 * 2. If localhost fails AND a different host is configured, try {host}:{port}
 * 3. If both fail, try auto-discovery on localhost
 * 4. Return error if all attempts fail
 *
 * @param action - 'start', 'stop', or 'status'
 * @param host - Optional host address (defaults to env var or localhost)
 * @param port - Optional port number (defaults to 9223)
 * @param appIdentifier - Optional app identifier for 'stop' action (port or bundle ID)
 * @returns For 'start'/'stop': A message string describing the result.
 *          For 'status': A JSON string with connection details
 */
export async function manageDriverSession(
   action: 'start' | 'stop' | 'status',
   host?: string,
   port?: number,
   appIdentifier?: string | number
): Promise<string> {
   switch (action) {
      case 'status': {
         return handleStatusAction();
      }

      case 'start': {
         return handleStartAction(host, port);
      }

      case 'stop': {
         return handleStopAction(appIdentifier);
      }

      default: {
         return handleStopAction(appIdentifier);
      }
   }
}
