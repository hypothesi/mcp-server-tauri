# Tauri MCP Bridge Plugin

[![Crates.io](https://img.shields.io/crates/v/tauri-plugin-mcp-bridge.svg)](https://crates.io/crates/tauri-plugin-mcp-bridge)
[![npm](https://img.shields.io/npm/v/@hypothesi/tauri-plugin-mcp-bridge.svg)](https://www.npmjs.com/package/@hypothesi/tauri-plugin-mcp-bridge)
[![Documentation](https://docs.rs/tauri-plugin-mcp-bridge/badge.svg)](https://docs.rs/tauri-plugin-mcp-bridge)
[![License](https://img.shields.io/crates/l/tauri-plugin-mcp-bridge.svg)](https://github.com/hypothesi/mcp-server-tauri)

A Tauri® plugin that bridges the Model Context Protocol (MCP) with Tauri applications, enabling deep inspection and interaction with Tauri's IPC layer, backend state, and window management.

> **📦 This npm package is optional.** It provides TypeScript bindings for calling the plugin from your app's frontend code. If you're just using the [MCP Server for Tauri](https://github.com/hypothesi/mcp-server-tauri), you only need the **Rust crate** (`tauri-plugin-mcp-bridge`)—the MCP server communicates with it directly via WebSocket.

## Overview

The MCP Bridge plugin extends MCP servers with direct access to Tauri internals. It provides real-time IPC monitoring, window state inspection, backend state access, and event emission capabilities.

## Installation

```bash
cargo add tauri-plugin-mcp-bridge
```

Or add manually to your `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-mcp-bridge = "0.2"
```

### Optional: TypeScript Bindings

If you want to call the plugin from your app's frontend code (not required for MCP server functionality):

```bash
npm install --save-exact @hypothesi/tauri-plugin-mcp-bridge
```

## Usage

Register the plugin in your Tauri application:

```rust
fn main() {
    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Custom Configuration

By default the plugin binds to **`127.0.0.1`** (loopback) and requires the MCP client to send `X-MCP-Bridge-Token` on WebSocket upgrade. That token is the operator-plane credential: Tauri webview capability ACL is **not** applied to this socket (denying `allow-execute-js` on a window does not block MCP).

Token resolution:

1. `Builder::token(...)` if set
2. `MCP_BRIDGE_TOKEN` if set
3. Otherwise a 128-bit hex token is generated, logged once, and written to `{temp}/hypothesi-mcp-bridge.token` (for example `C:\Users\<you>\AppData\Local\Temp\hypothesi-mcp-bridge.token` on Windows, `$TMPDIR/hypothesi-mcp-bridge.token` on Unix)

The MCP server resolves the same value from `MCP_BRIDGE_TOKEN`, or, for loopback targets only, from that token file (path override: `MCP_BRIDGE_TOKEN_FILE`). A local dev setup therefore needs no token configuration at all; set `MCP_BRIDGE_TOKEN` on both sides when you pin the token or connect to a non-loopback host.

Non-loopback bind (`0.0.0.0`) is opt-in and **refused** unless you also set `allow_insecure_cleartext` (cleartext `ws://` on a LAN is otherwise silent exposure):

```rust
use tauri_plugin_mcp_bridge::Builder;

fn main() {
    tauri::Builder::default()
        .plugin(
            Builder::new()
                .bind_address("0.0.0.0")
                .allow_insecure_cleartext(true)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Equivalent environment variables (used when the builder does not set the value explicitly): `MCP_BRIDGE_BIND`, `MCP_BRIDGE_TOKEN`, `MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT=1`.

By default, `init()` and `Builder::build()` start the WebSocket listener only under `debug_assertions`. In a release binary the plugin still registers commands and injects the bridge script, but it does not bind the operator WebSocket unless you pass `Builder::allow_release(true)`:

```rust
Builder::new().allow_release(true).build()
```

## Features

### 1. IPC Monitoring

Monitor all Tauri IPC calls in real-time with timing and argument capture:

```typescript
// Start monitoring
await invoke('plugin:mcp-bridge|start_ipc_monitor');

// Execute some commands to generate IPC traffic
await invoke('greet', { name: 'World' });

// Get captured events
const events = await invoke('plugin:mcp-bridge|get_ipc_events');
```

### 2. Window Information

Get detailed window state:

```typescript
const windowInfo = await invoke('plugin:mcp-bridge|get_window_info');
// Returns: { width, height, x, y, title, focused, visible }
```

### 3. Backend State

Inspect application backend state:

```typescript
const state = await invoke('plugin:mcp-bridge|get_backend_state');
// Returns: { app: { name, identifier, version }, tauri: { version },
//            environment: { debug, os, arch, family }, windows: [...], timestamp }
```

### 4. Event Emission

Trigger custom events for testing:

```typescript
await invoke('plugin:mcp-bridge|emit_event', {
  eventName: 'custom-event',
  payload: { data: 'test' }
});
```

## MCP Server Integration

This plugin is part of the larger MCP Server for Tauri, which provides **20 total MCP tools** for comprehensive Tauri development and testing. The plugin specifically enables the following tools:

### Mobile Development Tools (1)

1. **list_devices** - List connected Android devices and iOS simulators

### UI Automation & WebView Tools (14)

Tools for UI automation and webview interaction via the plugin's WebSocket connection:

1. **driver_session** - Manage automation session (start, stop, or status)
2. **manage_window** - List windows, get window info, or resize windows
3. **webview_find_element** - Find elements by CSS selector, XPath, text, or ref ID
4. **read_logs** - Read logs (console, Android logcat, iOS, system)
5. **webview_interact** - Perform gestures (click, double-click, long-press, swipe, scroll, focus)
6. **webview_screenshot** - Take screenshots (JPEG default, with optional resizing)
7. **webview_keyboard** - Type text or simulate keyboard events with optional modifiers
8. **webview_wait_for** - Wait for element selectors, text content, or IPC events
9. **webview_get_styles** - Get computed CSS styles for element(s)
10. **webview_execute_js** - Execute arbitrary JavaScript code in the webview context
11. **webview_dom_snapshot** - Get structured DOM snapshot (accessibility or structure type)
12. **webview_select_element** - Visual element picker — user clicks an element, returns metadata + screenshot
13. **webview_get_pointed_element** - Retrieve metadata for element user Alt+Shift+Clicked
14. **get_setup_instructions** - Get setup/update instructions for the MCP Bridge plugin

### IPC Tools (5)

Tools that directly use the MCP Bridge plugin's Rust backend:

1. **ipc_execute_command** - Execute any Tauri IPC command
2. **ipc_monitor** - Manage IPC monitoring (start or stop)
3. **ipc_get_captured** - Retrieve captured IPC traffic with optional filtering
4. **ipc_emit_event** - Emit custom Tauri events for testing event handlers
5. **ipc_get_backend_state** - Get backend application state and metadata

## Architecture

```text
MCP Server (Node.js)
    │
    ├── Native IPC (via plugin) ────> Tauri App Webview (DOM/UI)
    │                                       │
    └── Plugin Client ──────────────────────┼──> Plugin Commands
         (WebSocket port 9223)              │
                                            │
                                      mcp-bridge Plugin
                                      (Rust Backend)
```

## WebSocket Communication

The plugin runs a WebSocket server on port 9223 (or next available in range 9223-9322) for real-time communication with the MCP server.

### Remote Device Development

Loopback is the default. To accept connections from a phone or another machine you must:

1. Bind off loopback: `Builder::bind_address("0.0.0.0")` or `MCP_BRIDGE_BIND=0.0.0.0`
2. Explicitly allow cleartext: `Builder::allow_insecure_cleartext(true)` or `MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT=1`
3. Share `MCP_BRIDGE_TOKEN` with the MCP client (`X-MCP-Bridge-Token` on upgrade — never a query string)

That enables connections from:

- **iOS devices** on the same network
- **Android devices** on the same network or via `adb reverse`
- **Emulators/Simulators** via localhost (loopback bind is enough; no LAN opt-in)

#### Connecting from MCP Server

The MCP server supports connecting to remote Tauri apps via the `driver_session` tool:

```typescript
// Connect to a Tauri app on a remote device
driver_session({ action: 'start', host: '192.168.1.100' })

// Or use environment variables:
// MCP_BRIDGE_HOST=192.168.1.100 MCP_BRIDGE_TOKEN=... npx mcp-server-tauri
// TAURI_DEV_HOST=192.168.1.100 npx mcp-server-tauri (same as Tauri CLI uses)
```

#### Connection Strategy

The MCP server connects to the specified or env host:port (loopback, `MCP_BRIDGE_HOST`, or an operator-specified host). It does **not** prefer localhost over a specified remote host. Auto-discovery on loopback requires `MCP_BRIDGE_TOKEN` and a successful handshake.

## Development

### Building the Plugin

From the plugin directory:

```bash
cd packages/tauri-plugin-mcp-bridge
cargo build
```

Or from the workspace root:

```bash
npm run build:plugin
```

### Documentation

View the comprehensive Rust API documentation:

```bash
npm run docs:rust
```

Or directly:

```bash
cd packages/tauri-plugin-mcp-bridge
cargo doc --open --no-deps
```

### Testing

Run the MCP server tests which include plugin integration tests:

```bash
npm test
```

## Permissions

Webview `invoke` is gated by Tauri capabilities, separately from the token-gated operator WebSocket.

`mcp-bridge:default` is **inspect-only**: window info, backend state, and `script_result`. It does **not** allow `execute_js`, screenshots, script injection, or starting the IPC monitor. XSS in a window that only has `default` cannot native-eval through plugin commands.

For the documented MCP automation path (including test-app e2e), grant `mcp-bridge:automation` — the former allow-all set:

```json
{
  "permissions": [
    "mcp-bridge:automation"
  ]
}
```

The MCP operator plane is still the token-gated WebSocket, not these capabilities: omitting `allow-execute-js` from a window does not stop `execute_js` over an authenticated plugin socket. Commands such as `script_result` and `request_script_injection` are invoked from the injected bridge script, so automation webviews need the matching ACL.

## API Documentation

For detailed API documentation, including:

- Complete function signatures and parameters
- Rust examples for backend integration
- TypeScript examples for frontend usage
- Architecture and design details

Visit the [docs.rs documentation](https://docs.rs/tauri-plugin-mcp-bridge) or build locally with `npm run docs:rust`.

## License

MIT © [hypothesi](https://github.com/hypothesi)

---

## Trademark Notice

TAURI® is a registered trademark of The Tauri Programme within the Commons Conservancy. [https://tauri.app/](https://tauri.app/)

This project is not affiliated with, endorsed by, or sponsored by The Tauri Programme within the Commons Conservancy.
