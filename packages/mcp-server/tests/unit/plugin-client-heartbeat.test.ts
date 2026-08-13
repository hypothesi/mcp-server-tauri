import type { AddressInfo } from 'node:net';

import WebSocket, { WebSocketServer } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import { PluginClient } from '../../src/driver/plugin-client';

interface TestServer {
   readonly server: WebSocketServer;
   readonly sockets: Set<WebSocket>;
   readonly port: number;
}

describe('PluginClient heartbeat', () => {
   const clients: PluginClient[] = [],
         servers: TestServer[] = [];

   async function createServer(onConnection?: (socket: WebSocket) => void): Promise<TestServer> {
      const sockets = new Set<WebSocket>(),
            server = new WebSocketServer({ host: '127.0.0.1', port: 0 });

      server.on('connection', (socket) => {
         sockets.add(socket);
         socket.on('close', () => { sockets.delete(socket); });
         onConnection?.(socket);
      });

      await new Promise<void>((resolve, reject) => {
         server.once('listening', resolve);
         server.once('error', reject);
      });

      const address = server.address() as AddressInfo,
            testServer = { server, sockets, port: address.port };

      servers.push(testServer);
      return testServer;
   }

   function createClient(port: number, heartbeatIntervalMs = 30000, heartbeatTimeoutMs = 10000): PluginClient {
      const client = new PluginClient('127.0.0.1', port, {
         heartbeatIntervalMs,
         heartbeatTimeoutMs,
      });

      clients.push(client);
      return client;
   }

   afterEach(async () => {
      for (const client of clients.splice(0)) {
         client.disconnect();
      }

      await Promise.all(servers.splice(0).map(async ({ server, sockets }) => {
         for (const socket of sockets) {
            socket.terminate();
         }

         await new Promise<void>((resolve) => {
            server.close(() => { resolve(); });
         });
      }));
   });

   it('confirms a healthy OPEN connection with ping/pong', async () => {
      const { port } = await createServer(),
            client = createClient(port);

      await client.connect();

      await expect(client.checkConnection(250)).resolves.toBe(true);
   });

   it('rejects an OPEN connection that does not return a pong', async () => {
      const { port } = await createServer((socket) => { socket.pause(); }),
            client = createClient(port);

      await client.connect();

      expect(client.isConnected()).toBe(true);
      await expect(client.checkConnection(50)).resolves.toBe(false);
      expect(client.isConnected()).toBe(true);
   });

   it('terminates an unresponsive connection after a missed heartbeat', async () => {
      const { port } = await createServer((socket) => { socket.pause(); }),
            client = createClient(port, 20, 25);

      const disconnected = new Promise<void>((resolve) => {
         client.once('disconnected', () => { resolve(); });
      });

      await client.connect();

      await Promise.race([
         disconnected,
         new Promise<void>((_resolve, reject) => {
            setTimeout(() => { reject(new Error('Heartbeat did not close stale connection')); }, 500);
         }),
      ]);
      expect(client.isConnected()).toBe(false);
   });
});
