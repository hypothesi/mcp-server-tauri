import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Plugin Client Unit Tests', () => {
   beforeEach(async () => {
      // Reset the singleton before each test
      const { resetPluginClient } = await import('../../src/driver/plugin-client');

      resetPluginClient();
   });

   afterEach(async () => {
      // Clean up after each test
      const { resetPluginClient } = await import('../../src/driver/plugin-client');

      resetPluginClient();
   });

   describe('getPluginClient', () => {
      it('should create singleton with default host and port', async () => {
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client = getPluginClient();

         expect(client).toBeDefined();
         expect(client.host).toBe('localhost');
         expect(client.port).toBe(9223);
      });

      it('should create singleton with custom host and port', async () => {
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client = getPluginClient('192.168.1.100', 9300);

         expect(client.host).toBe('192.168.1.100');
         expect(client.port).toBe(9300);
      });

      it('should return same singleton on subsequent calls with same params', async () => {
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9300),
               client2 = getPluginClient('localhost', 9300);

         expect(client1).toBe(client2);
         expect(client2.port).toBe(9300);
      });

      it('should recreate singleton when called without params after custom config', async () => {
         // This verifies that calling getPluginClient() without params will use defaults,
         // and if the existing singleton has different config, it will be recreated
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9300),
               client2 = getPluginClient(); // Uses default port 9223

         expect(client1).not.toBe(client2);
         expect(client1.port).toBe(9300);
         expect(client2.port).toBe(9223);
      });

      it('should recreate singleton when host changes', async () => {
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         const client1 = getPluginClient('localhost', 9223),
               client2 = getPluginClient('192.168.1.100', 9223);

         expect(client1).not.toBe(client2);
         expect(client2.host).toBe('192.168.1.100');
      });

      it('should recreate singleton when port changes', async () => {
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

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
         const { getPluginClient, resetPluginClient } = await import('../../src/driver/plugin-client');

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
         const { ensureSessionAndConnect, resetPluginClient } = await import('../../src/driver/plugin-client');

         resetPluginClient();

         await expect(ensureSessionAndConnect()).rejects.toThrow(
            'No active session. Call driver_session with action "start" first'
         );
      });
   });
});
