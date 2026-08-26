import WebSocket from 'ws';
import { EventEmitter } from 'events';

import { buildWebSocketURL, getDefaultHost, getDefaultPort } from '../config.js';

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000,
      DEFAULT_HEARTBEAT_TIMEOUT_MS = 10000,
      DEFAULT_CONNECTION_CHECK_TIMEOUT_MS = 1000;


interface PluginCommand {
   id?: string;
   command: string;
   args?: unknown;
}

export interface PluginResponse {
   id?: string;
   success: boolean;
   data?: unknown;
   error?: string;
   windowContext?: {
      windowLabel: string;
      totalWindows: number;
      warning?: string;
   };
}

export interface PluginClientOptions {

   /** How often to ping an idle bridge connection. */
   readonly heartbeatIntervalMs?: number;

   /** How long to wait for a heartbeat pong before terminating the socket. */
   readonly heartbeatTimeoutMs?: number;
}

/**
 * Client to communicate with the MCP Bridge plugin's WebSocket server
 */
/* eslint-disable no-plusplus */
export class PluginClient extends EventEmitter {
   private _ws: WebSocket | null = null;
   private _url: string;
   private _host: string;
   private _port: number;
   private _reconnectAttempts = 0;
   private _shouldReconnect = true; // Keep trying forever until explicitly disconnected
   private _reconnectDelay = 1000; // Start with 1s, max 30s
   private _reconnectTimer: NodeJS.Timeout | null = null;
   private _heartbeatTimer: NodeJS.Timeout | null = null;
   private _heartbeatTimeout: NodeJS.Timeout | null = null;
   private readonly _heartbeatIntervalMs: number;
   private readonly _heartbeatTimeoutMs: number;
   private _pendingRequests: Map<string, {
      resolve: (value: PluginResponse) => void;
      reject: (reason: Error) => void;
      timeout: NodeJS.Timeout;
   }> = new Map();

   /**
    * Constructor for PluginClient
    * @param host Host address of the WebSocket server
    * @param port Port number of the WebSocket server
    * @param options Optional connection liveness settings
    */
   public constructor(host: string, port: number, options: PluginClientOptions = {}) {
      super();
      this._host = host;
      this._port = port;
      this._url = buildWebSocketURL(host, port);
      this._heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
      this._heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;

      // CRITICAL: Attach a default error handler to prevent crashes.
      // In Node.js, if an EventEmitter emits 'error' with no listeners, it throws
      // an uncaught exception that crashes the process. This is especially important
      // during port scanning where connections may fail after the caller has moved on.
      this.on('error', () => {
         // Silently ignore - errors are also returned via promise rejections
      });
   }

   /**
    * Creates a PluginClient with default configuration from environment.
    */
   public static create_default(): PluginClient {
      return new PluginClient(getDefaultHost(), getDefaultPort());
   }

   /**
    * Gets the host this client is configured to connect to.
    */
   public get host(): string {
      return this._host;
   }

   /**
    * Gets the port this client is configured to connect to.
    */
   public get port(): number {
      return this._port;
   }

   /**
    * Connect to the plugin's WebSocket server
    */
   public async connect(): Promise<void> {
      return new Promise((resolve, reject) => {
         if (this._ws?.readyState === WebSocket.OPEN) {
            resolve();
            return;
         }

         this._ws = new WebSocket(this._url);

         this._ws.on('open', () => {
            // Connected to MCP Bridge plugin
            this._reconnectAttempts = 0;
            this._startHeartbeat();
            this.emit('connected');
            resolve();
         });

         this._ws.on('pong', () => {
            this._clearHeartbeatTimeout();
         });

         this._ws.on('message', (data: WebSocket.Data) => {
            try {
               const message = JSON.parse(data.toString());

               // Check if this is a response to a pending request
               if (message.id && this._pendingRequests.has(message.id)) {
                  const pending = this._pendingRequests.get(message.id);

                  if (pending) {
                     clearTimeout(pending.timeout);
                     this._pendingRequests.delete(message.id);
                     pending.resolve(message);
                  }
               } else {
                  // It's a broadcast event
                  this.emit('event', message);
               }
            } catch(e) {
               // Failed to parse WebSocket message
            }
         });

         this._ws.on('error', (err) => {
            // WebSocket error - emit for any listeners, then reject the promise.
            // Note: The constructor attaches a default error handler to prevent crashes.
            this.emit('error', err);
            reject(err);
         });

         this._ws.on('close', () => {
            // Disconnected from MCP Bridge plugin
            this._stopHeartbeat();
            this.emit('disconnected');
            this._ws = null;

            // Reject all pending requests since the connection is gone
            for (const [ id, pending ] of this._pendingRequests) {
               clearTimeout(pending.timeout);
               pending.reject(new Error('Connection closed'));
               this._pendingRequests.delete(id);
            }

            // Auto-reconnect with exponential backoff (max 30s)
            if (this._shouldReconnect) {
               this._reconnectAttempts++;
               const delay = Math.min(this._reconnectDelay * this._reconnectAttempts, 30000);

               this._reconnectTimer = setTimeout(() => {
                  this._reconnectTimer = null;

                  if (!this._shouldReconnect) {
                     return;
                  }

                  this.connect().catch(() => {
                     // Reconnection failed - will retry on next close event
                  });
               }, delay);
               this._reconnectTimer.unref();
            }
         });
      });
   }

   /**
    * Disconnect from the plugin
    */
   public disconnect(): void {
      this._shouldReconnect = false; // Prevent auto-reconnect
      this._stopHeartbeat();

      if (this._reconnectTimer) {
         clearTimeout(this._reconnectTimer);
         this._reconnectTimer = null;
      }

      if (this._ws) {
         this._ws.close();
         this._ws = null;
      }
   }

   /**
    * Probe the current WebSocket with a ping/pong exchange.
    *
    * `readyState === OPEN` is insufficient for half-open TCP connections, so
    * session reuse calls this before trusting a cached client.
    */
   public async checkConnection(timeoutMs = DEFAULT_CONNECTION_CHECK_TIMEOUT_MS): Promise<boolean> {
      const socket = this._ws;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
         return false;
      }

      const openSocket = socket;

      return new Promise<boolean>((resolve) => {
         const probeState: {
            settled: boolean;
            timeout: NodeJS.Timeout | null;
         } = {
            settled: false,
            timeout: null,
         };

         function finish(isAlive: boolean): void {
            if (probeState.settled) {
               return;
            }

            probeState.settled = true;

            if (probeState.timeout) {
               clearTimeout(probeState.timeout);
            }

            openSocket.off('pong', handlePong);
            openSocket.off('close', handleDisconnect);
            openSocket.off('error', handleDisconnect);
            resolve(isAlive);
         }

         function handlePong(): void {
            finish(true);
         }

         function handleDisconnect(): void {
            finish(false);
         }

         probeState.timeout = setTimeout(() => { finish(false); }, timeoutMs);

         openSocket.once('pong', handlePong);
         openSocket.once('close', handleDisconnect);
         openSocket.once('error', handleDisconnect);

         try {
            openSocket.ping(undefined, undefined, (error) => {
               if (error) {
                  finish(false);
               }
            });
         } catch{
            finish(false);
         }
      });
   }

   /**
    * Send a command to the plugin and wait for response.
    *
    * Automatically retries on transient "not found" errors (e.g. window not
    * yet registered after WebSocket connect) with exponential backoff.
    */
   public async sendCommand(command: PluginCommand, timeoutMs = 5000): Promise<PluginResponse> {
      const maxRetries = 3;

      const baseDelayMs = 100;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
         // If not connected, try to reconnect first
         if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            try {
               await this.connect();
            } catch{
               throw new Error('Not connected to plugin and reconnection failed');
            }
         }

         // Double-check connection after reconnect attempt
         if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to plugin');
         }

         // Generate unique ID for this request
         const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

         const commandWithId = { ...command, id };

         const response = await new Promise<PluginResponse>((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
               this._pendingRequests.delete(id);
               reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            // Store pending request
            this._pendingRequests.set(id, { resolve, reject, timeout });

            // Send command
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._ws!.send(JSON.stringify(commandWithId), (error) => {
               if (error) {
                  clearTimeout(timeout);
                  this._pendingRequests.delete(id);
                  reject(error);
               }
            });
         });

         // Retry on "not found" errors (window not yet registered)
         if (!response.success && response.error?.includes('not found') && attempt < maxRetries) {
            await new Promise<void>((r) => { setTimeout(r, baseDelayMs * Math.pow(2, attempt)); });
            continue;
         }

         return response;
      }

      // Unreachable — loop always returns or throws — but satisfies TypeScript
      throw new Error('Retry attempts exhausted');
   }

   /**
    * Check if connected
    */
   public isConnected(): boolean {
      return this._ws?.readyState === WebSocket.OPEN;
   }

   private _clearHeartbeatTimeout(): void {
      if (this._heartbeatTimeout) {
         clearTimeout(this._heartbeatTimeout);
         this._heartbeatTimeout = null;
      }
   }

   private _stopHeartbeat(): void {
      if (this._heartbeatTimer) {
         clearInterval(this._heartbeatTimer);
         this._heartbeatTimer = null;
      }

      this._clearHeartbeatTimeout();
   }

   private _startHeartbeat(): void {
      this._stopHeartbeat();

      this._heartbeatTimer = setInterval(() => {
         const socket = this._ws;

         if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
         }

         // A previous ping is still unanswered. Terminate instead of letting an
         // OPEN-but-half-dead socket stay in the session cache indefinitely.
         if (this._heartbeatTimeout) {
            socket.terminate();
            return;
         }

         this._heartbeatTimeout = setTimeout(() => {
            this._heartbeatTimeout = null;

            if (this._ws === socket && socket.readyState === WebSocket.OPEN) {
               socket.terminate();
            }
         }, this._heartbeatTimeoutMs);
         this._heartbeatTimeout.unref();

         try {
            socket.ping(undefined, undefined, (error) => {
               if (error && this._ws === socket && socket.readyState === WebSocket.OPEN) {
                  socket.terminate();
               }
            });
         } catch{
            this._clearHeartbeatTimeout();

            if (this._ws === socket && socket.readyState === WebSocket.OPEN) {
               socket.terminate();
            }
         }
      }, this._heartbeatIntervalMs);
      this._heartbeatTimer.unref();
   }
}

// Singleton instance
let pluginClient: PluginClient | null = null;

/**
 * Gets the existing singleton PluginClient without creating or modifying it.
 * Use this for status checks where you don't want to affect the current connection.
 *
 * @returns The existing PluginClient or null if none exists
 */
export function getExistingPluginClient(): PluginClient | null {
   return pluginClient;
}

/**
 * Gets or creates a singleton PluginClient.
 *
 * If host/port are provided and differ from the existing client's configuration,
 * the existing client is disconnected and a new one is created. This ensures
 * that session start with a specific port always uses that port.
 *
 * @param host Optional host override
 * @param port Optional port override
 */
export function getPluginClient(host?: string, port?: number): PluginClient {
   const resolvedHost = host ?? getDefaultHost();

   const resolvedPort = port ?? getDefaultPort();

   // If singleton exists but host/port don't match, reset it
   if (pluginClient && (pluginClient.host !== resolvedHost || pluginClient.port !== resolvedPort)) {
      pluginClient.disconnect();
      pluginClient = null;
   }

   if (!pluginClient) {
      pluginClient = new PluginClient(resolvedHost, resolvedPort);
   }

   return pluginClient;
}

/**
 * Resets the singleton client (useful for reconnecting with different config).
 */
export function resetPluginClient(): void {
   if (pluginClient) {
      pluginClient.disconnect();
      pluginClient = null;
   }
}

export async function connectPlugin(host?: string, port?: number): Promise<void> {
   const client = getPluginClient(host, port);

   if (!client.isConnected()) {
      await client.connect();
   }
}

/**
 * Ensures a session is active and connects to the plugin using session config.
 * This should be used by all tools that require a connected Tauri app.
 *
 * @param appIdentifier - Optional app identifier to target specific app
 * @throws Error if no session is active
 */
export async function ensureSessionAndConnect(appIdentifier?: string | number): Promise<PluginClient> {
   // Import dynamically to avoid circular dependency
   const { resolveTargetApp } = await import('./session-manager.js');

   const session = resolveTargetApp(appIdentifier);

   // Ensure client is connected
   if (!session.client.isConnected()) {
      await session.client.connect();
   }

   return session.client;
}

export async function disconnectPlugin(): Promise<void> {
   const client = getPluginClient();

   client.disconnect();
}
