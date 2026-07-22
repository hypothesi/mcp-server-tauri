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

By default, the plugin binds to `0.0.0.0` (all interfaces) to support remote device development. For localhost-only access:

```rust
use tauri_plugin_mcp_bridge::Builder;

fn main() {
    tauri::Builder::default()
        .plugin(Builder::new().bind_address("127.0.0.1").build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
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

This plugin is part of the larger MCP Server for Tauri, which provides **22 total MCP tools** for comprehensive Tauri development and testing. The plugin specifically enables the following tools:

### Mobile Development Tools (1)

1. **list_devices** - List connected Android devices and iOS simulators

### UI Automation & WebView Tools (16)

Tools for UI automation and webview interaction via the plugin's WebSocket connection:

1. **driver_session** - Manage automation session (start, stop, or status)
2. **manage_window** - List windows, get window info, or resize windows
3. **webview_find_element** - Find elements by CSS selector, XPath, text, or ref ID
4. **read_logs** - Read logs (console, Android logcat, iOS, system)
5. **webview_interact** - Perform gestures (click, double-click, long-press, swipe, scroll, focus)
6. **webview_screenshot** - Take screenshots (JPEG default, with optional resizing)
7. **native_dialog_snapshot** - Inspect same-process native Windows dialog ownership chains and navigation controls through UI Automation
8. **native_dialog_interact** - Invoke, set single/multiple paths, or select native Windows dialog controls
9. **webview_keyboard** - Type text or simulate keyboard events with optional modifiers
10. **webview_wait_for** - Wait for element selectors, text content, or IPC events
11. **webview_get_styles** - Get computed CSS styles for element(s)
12. **webview_execute_js** - Execute arbitrary JavaScript code in the webview context
13. **webview_dom_snapshot** - Get structured DOM snapshot (accessibility or structure type)
14. **webview_select_element** - Visual element picker — user clicks an element, returns metadata + screenshot
15. **webview_get_pointed_element** - Retrieve metadata for element user Alt+Shift+Clicked
16. **get_setup_instructions** - Get setup/update instructions for the MCP Bridge plugin

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

By default, the WebSocket server binds to `0.0.0.0` (all network interfaces), enabling connections from:

- **iOS devices** on the same network
- **Android devices** on the same network or via `adb reverse`
- **Emulators/Simulators** via localhost

#### Connecting from MCP Server

The MCP server supports connecting to remote Tauri apps via the `driver_session` tool:

```typescript
// Connect to a Tauri app on a remote device
driver_session({ action: 'start', host: '192.168.1.100' })

// Or use environment variables:
// MCP_BRIDGE_HOST=192.168.1.100 npx mcp-server-tauri
// TAURI_DEV_HOST=192.168.1.100 npx mcp-server-tauri (same as Tauri CLI uses)
```

#### Connection Strategy

The MCP server uses a fallback strategy:
1. Try `localhost:{port}` first (most reliable for simulators/emulators/desktop)
2. If localhost fails and a remote host is configured, try `{host}:{port}`
3. Auto-discover apps on localhost if specific connection fails

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

Add the plugin's default permission to your Tauri capabilities file (`src-tauri/capabilities/default.json`):

```json
{
  "permissions": [
    "mcp-bridge:default"
  ]
}
```

This grants all permissions required by the MCP server. The plugin is designed to work as a complete unit—partial permissions are not recommended as the MCP server expects all commands to be available.

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
