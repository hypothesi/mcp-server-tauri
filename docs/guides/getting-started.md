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

const SETUP_INSTRUCTIONS = `Help me set up or update the MCP Bridge plugin in my Tauri project.

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
tauri-plugin-mcp-bridge = "0.4"
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
Check \`src-tauri/capabilities/default.json\` (or similar) for \`"mcp-bridge:default"\` permission.

## Your Response Format

After examining the project, respond with:

1. **Current State**: What's already configured correctly
2. **Changes Needed**: A numbered list of specific changes required
3. **Ask for Permission**: "May I proceed with these changes?"

Only after I say yes should you make any modifications.

## After Setup

Once changes are approved and made:
1. Run the Tauri app in development mode (\`cargo tauri dev\`)
2. Use \`tauri_driver_session\` with action "start" to connect
3. Use \`tauri_driver_session\` with action "status" to verify

## Notes

- The plugin only runs in debug builds so it won't affect production
- The WebSocket server binds to \`0.0.0.0:9223\` by default
- For localhost-only access, use \`Builder::new().bind_address("127.0.0.1").build()\``;
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

Just ask your AI assistant to help set up the MCP Bridge plugin:

> "Help me set up the Tauri MCP Bridge plugin"

Your AI will use the `tauri_get_setup_instructions` tool to get the latest setup steps, then:
1. **Examine your project** to see what's already configured
2. **Show you what changes are needed** (Cargo.toml, plugin registration, etc.)
3. **Ask for your permission** before making any modifications

::: tip Safe by design
The AI will always ask before making changes. You stay in control while getting expert guidance tailored to your specific project structure.
:::

#### Alternative: Use the `/setup` Slash Command

If your editor supports [MCP prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts), you can also type:

```
/setup
```

#### If Neither Works {#manual-prompt-instructions}

Some MCP clients don't support prompts or tools with empty schemas yet. If the above methods don't work, copy the setup instructions below and paste them into your AI assistant:

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
