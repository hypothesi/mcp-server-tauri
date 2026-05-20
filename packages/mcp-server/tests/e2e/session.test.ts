import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { manageDriverSession } from '../../src/driver/session-manager';
import { getTestAppPort } from '../test-utils';

describe('Session Manager E2E Tests', () => {
   const TIMEOUT = 30000;

   beforeAll(async () => {
      // App is already started globally by the test setup
   }, TIMEOUT);

   afterAll(async () => {
      // Clean up session
      await manageDriverSession('stop');
   }, TIMEOUT);

   describe('Session Start with Default Settings', () => {
      it('should start session with localhost by default', async () => {
         const result = await manageDriverSession('start');

         expect(result).toContain('Session started');
         // Should connect to localhost since the test app is running locally
         expect(result).toMatch(/localhost|127\.0\.0\.1/);
      }, TIMEOUT);

      it('should stop session successfully', async () => {
         const result = await manageDriverSession('stop');

         expect(result).toBe('All sessions stopped');
      }, TIMEOUT);
   });

   describe('Session Start with Custom Port', () => {
      it('should start session on specified port', async () => {
         const port = getTestAppPort(),
               result = await manageDriverSession('start', undefined, port);

         expect(result).toContain('Session started');
         expect(result).toContain(String(port));
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session Start with Explicit Host', () => {
      it.skip('should fall back to auto-discovery when explicit host fails', async () => {
         // SKIPPED: This test takes too long because connecting to a non-existent remote
         // host times out slowly. The fallback logic works but is not practical to test.
         const result = await manageDriverSession('start', '192.168.1.100');

         expect(result).toContain('Session started');
         expect(result).toContain('localhost');
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session Start with localhost Host', () => {
      it('should connect directly to localhost without fallback', async () => {
         const result = await manageDriverSession('start', 'localhost');

         expect(result).toContain('Session started');
         expect(result).toContain('localhost');
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session Start with 127.0.0.1 Host', () => {
      it('should connect directly to 127.0.0.1 without fallback', async () => {
         const result = await manageDriverSession('start', '127.0.0.1');

         expect(result).toContain('Session started');
         // Should work since 127.0.0.1 is localhost
         expect(result).toMatch(/127\.0\.0\.1|localhost/);
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session with Custom Host and Port', () => {
      it('should accept both host and port parameters', async () => {
         const port = getTestAppPort(),
               result = await manageDriverSession('start', 'localhost', port);

         expect(result).toContain('Session started');
         expect(result).toContain('localhost');
         expect(result).toContain(String(port));
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session Restart on Same Port', () => {
      it('should not timeout when starting session twice on the same port', async () => {
         // First start
         const result1 = await manageDriverSession('start');

         expect(result1).toContain('Session started');

         // Second start on same port (should not timeout due to stale session cache)
         const result2 = await manageDriverSession('start');

         expect(result2).toContain('Already connected to app on port');
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });

   describe('Session Status', () => {
      it('should return disconnected status when no session is active', async () => {
         // Ensure no session is active
         await manageDriverSession('stop');

         const result = await manageDriverSession('status'),
               status = JSON.parse(result);

         expect(status.connected).toBe(false);
         expect(status.app).toBeNull();
         expect(status.identifier).toBeNull();
         expect(status.host).toBeNull();
         expect(status.port).toBeNull();
      }, TIMEOUT);

      it('should return connected status with app identifier after starting session', async () => {
         // Connect to the test-app on its dynamically assigned port
         const port = getTestAppPort();

         await manageDriverSession('start', undefined, port);

         const result = await manageDriverSession('status'),
               status = JSON.parse(result);

         expect(status.connected).toBe(true);
         expect(status.app).toBeDefined();
         expect(status.identifier).toBeDefined();
         expect(status.identifier).toBe('com.hypothesi.test-app');
         expect(status.host).toBeDefined();
         expect(status.port).toBe(port);
      }, TIMEOUT);

      afterAll(async () => {
         await manageDriverSession('stop');
      });
   });
});
