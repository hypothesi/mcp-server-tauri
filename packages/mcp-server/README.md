# @hypothesi/tauri-mcp-server

[![npm version](https://img.shields.io/npm/v/@hypothesi/tauri-mcp-server)](https://www.npmjs.com/package/@hypothesi/tauri-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6.svg)](https://github.com/hypothesi/mcp-server-tauri/blob/main/LICENSE)

A **Model Context Protocol (MCP) server** that enables AI assistants like Claude, Cursor, and Windsurf to build, test, and debug Tauri v2 applications.

📖 **[Full Documentation](https://hypothesi.github.io/mcp-server-tauri)**

## Features

| Category | Capabilities |
|----------|-------------|
| 🎯 **UI Automation** | Screenshots, clicks, typing, scrolling, element finding |
| 🔍 **IPC Monitoring** | Capture and inspect Tauri IPC calls in real-time |
| 📱 **Mobile Dev** | Manage Android emulators & iOS simulators |
| 🛠️ **CLI Integration** | Run any Tauri command (`init`, `dev`, `build`, etc.) |
| ⚙️ **Configuration** | Read/write Tauri config files with validation |
| 📋 **Logs** | Stream Android logcat, iOS device logs, system logs |

## Quick Start

### 1. Add the MCP Bridge Plugin to Your Tauri App

```toml
# Cargo.toml
[dependencies]
tauri-plugin-mcp-bridge = "0.1"
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

**Claude Code:**

```bash
claude mcp add tauri npx @hypothesi/tauri-mcp-server
```

**Cursor / VS Code / Windsurf / Cline:**

```json
{
  "mcpServers": {
    "tauri": {
      "command": "npx",
      "args": ["-y", "@hypothesi/tauri-mcp-server"]
    }
  }
}
```

## Available Tools

### UI Automation

| Tool | Description |
|------|-------------|
| `tauri_webview_screenshot` | Capture webview screenshots |
| `tauri_driver_session` | Start/stop automation session |
| `tauri_webview_find_element` | Find elements by selector |
| `tauri_webview_interact` | Click, scroll, swipe, long-press |
| `tauri_webview_keyboard` | Type text or send key events |
| `tauri_webview_wait_for` | Wait for elements, text, or events |
| `tauri_webview_get_styles` | Get computed CSS styles |
| `tauri_webview_execute_js` | Execute JavaScript in webview |
| `tauri_webview_focus_element` | Focus on elements |
| `tauri_driver_get_console_logs` | Get browser console logs |
| `tauri_read_platform_logs` | Read Android/iOS/system logs |

### IPC & Plugin

| Tool | Description |
|------|-------------|
| `tauri_plugin_execute_ipc` | Execute Tauri IPC commands |
| `tauri_plugin_get_window_info` | Get window information |
| `tauri_plugin_get_backend_state` | Get app metadata and state |
| `tauri_plugin_ipc_monitor` | Start/stop IPC monitoring |
| `tauri_plugin_ipc_get_events` | Get captured IPC events |
| `tauri_plugin_emit_event` | Emit custom events |

### Mobile Development

| Tool | Description |
|------|-------------|
| `tauri_list_devices` | List Android devices and iOS simulators |
| `tauri_launch_emulator` | Launch Android AVD or iOS Simulator |

### Project Management

| Tool | Description |
|------|-------------|
| `tauri_run_command` | Run any Tauri CLI command |
| `tauri_read_config` | Read Tauri config files |
| `tauri_write_config` | Write config files with validation |
| `tauri_get_docs` | Fetch Tauri documentation |

## Links

- [Documentation](https://hypothesi.github.io/mcp-server-tauri)
- [GitHub Repository](https://github.com/hypothesi/mcp-server-tauri)
- [MCP Bridge Plugin (crates.io)](https://crates.io/crates/tauri-plugin-mcp-bridge)
- [Changelog](https://github.com/hypothesi/mcp-server-tauri/blob/main/packages/mcp-server/CHANGELOG.md)

## License

MIT © [hypothesi](https://github.com/hypothesi)
