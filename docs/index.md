---
layout: home
title: MCP Server Tauri - AI-Powered Tauri Development Tools
titleTemplate: false
description: An MCP server that empowers AI assistants to build, test, and debug Tauri applications.
head:
  - - meta
    - name: keywords
      content: tauri mcp server, ai development tools, tauri testing, rust desktop app, model context protocol

hero:
  name: MCP Server
  text: for Tauri
  tagline: An MCP server that empowers AI assistants to build, test, and debug Tauri applications.
  actions:
    - theme: brand
      text: Get Started
      link: /guides/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/hypothesi/mcp-server-tauri
---

<script setup>
import { MousePointer, Target, Zap, Smartphone, Wrench, BookOpen, MessageSquareCode } from 'lucide-vue-next';
import { withBase } from 'vitepress';
import { data as versions } from './.vitepress/versions.data';
</script>

<div class="features-section">
  <div class="features-grid">
    <Feature icon="camera" title="Visual Context" details="Capture and analyze screenshots to understand UI state and help with visual debugging" />
    <Feature icon="bug" title="Live Debugging" details="Access console logs, window state, and system logs in real-time" />
    <Feature icon="activity" title="IPC Monitoring" details="Capture and inspect Tauri IPC calls between frontend and backend in real-time" />
    <Feature icon="smartphone" title="Device Management" details="List Android emulators and iOS simulators for mobile testing" />
    <Feature icon="mouse-pointer" title="WebView Automation" details="Click, type, scroll, find elements, pick elements visually, and verify UI state in your app's webview" />
    <Feature icon="plug" title="Plugin Bridge" details="Execute IPC commands and interact with the Tauri plugin system" />
  </div>
</div>

::: warning Community Project
This is an **unofficial** community project, independently developed to enhance [Tauri<sup>&reg;</sup>](https://tauri.app) development through AI assistance. **Please note that this project is not affiliated with, endorsed by, or sponsored by The Tauri Programme within the Commons Conservancy.**
:::

## What Is This?

**MCP Server for [Tauri<sup>&reg;</sup>](https://tauri.app)** bridges AI assistants with your Tauri development environment via the Model Context Protocol. Control your entire dev workflow through natural language - test UI, debug issues, monitor IPC calls, and inspect your app's state.

## Quick Start

### 1. Prerequisites

- Node.js 20+ and npm
- Rust and Cargo
- Tauri CLI: `npm install -g @tauri-apps/cli@next`

### 2. Add the MCP Bridge Plugin to Your Tauri App

Add the Rust crate (from your `src-tauri` directory):

```bash
cargo add tauri-plugin-mcp-bridge
```

Or manually add to `Cargo.toml`: <code>tauri-plugin-mcp-bridge = "{{ versions.plugin.cargo }}"</code>

Register in `src-tauri/src/main.rs`:

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

::: tip Optional: TypeScript Bindings
The npm package `@hypothesi/tauri-plugin-mcp-bridge` is **optional**. It provides TypeScript bindings if you want to call the plugin from your app's frontend code. The MCP server communicates with the Rust plugin directly via WebSocket—no npm package needed.
:::

### 3. Configure Your AI Assistant

Use [install-mcp](https://www.npmjs.com/package/install-mcp) to add the server to your AI assistant:

```bash
npx -y install-mcp @hypothesi/tauri-mcp-server --client claude-code
```

Supported clients: `claude-code`, `cursor`, `windsurf`, `vscode`, `cline`, `roo-cline`, `claude`, `zed`, `goose`, `warp`, `codex`

<details>
  <summary>Manual Configuration</summary>

If you prefer to configure manually, add to your MCP config:

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

**Config file locations:**
- **Claude Code:** Cmd/Ctrl+Shift+P → "MCP: Edit Config"
- **Cursor:** `Cursor Settings` → `MCP` → `New MCP Server`
- **VS Code:** Add to `settings.json` under `mcp.servers`
- **Windsurf:** Cascade pane → MCPs icon → settings icon
- **Cline:** See [Cline MCP configuration guide](https://docs.cline.bot/mcp/configuring-mcp-servers)

</details>

## Architecture

The MCP server communicates with your Tauri application through:

- **Plugin Client (WebSocket port 9223)** - Native IPC for UI automation, DOM interaction, and direct commands via mcp-bridge plugin

## Slash Commands (Prompts)

The server provides **slash commands** ([prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)) for guided workflows:

<div class="tool-categories">
   <div class="tool-category">
      <MessageSquareCode :size="20" :stroke-width="2" class="category-icon" />
      <strong>/setup</strong> - Set up the MCP bridge plugin in your Tauri project
   </div>
   <div class="tool-category">
      <MessageSquareCode :size="20" :stroke-width="2" class="category-icon" />
      <strong>/fix-webview-errors</strong> - Find and fix JavaScript errors in your webview
   </div>
   <div class="tool-category">
      <MessageSquareCode :size="20" :stroke-width="2" class="category-icon" />
      <strong>/select</strong> - Visually pick an element in your app to discuss with the AI
   </div>
</div>

[Learn more about prompts →](/api/prompts)

## 20 Powerful Tools

The server exposes tools across 4 categories:

<div class="tool-categories">
   <div class="tool-category">
      <Wrench :size="20" :stroke-width="2" class="category-icon" />
      <strong>Setup &amp; Configuration</strong> (1 tool) - Guided setup instructions
   </div>
   <div class="tool-category">
      <Target :size="20" :stroke-width="2" class="category-icon" />
      <strong>UI Automation & WebView</strong> (14 tools) - Gestures, screenshots, DOM snapshots, JS execution, element picking, logs
   </div>
   <div class="tool-category">
      <Zap :size="20" :stroke-width="2" class="category-icon" />
      <strong>IPC Tools</strong> (5 tools) - IPC commands, monitoring, events
   </div>
   <div class="tool-category">
      <Smartphone :size="20" :stroke-width="2" class="category-icon" />
      <strong>Mobile Development</strong> (1 tool) - Device listing
   </div>
</div>

<div class="view-api-link">
  <BookOpen :size="20" :stroke-width="2" class="inline-icon" />
  <a :href="withBase('/api/')">View Full API Reference →</a>
</div>
