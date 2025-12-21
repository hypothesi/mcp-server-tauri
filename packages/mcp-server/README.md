# @hypothesi/tauri-mcp-server

[![npm version](https://img.shields.io/npm/v/@hypothesi/tauri-mcp-server)](https://www.npmjs.com/package/@hypothesi/tauri-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6.svg)](https://github.com/hypothesi/mcp-server-tauri/blob/main/LICENSE)

A **Model Context Protocol (MCP) server** that enables AI assistants like Claude, Cursor, and Windsurf to build, test, and debug Tauri® v2 applications.

📖 **[Full Documentation](https://hypothesi.github.io/mcp-server-tauri)**

## Features

| Category | Capabilities |
|----------|-------------|
| 🎯 **UI Automation** | Screenshots, clicks, typing, scrolling, element finding |
| 🔍 **IPC Monitoring** | Capture and inspect Tauri IPC calls in real-time |
| 📱 **Mobile Dev** | List Android emulators & iOS simulators |
| 📋 **Logs** | Stream console, Android logcat, iOS, and system logs |

## Quick Start

### 1. Add the MCP Bridge Plugin to Your Tauri App

```bash
cargo add tauri-plugin-mcp-bridge
```

```rust
// src-tauri/src/main.rs
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

> **Note:** The npm package `@hypothesi/tauri-plugin-mcp-bridge` is **optional**—only needed if you want to call the plugin from your app's frontend code. The MCP server communicates with the Rust plugin directly via WebSocket.

### 2. Configure Your AI Assistant

Use [install-mcp](https://www.npmjs.com/package/install-mcp) to add the server to your AI assistant:

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code
```

Supported clients: `claude-code`, `cursor`, `windsurf`, `vscode`, `cline`, `roo-cline`, `claude`, `zed`, `goose`, `warp`, `codex`

## Available Tools (16 total)

### UI Automation

| Tool | Description |
|------|-------------|
| `tauri_driver_session` | Start/stop/status automation session |
| `tauri_webview_find_element` | Find elements by selector |
| `tauri_read_logs` | Read console, Android, iOS, or system logs |
| `tauri_webview_interact` | Click, scroll, swipe, focus, long-press |
| `tauri_webview_screenshot` | Capture webview screenshots |
| `tauri_webview_keyboard` | Type text or send key events |
| `tauri_webview_wait_for` | Wait for elements, text, or events |
| `tauri_webview_get_styles` | Get computed CSS styles |
| `tauri_webview_execute_js` | Execute JavaScript in webview |
| `tauri_manage_window` | List windows, get info, or resize |

### IPC & Plugin

| Tool | Description |
|------|-------------|
| `tauri_ipc_execute_command` | Execute Tauri IPC commands |
| `tauri_ipc_get_backend_state` | Get app metadata and state |
| `tauri_ipc_monitor` | Start/stop IPC monitoring |
| `tauri_ipc_get_captured` | Get captured IPC traffic |
| `tauri_ipc_emit_event` | Emit custom events |

### Mobile Development

| Tool | Description |
|------|-------------|
| `tauri_list_devices` | List Android devices and iOS simulators |

## Links

- [Documentation](https://hypothesi.github.io/mcp-server-tauri)
- [GitHub Repository](https://github.com/hypothesi/mcp-server-tauri)
- [MCP Bridge Plugin (crates.io)](https://crates.io/crates/tauri-plugin-mcp-bridge)
- [Changelog](https://github.com/hypothesi/mcp-server-tauri/blob/main/packages/mcp-server/CHANGELOG.md)

## License

MIT © [hypothesi](https://github.com/hypothesi)

---

## Trademark Notice

TAURI® is a registered trademark of The Tauri Programme within the Commons Conservancy. [https://tauri.app/](https://tauri.app/)

This project is not affiliated with, endorsed by, or sponsored by The Tauri Programme within the Commons Conservancy.
