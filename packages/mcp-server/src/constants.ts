import { PLUGIN_VERSION_CARGO } from './version.js';

// Prose destined for an agent: wrapping these lines would change the rendered
// markdown, so line length is not meaningful here.
/* eslint-disable @stylistic/max-len */
export const SETUP_INSTRUCTIONS = `Help me set up or update the MCP Bridge plugin in my Tauri project.

## IMPORTANT: Do Not Act Without Permission

**You must NOT make any changes to files without my explicit approval.**

1. First, examine my project to understand its current state
2. Then, present a clear summary of what changes are needed
3. Wait for my approval before making ANY modifications
4. Only proceed with changes after I confirm

## Prerequisites Check

First, verify this is a Tauri v2 project:
- Look for \`src-tauri/\` directory and \`tauri.conf.json\`
- If this is NOT a Tauri project, stop and let me know this setup only applies to Tauri apps

## What to Check

Examine these files and report what needs to be added or updated:

### 1. Rust Plugin Dependency
Check \`src-tauri/Cargo.toml\` for \`tauri-plugin-mcp-bridge\`. If missing or outdated, note that it needs:
\`\`\`toml
[dependencies]
tauri-plugin-mcp-bridge = "${PLUGIN_VERSION_CARGO}"
\`\`\`

### 2. Plugin Registration
Check \`src-tauri/src/lib.rs\` or \`src-tauri/src/main.rs\` for plugin registration. It should have:
\`\`\`rust
#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}
\`\`\`

### 3. Global Tauri Setting
Check \`src-tauri/tauri.conf.json\` for \`withGlobalTauri: true\` under the \`app\` section.
**This is required** - without it, the MCP bridge cannot communicate with the webview.

### 4. Plugin Permissions
Check \`src-tauri/capabilities/default.json\` (or similar) for \`"mcp-bridge:automation"\` permission.
\`mcp-bridge:default\` is inspect-only (window info, backend state, script_result) and is **not** enough for MCP automation (\`execute_js\`, screenshots, script injection, IPC monitor).

## Your Response Format

After examining the project, respond with:

1. **Current State**: What's already configured correctly
2. **Changes Needed**: A numbered list of specific changes required
3. **Ask for Permission**: "May I proceed with these changes?"

Only after I say yes should you make any modifications.

## After Setup

Once changes are approved and made:
1. Run the Tauri app in development mode (\`cargo tauri dev\`)
2. Use \`driver_session\` with action "start" to connect
3. Use \`driver_session\` with action "status" to verify

## Notes

- By default the plugin WebSocket listener starts only in debug builds. In release, \`init()\` still registers commands and injects the bridge script, but does not bind the operator WebSocket unless you pass \`Builder::new().allow_release(true)\`
- The WebSocket server binds to \`127.0.0.1:9223\` by default and requires \`X-MCP-Bridge-Token\` (\`MCP_BRIDGE_TOKEN\`)
- Generated tokens are logged once and written to the process temp dir as \`hypothesi-mcp-bridge.token\`. For loopback targets the MCP server reads that file automatically when \`MCP_BRIDGE_TOKEN\` is unset (override the path with \`MCP_BRIDGE_TOKEN_FILE\`)
- For LAN device testing, use \`Builder::new().bind_address("0.0.0.0").allow_insecure_cleartext(true).build()\` (or \`MCP_BRIDGE_BIND\` + \`MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT=1\`)`;
/* eslint-enable @stylistic/max-len */
