import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppDiscovery } from '../../src/driver/app-discovery';
import { createStubBridge, type StubBridge } from './stub-bridge';

describe('AppDiscovery handshake', () => {
   const originalEnv = process.env,
         stubs: StubBridge[] = [],
         discoveries: AppDiscovery[] = [];

   beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.MCP_BRIDGE_HOST;
      delete process.env.MCP_BRIDGE_TOKEN;
      delete process.env.TAURI_DEV_HOST;
   });

   afterEach(async () => {
      for (const discovery of discoveries.splice(0)) {
         await discovery.disconnectAll();
      }

      await Promise.all(stubs.splice(0).map((stub) => {
         return stub.close();
      }));

      process.env = originalEnv;
   });

   async function startStub(requiredToken?: string): Promise<StubBridge> {
      const stub = await createStubBridge(
         requiredToken === undefined ? {} : { requiredToken }
      );

      stubs.push(stub);
      return stub;
   }

   function discoveryFor(stub: StubBridge): AppDiscovery {
      const discovery = new AppDiscovery('127.0.0.1', stub.port, 1);

      discoveries.push(discovery);
      return discovery;
   }

   it('skips a listening WebSocket when no token is configured', async () => {
      const stub = await startStub(),
            discovery = discoveryFor(stub);

      expect(await discovery.getFirstAvailableApp()).toBeNull();
      expect(stub.tokens).toEqual([]);
   });

   it('selects a listening WebSocket that completes the token handshake', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret';

      const stub = await startStub('secret'),
            discovery = discoveryFor(stub),
            app = await discovery.getFirstAvailableApp();

      expect(app?.port).toBe(stub.port);
      expect(stub.tokens).toContain('secret');
   });

   it('skips a listening WebSocket that rejects the token handshake', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret';

      const stub = await startStub('other-secret'),
            discovery = discoveryFor(stub);

      expect(await discovery.getFirstAvailableApp()).toBeNull();
   });

   it('does not scan a non-allowlisted host', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret';

      const discovery = new AppDiscovery('203.0.113.5', 9223, 1);

      expect(await discovery.discoverApps()).toEqual([]);
   });

   it('connectToPort still attaches to an explicit loopback peer without a token', async () => {
      const stub = await startStub(),
            discovery = discoveryFor(stub),
            session = await discovery.connectToPort(stub.port);

      expect(session.connected).toBe(true);
      expect(session.port).toBe(stub.port);
   });

   it('connectToPort sends the configured token and attaches when the peer accepts it', async () => {
      process.env.MCP_BRIDGE_TOKEN = 'secret';

      const stub = await startStub('secret'),
            discovery = discoveryFor(stub),
            session = await discovery.connectToPort(stub.port);

      expect(session.connected).toBe(true);
      expect(stub.tokens).toContain('secret');
   });
});
