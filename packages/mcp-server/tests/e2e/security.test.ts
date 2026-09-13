/**
 * Plugin WebSocket handshake controls (WP-4).
 *
 * Needs the real test-app from vitest.global-setup. If this environment cannot
 * launch Tauri, the Rust unit tests in tauri-plugin-mcp-bridge are the gate.
 */

import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { MCP_BRIDGE_TOKEN_HEADER } from '../../src/config.js';
import { getE2EBridgeToken, getTestAppPort, isTestAppStarted } from '../test-utils.js';

const TIMEOUT = 10000;

function connect(headers?: Record<string, string>): Promise<WebSocket> {
   return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${getTestAppPort()}`, headers ? { headers } : undefined);

      function fail(error: Error): void {
         ws.removeAllListeners();
         // Keep an error listener so terminate()/abortHandshake does not
         // surface as an uncaught exception after a 401 handshake reject.
         ws.on('error', () => {
            // Handshake already failed.
         });
         try {
            ws.terminate();
         } catch{
            // Socket may already be closed after a handshake reject.
         }
         reject(error);
      }

      ws.once('open', () => {
         resolve(ws);
      });
      ws.once('unexpected-response', (_req, res) => {
         res.resume();
         fail(new Error(`handshake rejected (${res.statusCode})`));
      });
      ws.once('error', (error) => {
         fail(error);
      });
      ws.once('close', () => {
         fail(new Error('WebSocket closed before handshake completed'));
      });
   });
}

describe.skipIf(!isTestAppStarted())('plugin WebSocket security', () => {
   const sockets: WebSocket[] = [];

   afterAll(() => {
      for (const socket of sockets.splice(0)) {
         try {
            socket.terminate();
         } catch{
            // Ignore already-closed sockets.
         }
      }
   });

   it('rejects a missing X-MCP-Bridge-Token (unauth execute_js cannot run)', async () => {
      await expect(connect()).rejects.toThrow(/handshake rejected|closed before handshake/i);
   }, TIMEOUT);

   it('rejects a wrong token', async () => {
      await expect(connect({ [MCP_BRIDGE_TOKEN_HEADER]: 'wrong-token' }))
         .rejects
         .toThrow(/handshake rejected|closed before handshake/i);
   }, TIMEOUT);

   it('accepts the matching MCP_BRIDGE_TOKEN and can call get_backend_state', async () => {
      const ws = await connect({ [MCP_BRIDGE_TOKEN_HEADER]: getE2EBridgeToken() });

      sockets.push(ws);

      const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
         const timer = setTimeout(() => {
            reject(new Error('timed out waiting for plugin response'));
         }, TIMEOUT);

         ws.once('message', (data) => {
            clearTimeout(timer);
            resolve(JSON.parse(data.toString()) as Record<string, unknown>);
         });
         ws.send(JSON.stringify({
            id: 'sec-1',
            command: 'get_backend_state',
            args: {},
         }));
      });

      expect(response.id).toBe('sec-1');
      expect(response.success).toBe(true);
   }, TIMEOUT);
});
