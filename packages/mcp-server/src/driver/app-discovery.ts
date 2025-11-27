/**
 * App discovery and session management for multiple Tauri instances.
 *
 * This module handles discovering and connecting to multiple Tauri apps
 * running with MCP Bridge on the same machine or remote devices using port scanning.
 */

import { getDefaultHost, getDefaultPort } from '../config.js';
import { PluginClient } from './plugin-client.js';

export interface AppInstance {
   host: string;
   port: number;
   available: boolean;
}

export interface SessionInfo {
   appId: string;
   name: string;
   host: string;
   port: number;
   client?: PluginClient;
   connected: boolean;
}

/**
 * Manages discovery and connection to multiple Tauri app instances
 */
export class AppDiscovery {
   private _activeSessions: Map<string, SessionInfo> = new Map();
   private _host: string;
   private _basePort: number;
   private _maxPorts = 100;

   public constructor(host?: string, basePort?: number) {
      this._host = host ?? getDefaultHost();
      this._basePort = basePort ?? getDefaultPort();
   }

   /**
    * Gets the configured host.
    */
   public get host(): string {
      return this._host;
   }

   /**
    * Sets the host for discovery.
    */
   public setHost(host: string): void {
      this._host = host;
   }

   /**
    * Discovers available Tauri app instances by scanning ports
    */
   public async discoverApps(): Promise<AppInstance[]> {
      const apps: AppInstance[] = [];

      // Scan port range for available apps
      for (let offset = 0; offset < this._maxPorts; offset++) {
         const port = this._basePort + offset;

         if (await this._isPortInUse(port)) {
            apps.push({ host: this._host, port, available: true });
         }
      }

      return apps;
   }


   /**
    * Connects to a specific app on a host and port
    */
   public async connectToPort(port: number, appName?: string, host?: string): Promise<SessionInfo> {
      const targetHost = host ?? this._host;

      const sessionId = `${targetHost}_${port}`;

      // Check if already connected
      const existing = this._activeSessions.get(sessionId);

      if (existing?.connected) {
         return existing;
      }

      const client = new PluginClient(targetHost, port);

      try {
         await client.connect();

         const session: SessionInfo = {
            appId: sessionId,
            name: appName || `Tauri App (${targetHost}:${port})`,
            host: targetHost,
            port,
            client,
            connected: true,
         };

         this._activeSessions.set(sessionId, session);
         return session;
      } catch(error) {
         throw new Error(`Failed to connect to ${targetHost}:${port}: ${error}`);
      }
   }

   /**
    * Gets the first available app
    */
   public async getFirstAvailableApp(): Promise<AppInstance | null> {
      const apps = await this.discoverApps();

      return apps.length > 0 ? apps[0] : null;
   }

   /**
    * Disconnects from a specific session
    */
   public async disconnectSession(sessionId: string): Promise<void> {
      const session = this._activeSessions.get(sessionId);

      if (session?.client) {
         await session.client.disconnect();
         this._activeSessions.delete(sessionId);
      }
   }

   /**
    * Disconnects from all apps
    */
   public async disconnectAll(): Promise<void> {
      for (const [ , session ] of this._activeSessions) {
         if (session.client) {
            await session.client.disconnect();
         }
      }
      this._activeSessions.clear();
   }

   /**
    * Gets the active session by ID
    */
   public getSession(sessionId: string): SessionInfo | undefined {
      return this._activeSessions.get(sessionId);
   }

   /**
    * Gets all active sessions
    */
   public getAllSessions(): SessionInfo[] {
      return Array.from(this._activeSessions.values());
   }

   /**
    * Try to connect to the default port
    */
   public async connectToDefaultPort(): Promise<SessionInfo> {
      return this.connectToPort(this._basePort, 'Default Tauri App');
   }

   /**
    * Check if a port is in use (likely a Tauri app)
    */
   private async _isPortInUse(port: number): Promise<boolean> {
      const client = new PluginClient(this._host, port);

      try {
         // Try to connect briefly to see if port responds
         await Promise.race([
            client.connect(),
            new Promise((_, reject) => {
               setTimeout(() => { reject(new Error('Timeout')); }, 100);
            }),
         ]);

         // Connection succeeded - clean up and return true
         client.disconnect();
         return true;
      } catch{
         // Connection failed or timed out - always clean up the client
         // This prevents orphaned WebSocket connections from emitting errors later
         client.disconnect();
         return false;
      }
   }
}

// Singleton instance
export const appDiscovery = new AppDiscovery();
