---
title: Getting Started with MCP Server Tauri
description: Learn how to integrate MCP Server Tauri into your existing Tauri application for AI-powered development.
head:
  - - meta
    - name: keywords
      content: tauri setup, mcp server installation, ai assistant configuration, tauri integration
---

<script setup>
import { data as versions } from '../.vitepress/versions.data';

const SETUP_INSTRUCTIONS = `Help me set up the MCP Bridge plugin in my Tauri project so I can use these AI development tools.

## Prerequisites

- This is a **Tauri v2** project (check for \`src-tauri/\` directory and \`tauri.conf.json\`)
- If this is NOT a Tauri project, stop and let the user know this setup only applies to Tauri apps

## Setup Steps

### Step 1: Add the Rust Plugin

Add the plugin to \`src-tauri/Cargo.toml\` dependencies:

\`\`\`toml
[dependencies]
tauri-plugin-mcp-bridge = "0.2"
\`\`\`

Or run from the \`src-tauri\` directory:
\`\`\`bash
cargo add tauri-plugin-mcp-bridge
\`\`\`

### Step 2: Register the Plugin

In the Tauri app's entry point (usually \`src-tauri/src/lib.rs\` or \`src-tauri/src/main.rs\`), register the plugin.

Find the \`tauri::Builder\` and add the plugin (only in debug builds):

\`\`\`rust
let mut builder = tauri::Builder::default();
// ... existing plugins ...

#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}

builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
\`\`\`

### Step 3: Enable Global Tauri (REQUIRED)

In \`src-tauri/tauri.conf.json\`, ensure \`withGlobalTauri\` is enabled:

\`\`\`json
{
  "app": {
    "withGlobalTauri": true
  }
}
\`\`\`

**This is required** - without it, the MCP bridge cannot communicate with the webview.

### Step 4: Add Plugin Permissions

Add the plugin permission to \`src-tauri/capabilities/default.json\` (create the file if it doesn't exist):

\`\`\`json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "mcp-bridge:default"
  ]
}
\`\`\`

If the file already exists, just add \`"mcp-bridge:default"\` to the existing permissions array.

## Verification

After setup:
1. Run the Tauri app in development mode (\`cargo tauri dev\` or \`npm run tauri dev\`)
2. The MCP bridge will start a WebSocket server on port 9223
3. Use \`tauri_driver_session\` with action "start" to connect
4. Use \`tauri_driver_session\` with action "status" to verify the connection

## Notes

- The plugin only runs in debug builds (\`#[cfg(debug_assertions)]\`) so it won't affect production
- The WebSocket server binds to \`0.0.0.0\` by default to support mobile device testing
- For localhost-only access, use \`Builder::new().bind_address("127.0.0.1").build()\` instead of \`init()\`

Please examine the project structure and make the necessary changes to set up the MCP bridge plugin.`;
</script>

# Getting Started with MCP Server Tauri

This guide will walk you through integrating MCP Server Tauri into your existing Tauri application.

## Prerequisites

Before you begin, ensure you have:

- An existing **Tauri 2.x** application
- **Node.js** 20+ and npm
- **Rust** and Cargo
- An MCP-compatible AI Assistant (Claude Code, Cursor, Windsurf, VS Code, etc.)

## Step 1: Configure Your AI Assistant

First, add the MCP server to your AI assistant using [install-mcp](https://www.npmjs.com/package/install-mcp):

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

**Restart your AI assistant** after adding the configuration.

## Step 2: Configure Your Tauri App

Now add the MCP Bridge plugin to your Tauri app. Pick your path:

<div class="setup-options">

### ⚡ Quick Setup (Recommended)

If your editor supports MCP prompts, just type this in your AI assistant:

```
/setup
```

**That's it.** Your AI will automatically:
- ✅ Add the Rust crate to `Cargo.toml`
- ✅ Register the plugin in your app
- ✅ Enable `withGlobalTauri`
- ✅ Add required permissions

::: tip Zero manual configuration
The `/setup` command examines your project and makes all the right changes. It adapts to your specific setup—no copy-pasting required.
:::

#### If Your Editor Doesn't Support Prompts {#manual-prompt-instructions}

Some MCP clients don't support [prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts) yet (e.g., [Windsurf](https://codeium.mintlify.app/windsurf/cascade/mcp#general-information)). If the `/setup` slash command doesn't work in your editor, copy the setup instructions below and paste them into your AI assistant:

<CopyButton :text="SETUP_INSTRUCTIONS" label="Copy setup instructions" />

<details>
<summary>Preview instructions</summary>

The copied text contains step-by-step instructions for:
1. Adding the Rust plugin to `Cargo.toml`
2. Registering the plugin in your app's entry point
3. Enabling `withGlobalTauri` in `tauri.conf.json`
4. Adding plugin permissions to capabilities

</details>

---

### 🔧 Manual Setup

<details>
<summary>Prefer to do it yourself? Click here for step-by-step instructions</summary>

#### 1. Install the Rust Plugin

From your `src-tauri` directory:

```bash
cargo add tauri-plugin-mcp-bridge
```

Or manually add to `Cargo.toml`: <code>tauri-plugin-mcp-bridge = "{{ versions.plugin.cargo }}"</code>

#### 2. Register the Plugin

In your app's entry point (`src-tauri/src/lib.rs` or `src-tauri/src/main.rs`):

```rust
let mut builder = tauri::Builder::default();
// ... your other plugins and configuration

#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}

builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

#### 3. Enable Global Tauri

In `src-tauri/tauri.conf.json`, add:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

::: warning Required
Without `withGlobalTauri`, the MCP server cannot communicate with your app's webview.
:::

#### 4. Add Plugin Permissions

Add to `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "mcp-bridge:default"
  ]
}
```

</details>

</div>

## 🚀 Start Building!

Run your app and start talking to your AI assistant:

```bash
cargo tauri dev
```

Now try these:

> "Take a screenshot of my app"

> "Click the submit button"

> "Start monitoring IPC calls and show me what's happening"

> "Find all the input fields in my app"

> "Check the console for any JavaScript errors"

The AI connects to your running app and can see, click, type, and debug—just like a human tester, but faster.

## More Slash Commands

| Command | What it does |
|---------|--------------|
| `/setup` | Configure the MCP bridge (you just used this!) |
| `/fix-webview-errors` | Find and fix JavaScript errors automatically |

See the [Prompts documentation](/api/prompts) for details.

::: info Prompts Not Working?
Some MCP clients don't support slash commands yet. See the [manual prompt instructions](#manual-prompt-instructions) section above for a workaround.
:::

## Next Steps

- **[API Reference](/api/)** — Learn about all 16 available tools
- **[IPC & Plugin Tools](/api/ipc-plugin)** — Debug your app's IPC layer
- **[UI Automation](/api/ui-automation)** — Automate webview interactions

## Troubleshooting

### MCP Server Not Loading

If your AI assistant doesn't recognize the Tauri tools:

1. Verify the MCP configuration is correct
2. Restart your AI assistant application
3. Check for error messages in the assistant's logs

### Connection Failed

If the AI can't connect to your Tauri app:

1. Make sure your app is running (`cargo tauri dev`)
2. Verify `withGlobalTauri` is enabled in `tauri.conf.json`
3. Check that `mcp-bridge:default` permission is added
4. Look for WebSocket errors in your app's console (port 9223)

### Need Help?

- [GitHub Issues](https://github.com/hypothesi/mcp-server-tauri/issues)
- [Tauri Documentation](https://tauri.app)
- [Model Context Protocol](https://modelcontextprotocol.io)
