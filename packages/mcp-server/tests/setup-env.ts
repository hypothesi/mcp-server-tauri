/**
 * Vitest setup: keep token resolution hermetic.
 *
 * `getBridgeToken()` falls back to the plugin-written token file for loopback
 * targets. A developer who has a Tauri app running would otherwise leak that
 * real token into tests that assert "no token configured". Point the file
 * lookup at a path that does not exist unless the operator overrode it.
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';

if (!process.env.MCP_BRIDGE_TOKEN_FILE) {
   process.env.MCP_BRIDGE_TOKEN_FILE = join(tmpdir(), `hypothesi-mcp-bridge-vitest-${process.pid}.missing`);
}
