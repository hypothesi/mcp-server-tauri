import WebSocket from 'ws';
import { EventEmitter } from 'events';

import { buildWebSocketURL, getDefaultHost, getDefaultPort } from '../config.js';


interface PluginCommand {
   id?: string;
   command: string;
   args?: unknown;
}

interface PluginResponse {
   id?: string;
   success: boolean;
   data?: unknown;
   error?: string;
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
   private _pendingRequests: Map<string, {
      resolve: (value: PluginResponse) => void;
      reject: (reason: Error) => void;
      timeout: NodeJS.Timeout;
   }> = new Map();

   /**
    * Constructor for PluginClient
    * @param host Host address of the WebSocket server
    * @param port Port number of the WebSocket server
    */
   public constructor(host: string, port: number) {
      super();
      this._host = host;
      this._port = port;
      this._url = buildWebSocketURL(host, port);

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
            this.emit('connected');
            resolve();
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

               setTimeout(() => {
                  this.connect().catch(() => {
                     // Reconnection failed - will retry on next close event
                  });
               }, delay);
            }
         });
      });
   }

   /**
    * Disconnect from the plugin
    */
   public disconnect(): void {
      this._shouldReconnect = false; // Prevent auto-reconnect
      if (this._ws) {
         this._ws.close();
         this._ws = null;
      }
   }

   /**
    * Send a command to the plugin and wait for response
    */
   public async sendCommand(command: PluginCommand, timeoutMs = 5000): Promise<PluginResponse> {
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

      return new Promise((resolve, reject) => {
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
   }

   /**
    * Check if connected
    */
   public isConnected(): boolean {
      return this._ws?.readyState === WebSocket.OPEN;
   }
}

// Singleton instance
let pluginClient: PluginClient | null = null;

/**
 * Gets or creates a singleton PluginClient.
 * @param host Optional host override
 * @param port Optional port override
 */
export function getPluginClient(host?: string, port?: number): PluginClient {
   const resolvedHost = host ?? getDefaultHost();

   const resolvedPort = port ?? getDefaultPort();

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

export async function disconnectPlugin(): Promise<void> {
   const client = getPluginClient();

   client.disconnect();
}
