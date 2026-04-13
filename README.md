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

A **Model Context Protocol (MCP) server** that enables AI assistants like Claude, Cursor, and Windsurf to build, test, and debug [Tauri®](https://tauri.app) v2 applications. Screenshots, DOM state, and console logs from your running app give the AI rich context to understand what's happening—and tools to interact with it.

## ✨ Features

| Category | Capabilities |
|----------|-------------|
| 🎯 **UI Automation** | Screenshots, clicks, typing, scrolling, element finding, visual element picker |
| 🔍 **IPC Monitoring** | Capture and inspect Tauri IPC calls in real-time |
| 📱 **Mobile Dev** | List iOS simulators & Android emulators |
| 📋 **Logs** | Stream console, Android logcat, iOS, and system logs |

---

> _Disclaimer: This MCP was developed using agentic coding tools. It may contain bugs._

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and npm
- **Rust** and Cargo (for [Tauri](https://tauri.app) development)
- **Tauri CLI**: `npm install -g @tauri-apps/cli@next`
- For mobile: Xcode (macOS) or Android SDK

### 1. Configure Your AI Assistant

Use [install-mcp](https://www.npmjs.com/package/install-mcp) to add the server to your AI assistant:

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code
```

Supported clients: `claude-code`, `cursor`, `windsurf`, `vscode`, `cline`, `roo-cline`, `claude`, `zed`, `goose`, `warp`, `codex`

<details>
<summary><strong>Claude Code</strong></summary>

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client cursor
```

</details>

<details>
<summary><strong>VS Code / Copilot</strong></summary>

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client vscode
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client windsurf
```

</details>

<details>
<summary><strong>Cline</strong></summary>

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client cline
```

</details>

**Restart your AI assistant** after adding the configuration.

### CLI Usage

If you want to call the tools directly from a terminal instead of from an MCP client:

```bash
npm install -g @hypothesi/tauri-mcp-cli
tauri-mcp driver-session start --port 9223
tauri-mcp webview-screenshot --file screenshot.png
```

The CLI uses MCPorter keep-alive support so `driver_session` state survives across separate commands.

### 2. Set Up the MCP Bridge Plugin

Ask your AI assistant to help configure your Tauri app:

> "Help me set up the Tauri MCP Bridge plugin"

Your AI will:

1. **Examine your project** to see what's already configured
2. **Show you what changes are needed** (Cargo.toml, plugin registration, etc.)
3. **Ask for your permission** before making any modifications

That's it! The AI handles all the setup details while keeping you in control. 🎉

<details>
<summary><strong>Manual Setup</strong></summary>

If you prefer to set up manually, see the [Getting Started guide](https://hypothesi.github.io/mcp-server-tauri/guides/getting-started.html) or the [plugin documentation](./packages/tauri-plugin-mcp-bridge/README.md).

</details>

---

## 💬 Slash Commands (Prompts)

| Command | Description |
|---------|-------------|
| `/setup` | Set up or update the MCP bridge plugin in your Tauri project |
| `/fix-webview-errors` | Find and fix JavaScript errors in your webview |
| `/select` | Visually select an element in your app — returns metadata and screenshot |

Just type the command in your AI assistant to start a guided workflow.

---

## 🧰 Available Tools (21 total)

<details>
<summary><strong>Setup & Configuration</strong></summary>

| Tool | Description |
|------|-------------|
| `get_setup_instructions` | Get setup/update instructions for the MCP Bridge plugin |

</details>

<details>
<summary><strong>UI Automation</strong> — Screenshots, clicks, typing, and more</summary>

| Tool | Description |
|------|-------------|
| `driver_session` | Start/stop/status automation session |
| `webview_find_element` | Find elements by selector |
| `read_logs` | Read console, Android, iOS, or system logs |
| `webview_interact` | Click, scroll, swipe, focus, long-press |
| `webview_screenshot` | Capture webview screenshots |
| `webview_keyboard` | Type text or send key events |
| `webview_wait_for` | Wait for elements, text, or events |
| `webview_get_styles` | Get computed CSS styles |
| `webview_execute_js` | Execute JavaScript in webview |
| `webview_dom_snapshot` | Get structured accessibility tree snapshot |
| `webview_select_element` | Visual element picker — user clicks an element, returns metadata + screenshot |
| `webview_get_pointed_element` | Get metadata for element user Alt+Shift+Clicked |
| `manage_window` | List windows, get info, or resize |

> **Multi-Window Support**: All webview tools accept an optional `windowId` parameter to target specific windows. Use `manage_window` with `action: "list"` to discover available windows.

</details>

<details>
<summary><strong>IPC & Plugin</strong> — Deep Tauri integration</summary>

| Tool | Description |
|------|-------------|
| `ipc_execute_command` | Execute Tauri IPC commands |
| `ipc_get_backend_state` | Get app metadata and state |
| `ipc_monitor` | Start/stop IPC monitoring |
| `ipc_get_captured` | Get captured IPC traffic |
| `ipc_emit_event` | Emit custom events |

</details>

<details>
<summary><strong>Mobile Development</strong> — Device listing</summary>

| Tool | Description |
|------|-------------|
| `list_devices` | List Android devices and iOS simulators |

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
- ✅ **Cross-platform** — Works on Linux, Windows, macOS, Android, and iOS
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

## Other Notes

This project is tested with BrowserStack.

## 📄 License

MIT © [hypothesi](https://github.com/hypothesi)

---

## Trademark Notice

TAURI® is a registered trademark of The Tauri Programme within the Commons Conservancy. [https://tauri.app/](https://tauri.app/)

This project is not affiliated with, endorsed by, or sponsored by The Tauri Programme within the Commons Conservancy.
