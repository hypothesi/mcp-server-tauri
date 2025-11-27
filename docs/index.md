---
layout: home
title: MCP Server Tauri - AI-Powered Tauri Development Tools
titleTemplate: false
description: An MCP server that provides AI assistants with tools to interact with Tauri applications for development, testing, and debugging.
head:
  - - meta
    - name: keywords
      content: tauri mcp server, ai development tools, tauri testing, rust desktop app, model context protocol

hero:
  name: MCP Server
  text: for Tauri
  tagline: An MCP server that provides AI assistants with tools to interact with Tauri applications during development.
  actions:
    - theme: brand
      text: Get Started
      link: /guides/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/hypothesi/mcp-server-tauri
---

<script setup>
import { MousePointer, Target, Zap, Smartphone, Wrench, BookOpen } from 'lucide-vue-next';
import { withBase } from 'vitepress';
</script>

<div class="features-section">
  <div class="features-grid">
    <Feature icon="camera" title="Visual Context" details="Capture and analyze screenshots to understand UI state and help with visual debugging" />
    <Feature icon="bug" title="Live Debugging" details="Access console logs, window state, and system logs in real-time" />
    <Feature icon="terminal" title="Tauri CLI Commands" details="Execute Tauri CLI commands like build, dev, and init through the AI assistant" />
    <Feature icon="smartphone" title="Device Management" details="List and launch Android emulators and iOS simulators for mobile testing" />
    <Feature icon="mouse-pointer" title="Native UI Automation" details="Automate UI testing through native Tauri IPC for element interaction and verification" />
    <Feature icon="plug" title="Plugin Bridge" details="Execute IPC commands and interact with the Tauri plugin system" />
  </div>
</div>

::: tip Community Project
This is an unofficial community project, independently developed to enhance Tauri development through AI assistance.
:::

## What Is This?

**MCP Server for Tauri** bridges AI assistants with your Tauri development environment via the Model Context Protocol. Control your entire dev workflow through natural language - run commands, edit configs, test UI, and debug issues.

## Quick Start

### 1. Prerequisites

- Node.js 20+ and npm
- Rust and Cargo
- Tauri CLI: `npm install -g @tauri-apps/cli@next`

### 2. Add the MCP Bridge Plugin to Your Tauri App

Add to `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-mcp-bridge = "0.1"
```

Register in `src-tauri/src/main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_mcp_bridge::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

::: warning Required Configuration
You **must** enable `withGlobalTauri` in your `tauri.conf.json`:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

This exposes `window.__TAURI__` which the MCP bridge plugin requires to communicate with your app.
:::

### 3. Configure Your AI Assistant

Add the MCP server to your assistant's configuration:

<details>
  <summary>Claude Code</summary>

Use the Claude Code CLI to add the Tauri MCP server:

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
  <summary>Cursor</summary>

**Click the button to install:**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=tauri&config=eyJjb21tYW5kIjoibnB4IC15IEBoeXBvdGhlc2kvdGF1cmktbWNwLXNlcnZlciJ9)

**Or install manually:**

Go to `Cursor Settings` → `MCP` → `New MCP Server`:

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
  <summary>VS Code / Copilot</summary>

**Click the button to add the MCP server in VS Code:**

[<img src="https://img.shields.io/badge/VS_Code-Add_MCP_Server-007ACC?logo=visualstudiocode&logoColor=white" alt="Add Tauri MCP server in VS Code">](vscode://ms-vscode.mcp/installServer?%7B%22name%22%3A%22tauri%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40hypothesi%2Ftauri-mcp-server%22%5D%7D)

**Or install using the VS Code CLI:**

```bash
code --add-mcp '{"name":"tauri","command":"npx","args":["-y","@hypothesi/tauri-mcp-server"]}'
```

**Or manually add to your workspace or user `settings.json`:**

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
  <summary>Windsurf</summary>

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
  <summary>Cline</summary>

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

## Architecture

The MCP server communicates with your Tauri application through:

- **Plugin Client (WebSocket port 9223)** - Native IPC for UI automation, DOM interaction, and direct commands via mcp-bridge plugin

## 23 Powerful Tools

The server exposes tools across 4 categories:

<div class="tool-categories">
   <div class="tool-category">
      <Target :size="20" :stroke-width="2" class="category-icon" />
      <strong>UI Automation & WebView</strong> (11 tools) - Gestures, screenshots, JS execution, element finding
   </div>
   <div class="tool-category">
      <Zap :size="20" :stroke-width="2" class="category-icon" />
      <strong>IPC & Plugins</strong> (6 tools) - IPC commands, monitoring, events
   </div>
   <div class="tool-category">
      <Smartphone :size="20" :stroke-width="2" class="category-icon" />
      <strong>Mobile Development</strong> (2 tools) - Device listing, emulator launch
   </div>
   <div class="tool-category">
      <Wrench :size="20" :stroke-width="2" class="category-icon" />
      <strong>Project Management</strong> (4 tools) - CLI commands, config management
   </div>
</div>

<div class="view-api-link">
  <BookOpen :size="20" :stroke-width="2" class="inline-icon" />
  <a :href="withBase('/api/')">View Full API Reference →</a>
</div>
