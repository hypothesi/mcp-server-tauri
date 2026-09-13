import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PluginClient, resetPluginClient } from '../../src/driver/plugin-client';
import { MCP_BRIDGE_TOKEN_HEADER } from '../../src/config';
import { createStubBridge, type StubBridge } from './stub-bridge';

describe('Plugin Client Unit Tests', () => {
   beforeEach(() => {
      resetPluginClient();
   });

   afterEach(() => {
      resetPluginClient();
   });

   describe('getPluginClient', () => {
      it('should create singleton with default host and port', async () => {
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client = getPluginClient();

         expect(client).toBeDefined();
         expect(client.host).toBe('localhost');
         expect(client.port).toBe(9223);
      });

      it('should create singleton with custom host and port', async () => {
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client = getPluginClient('192.168.1.100', 9300);

         expect(client.host).toBe('192.168.1.100');
         expect(client.port).toBe(9300);
      });

      it('should return same singleton on subsequent calls with same params', async () => {
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9300),
               client2 = getPluginClient('localhost', 9300);

         expect(client1).toBe(client2);
         expect(client2.port).toBe(9300);
      });

      it('should recreate singleton when called without params after custom config', async () => {
         // This verifies that calling getPluginClient() without params will use defaults,
         // and if the existing singleton has different config, it will be recreated
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9300),
               client2 = getPluginClient(); // Uses default port 9223

         expect(client1).not.toBe(client2);
         expect(client1.port).toBe(9300);
         expect(client2.port).toBe(9223);
      });

      it('should recreate singleton when host changes', async () => {
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9223),
               client2 = getPluginClient('192.168.1.100', 9223);

         expect(client1).not.toBe(client2);
         expect(client2.host).toBe('192.168.1.100');
      });

      it('should recreate singleton when port changes', async () => {
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9223),
               client2 = getPluginClient('localhost', 9300);

         expect(client1).not.toBe(client2);
         expect(client2.port).toBe(9300);
      });

      it('should handle session start with custom port after status check', async () => {
         // This test verifies the fix for the production bug where:
         // 1. Status check creates singleton with default port
         // 2. Session start with custom port should recreate singleton
         const { getPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         // Simulate status check (no params, uses defaults)
         const statusClient = getPluginClient();

         expect(statusClient.port).toBe(9223);

         // Simulate session start with custom port
         const sessionClient = getPluginClient('localhost', 9224);

         expect(sessionClient.port).toBe(9224);
         expect(sessionClient).not.toBe(statusClient);
      });
   });

   describe('ensureSessionAndConnect', () => {
      it('should throw error when no session is active', async () => {
         const { ensureSessionAndConnect } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         await expect(ensureSessionAndConnect()).rejects.toThrow(
            'No active session. Call driver_session with action "start" first'
         );
      });
   });
});

describe('PluginClient token handshake', () => {
   const originalEnv = process.env,
         clients: PluginClient[] = [],
         stubs: StubBridge[] = [];

   beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.MCP_BRIDGE_TOKEN;
      resetPluginClient();
   });

   afterEach(async () => {
      for (const client of clients.splice(0)) {
         client.disconnect();
      }

      await Promise.all(stubs.splice(0).map((stub) => {
         return stub.close();
      }));

      resetPluginClient();
      process.env = originalEnv;
   });

   it('sends X-MCP-Bridge-Token from MCP_BRIDGE_TOKEN on connect', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret-token';

      const stub = await createStubBridge();

      stubs.push(stub);

      const client = new PluginClient('127.0.0.1', stub.port);

      clients.push(client);
      await client.connect();

      expect(MCP_BRIDGE_TOKEN_HEADER).toBe('X-MCP-Bridge-Token');
      expect(stub.tokens).toEqual([ 'secret-token' ]);
      expect(client.isConnected()).toBe(true);
   });

   it('does not silently complete handshake against a stub that requires a token when none is configured', async () => {
      const stub = await createStubBridge({ requiredToken: 'secret-token' });

      stubs.push(stub);

      const client = new PluginClient('127.0.0.1', stub.port);

      clients.push(client);

      await expect(client.connect()).rejects.toThrow(/handshake rejected|closed before handshake/i);
      expect(client.isConnected()).toBe(false);
   });

   it('connects when the configured token matches the stub handshake', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret-token';

      const stub = await createStubBridge({ requiredToken: 'secret-token' });

      stubs.push(stub);

      const client = new PluginClient('127.0.0.1', stub.port);

      clients.push(client);
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(stub.tokens).toEqual([ 'secret-token' ]);
   });

   it('connects with the plugin-written token file when MCP_BRIDGE_TOKEN is unset (loopback only)', async () => {
      const tokenDir = mkdtempSync(join(tmpdir(), 'mcp-bridge-client-token-'));

      process.env.MCP_BRIDGE_TOKEN_FILE = join(tokenDir, 'hypothesi-mcp-bridge.token');
      writeFileSync(process.env.MCP_BRIDGE_TOKEN_FILE, 'file-token\n');

      try {
         const stub = await createStubBridge({ requiredToken: 'file-token' });

         stubs.push(stub);

         const client = new PluginClient('127.0.0.1', stub.port);

         clients.push(client);
         await client.connect();

         expect(client.isConnected()).toBe(true);
         expect(stub.tokens).toEqual([ 'file-token' ]);
      } finally {
         rmSync(tokenDir, { recursive: true, force: true });
      }
   });

   it('rejects a stub that requires a different token', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'wrong-token';

      const stub = await createStubBridge({ requiredToken: 'secret-token' });

      stubs.push(stub);

      const client = new PluginClient('127.0.0.1', stub.port);

      clients.push(client);

      await expect(client.connect()).rejects.toThrow(/handshake rejected|closed before handshake/i);
   });
});
