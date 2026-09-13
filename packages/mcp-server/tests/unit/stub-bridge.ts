/**
 * Tiny in-process WebSocket double for MCP Bridge handshake tests.
 *
 * Not the real plugin server (WP-4). Optionally requires X-MCP-Bridge-Token
 * on upgrade so client discovery/connect tests can prove unauth peers are skipped.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocketServer, type WebSocket } from 'ws';

export interface StubBridge {
   readonly port: number;
   readonly tokens: string[];
   close: () => Promise<void>;
}

export async function createStubBridge(options: {
   requiredToken?: string;
} = {}): Promise<StubBridge> {
   const tokens: string[] = [],
         sockets = new Set<WebSocket>(),
         httpServer = createServer(),
         wss = new WebSocketServer({ noServer: true });

   wss.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => { sockets.delete(socket); });
      socket.on('message', (data) => {
         try {
            const message = JSON.parse(data.toString()) as { id?: string };

            if (message.id) {
               socket.send(JSON.stringify({
                  id: message.id,
                  success: true,
                  data: {
                     app: { name: 'Stub App', identifier: 'com.stub' },
                     cwd: '/stub',
                     bridge: { pluginVersion: '0.14.0' },
                  },
               }));
            }
         } catch{
            // Ignore malformed probe frames from the client under test.
         }
      });
   });

   httpServer.on('upgrade', (req, socket, head) => {
      const token = req.headers['x-mcp-bridge-token'];

      if (typeof token === 'string') {
         tokens.push(token);
      }

      if (options.requiredToken !== undefined && token !== options.requiredToken) {
         socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
         socket.destroy();
         return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
         wss.emit('connection', ws, req);
      });
   });

   await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', resolve);
   });

   const address = httpServer.address() as AddressInfo;

   return {
      port: address.port,
      tokens,
      async close(): Promise<void> {
         for (const socket of sockets) {
            socket.terminate();
         }

         await new Promise<void>((resolve) => {
            wss.close(() => {
               httpServer.close(() => { resolve(); });
            });
         });
      },
   };
}
