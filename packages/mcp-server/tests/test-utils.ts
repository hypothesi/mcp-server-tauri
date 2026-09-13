/**
 * Test utilities for E2E tests.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const TEST_APP_PORT_FILE = path.resolve(process.cwd(), '.test-app-port');

/** Shared with global-setup so the plugin and MCP client use the same handshake token. */
export const E2E_MCP_BRIDGE_TOKEN = 'wp4-e2e-test-token';

if (!process.env.MCP_BRIDGE_TOKEN) {
   process.env.MCP_BRIDGE_TOKEN = E2E_MCP_BRIDGE_TOKEN;
}

/**
 * The token the test-app was actually launched with.
 *
 * An operator-supplied `MCP_BRIDGE_TOKEN` wins over {@link E2E_MCP_BRIDGE_TOKEN},
 * because global-setup passes the same value through to the app. Tests must use
 * this rather than the constant, or the handshake 401s whenever the developer
 * happens to have `MCP_BRIDGE_TOKEN` exported.
 */
export function getE2EBridgeToken(): string {
   return process.env.MCP_BRIDGE_TOKEN || E2E_MCP_BRIDGE_TOKEN;
}

let cachedPort: number | null = null;

/**
 * Gets the port that the test app is running on.
 * This is set by the global test setup after starting the Tauri app.
 *
 * @returns The port number the test app is listening on
 * @throws Error if the test app port is not available
 */
export function getTestAppPort(): number {
   // Return cached port if available
   if (cachedPort !== null) {
      return cachedPort;
   }

   // Read from file (written by global setup)
   if (existsSync(TEST_APP_PORT_FILE)) {
      const portStr = readFileSync(TEST_APP_PORT_FILE, 'utf-8').trim();

      cachedPort = parseInt(portStr, 10);

      if (!isNaN(cachedPort)) {
         return cachedPort;
      }
   }

   throw new Error(
      'Test app port not available. Make sure the global test setup has started the Tauri app.'
   );
}

/**
 * Checks if the test app has been started by the global setup.
 */
export function isTestAppStarted(): boolean {
   return existsSync(TEST_APP_PORT_FILE);
}
