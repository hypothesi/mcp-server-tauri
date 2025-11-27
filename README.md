<div align="center">

<img src="docs/public/logo.svg" alt="MCP Server Tauri" width="120" height="120" />

# MCP Server Tauri

**Give your AI assistant superpowers for Tauri development**

[![npm version](https://img.shields.io/npm/v/@hypothesi/tauri-mcp-server?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@hypothesi/tauri-mcp-server)
[![crates.io](https://img.shields.io/crates/v/tauri-plugin-mcp-bridge?style=flat-square&color=e6522c)](https://crates.io/crates/tauri-plugin-mcp-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6.svg?style=flat-square)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app)

[Documentation](https://hypothesi.github.io/mcp-server-tauri) · [Getting Started](#quick-start) · [Available Tools](#available-tools)

</div>

---

A **Model Context Protocol (MCP) server** that enables AI assistants like Claude, Cursor, and Windsurf to build, test, and debug Tauri v2 applications. Screenshots, DOM state, and console logs from your running app give the AI rich context to understand what's happening—and tools to interact with it.

## ✨ Features

| Category | Capabilities |
|----------|-------------|
| 🎯 **UI Automation** | Screenshots, clicks, typing, scrolling—all via WebSocket |
| 🔍 **IPC Monitoring** | Capture and inspect Tauri IPC calls in real-time |
| 📱 **Mobile Dev** | Manage Android emulators & iOS simulators |
| 🛠️ **CLI Integration** | Run any Tauri command (`init`, `dev`, `build`, etc.) |
| ⚙️ **Configuration** | Read/write Tauri config files with validation |
| 📋 **Logs** | Stream Android logcat, iOS device logs, system logs |

---

> _Disclaimer: This MCP was developed using agentic coding tools. It may contain bugs._

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and npm
- **Rust** and Cargo (for Tauri development)
- **Tauri CLI**: `npm install -g @tauri-apps/cli@next`
- For mobile: Android SDK or Xcode (macOS)

### 1. Add the MCP Bridge Plugin to Your Tauri App

**Add to `Cargo.toml`:**

```toml
[dependencies]
tauri-plugin-mcp-bridge = "0.1"
```

**Register in `src-tauri/src/main.rs`:**

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_mcp_bridge::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2. Configure Your AI Assistant

<details>
<summary><strong>Claude Code</strong></summary>

Use the Claude Code CLI:

```bash
claude mcp add tauri npx @hypothesi/tauri-mcp-server
```

Or manually add to your config (Cmd/Ctrl+Shift+P → "MCP: Edit Config"):

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

</details>

<details>
<summary><strong>Cursor</strong></summary>

**Click to install:**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor" height="32">](https://cursor.com/en/install-mcp?name=tauri&config=eyJjb21tYW5kIjoibnB4IC15IEBoeXBvdGhlc2kvdGF1cmktbWNwLXNlcnZlciJ9)

**Or manually:** Go to `Cursor Settings` → `MCP` → `New MCP Server`:

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

</details>

<details>
<summary><strong>VS Code / Copilot</strong></summary>

**Click to install:**

[<img src="https://img.shields.io/badge/VS_Code-Add_MCP_Server-007ACC?logo=visualstudiocode&logoColor=white" alt="Add Tauri MCP server in VS Code" height="32">](vscode://ms-vscode.mcp/installServer?%7B%22name%22%3A%22tauri%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40hypothesi%2Ftauri-mcp-server%22%5D%7D)

**Or via CLI:**

```bash
code --add-mcp '{"name":"tauri","command":"npx","args":["-y","@hypothesi/tauri-mcp-server"]}'
```

**Or manually add to `settings.json`:**

```json
{
  "mcp.servers": {
    "tauri": {
      "command": "npx",
      "args": ["-y", "@hypothesi/tauri-mcp-server"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Go to `Settings` → `AI` → `MCP Servers`:

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

</details>

<details>
<summary><strong>Cline</strong></summary>

Follow the [Cline MCP configuration guide](https://docs.cline.bot/mcp/configuring-mcp-servers) and use:

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

</details>

That's it! Restart your AI assistant and you're ready to build Tauri apps. 🎉

> **Note:** See the [plugin documentation](./packages/tauri-plugin-mcp-bridge/README.md) for advanced configuration options.

---

## 🧰 Available Tools

<details>
<summary><strong>UI Automation</strong> — Screenshots, clicks, typing, and more</summary>

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

</details>

<details>
<summary><strong>IPC & Plugin</strong> — Deep Tauri integration</summary>

| Tool | Description |
|------|-------------|
| `tauri_plugin_execute_ipc` | Execute Tauri IPC commands |
| `tauri_plugin_get_window_info` | Get window information |
| `tauri_plugin_get_backend_state` | Get app metadata and state |
| `tauri_plugin_ipc_monitor` | Start/stop IPC monitoring |
| `tauri_plugin_ipc_get_events` | Get captured IPC events |
| `tauri_plugin_emit_event` | Emit custom events |

</details>

<details>
<summary><strong>Mobile Development</strong> — Emulators and simulators</summary>

| Tool | Description |
|------|-------------|
| `tauri_list_devices` | List Android devices and iOS simulators |
| `tauri_launch_emulator` | Launch Android AVD or iOS Simulator |

</details>

<details>
<summary><strong>Project Management</strong> — CLI, config, and docs</summary>

| Tool | Description |
|------|-------------|
| `tauri_run_command` | Run any Tauri CLI command |
| `tauri_read_config` | Read Tauri config files (including platform-specific) |
| `tauri_write_config` | Write config files with validation |
| `tauri_get_docs` | Fetch Tauri documentation |

</details>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistant                             │
│                  (Claude, Cursor, Windsurf)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ MCP Protocol (stdio)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server (Node.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Manager    │  │    Driver    │  │      Monitor         │   │
│  │  CLI/Config  │  │ UI Automation│  │   Logs/IPC Events    │   │
│  └──────────────┘  └──────┬───────┘  └──────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ WebSocket (port 9223)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tauri Application                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MCP Bridge Plugin (Rust)                    │   │
│  │         IPC Commands • Events • Backend State            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Webview (DOM/UI)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Why this approach?**

- ✅ **Rich AI context** — Screenshots, DOM, and logs help the AI understand your app's state
- ✅ **Cross-platform** — Works on Linux, Windows, and macOS
- ✅ **No external drivers** — No Selenium, Playwright, or browser automation needed
- ✅ **Native integration** — Direct access to Tauri's IPC and backend

---

## 🧑‍💻 Development

```bash
# Clone and install
git clone https://github.com/hypothesi/mcp-server-tauri.git
cd mcp-server-tauri
npm install

# Build all packages
npm run build

# Run tests
npm test

# Development mode
npm run dev -w @hypothesi/tauri-mcp-server
```

<details>
<summary><strong>Project Structure</strong></summary>

```
mcp-server-tauri/
├── packages/
│   ├── mcp-server/              # MCP server (TypeScript)
│   ├── tauri-plugin-mcp-bridge/ # Tauri plugin (Rust + JS bindings)
│   └── test-app/                # Test Tauri application
├── docs/                        # VitePress documentation
└── specs/                       # Architecture specs
```

</details>

<details>
<summary><strong>Releasing</strong></summary>

```bash
# Release plugin (Cargo + npm)
npm run release:plugin patch

# Release server (npm only)
npm run release:server patch
```

See [specs/releasing.md](./specs/releasing.md) for details.

</details>

---

## 📚 Documentation

- **[Full Documentation](https://hypothesi.github.io/mcp-server-tauri)** — Guides, API reference, and examples
- **[MCP Server Package](./packages/mcp-server/)** — Server implementation details
- **[MCP Bridge Plugin](./packages/tauri-plugin-mcp-bridge/)** — Tauri plugin documentation

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure `npm test` and `npm run standards` pass

---

## 📄 License

MIT © [hypothesi](https://github.com/hypothesi)
