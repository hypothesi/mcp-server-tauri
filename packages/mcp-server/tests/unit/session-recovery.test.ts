import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => {
   return {
      healthResults: [] as Array<boolean | Error>,
      instances: [] as Array<{
         readonly checkConnection: ReturnType<typeof vi.fn>;
         readonly connect: ReturnType<typeof vi.fn>;
         readonly disconnect: ReturnType<typeof vi.fn>;
      }>,
   };
});

vi.mock('../../src/driver/plugin-client.js', () => {
   class PluginClient {
      public readonly host: string;
      public readonly port: number;

      public readonly checkConnection = vi.fn(async () => {
         const result = clientMocks.healthResults.shift() ?? true;

         if (result instanceof Error) {
            throw result;
         }

         return result;
      });

      public readonly connect = vi.fn(() => { return Promise.resolve(); });
      public readonly disconnect = vi.fn();
      public readonly sendCommand = vi.fn(async () => {
         return {
            success: true,
            data: {
               app: { identifier: 'com.hypothesi.test-app' },
               cwd: '/test/app',
            },
         };
      });

      public constructor(host: string, port: number) {
         this.host = host;
         this.port = port;
         clientMocks.instances.push(this);
      }
   }

   return { PluginClient };
});

vi.mock('../../src/driver/app-discovery.js', () => {
   class AppDiscovery {
      public readonly host: string;

      public constructor(host: string) {
         this.host = host;
      }

      public async connectToPort(port: number, _appName?: string, host?: string): Promise<{
         name: string;
         host: string;
         port: number;
      }> {
         const targetHost = host ?? this.host;

         return {
            name: `Tauri App (${targetHost}:${port})`,
            host: targetHost,
            port,
         };
      }

      public async getFirstAvailableApp(): Promise<null> {
         return null;
      }

      public disconnectAll(): Promise<void> {
         return Promise.resolve();
      }
   }

   return { AppDiscovery };
});

describe('driver session stale recovery', () => {
   beforeEach(() => {
      vi.resetModules();
      clientMocks.healthResults.length = 0;
      clientMocks.instances.length = 0;
   });

   it('keeps a cached session that responds to a liveness probe', async () => {
      const { manageDriverSession } = await import('../../src/driver/session-manager');

      await manageDriverSession('start', 'localhost', 9223);
      const result = await manageDriverSession('start', 'localhost', 9223);

      expect(result).toBe('Already connected to app on port 9223');
      expect(clientMocks.instances).toHaveLength(1);
      expect(clientMocks.instances[0]?.checkConnection).toHaveBeenCalledOnce();
      expect(clientMocks.instances[0]?.disconnect).not.toHaveBeenCalled();
   });

   it('removes and reconnects a cached session that misses its liveness probe', async () => {
      const { manageDriverSession } = await import('../../src/driver/session-manager');

      await manageDriverSession('start', 'localhost', 9223);
      clientMocks.healthResults.push(false);

      const result = await manageDriverSession('start', 'localhost', 9223);

      expect(result).toContain('Session started with app');
      expect(clientMocks.instances).toHaveLength(2);
      expect(clientMocks.instances[0]?.checkConnection).toHaveBeenCalledOnce();
      expect(clientMocks.instances[0]?.disconnect).toHaveBeenCalledOnce();
      expect(clientMocks.instances[1]?.connect).toHaveBeenCalledOnce();
   });

   it('reconnects when probing the cached session throws', async () => {
      const { manageDriverSession } = await import('../../src/driver/session-manager');

      await manageDriverSession('start', 'localhost', 9223);
      clientMocks.healthResults.push(new Error('Socket closed during ping'));

      const result = await manageDriverSession('start', 'localhost', 9223);

      expect(result).toContain('Session started with app');
      expect(clientMocks.instances).toHaveLength(2);
      expect(clientMocks.instances[0]?.disconnect).toHaveBeenCalledOnce();
      expect(clientMocks.instances[1]?.connect).toHaveBeenCalledOnce();
   });
});
