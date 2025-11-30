---
title: Getting Started with MCP Server Tauri
description: Learn how to integrate MCP Server Tauri into your existing Tauri application for AI-powered development.
head:
  - - meta
    - name: keywords
      content: tauri setup, mcp server installation, ai assistant configuration, tauri integration
---

# Getting Started with MCP Server Tauri

This guide will walk you through integrating MCP Server Tauri into your existing Tauri application.

## Prerequisites

Before you begin, ensure you have:

- An existing **Tauri 2.x** application
- **Node.js** 20+ and npm
- **Rust** and Cargo
- An MCP-compatible AI Assistant (Claude Code, Cursor, VS Code, etc.)

## Step 1: Add the MCP Bridge Plugin to Your Tauri App

The MCP Bridge plugin enables communication between the MCP server and your Tauri application.

### Install the Rust Plugin

Add it to your Tauri app's `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-mcp-bridge = "0.1"
```

Then register the plugin in your app's entry point (e.g., `src-tauri/src/lib.rs` or `src-tauri/src/main.rs`):

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_mcp_bridge::init())
    // ... your other plugins and configuration
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### Enable Global Tauri

::: warning Required Configuration
You **must** enable `withGlobalTauri` in your `tauri.conf.json` for the MCP bridge to work. This exposes `window.__TAURI__` which the plugin uses to communicate with your app:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

Without this setting, the MCP server will not be able to interact with your application's webview.
:::

### Add Plugin Permissions

Add the plugin's permission to your capabilities file (e.g., `src-tauri/capabilities/default.json`):

```json
{
  "permissions": [
    "mcp-bridge:default"
  ]
}
```

This grants all permissions required by the MCP server.

## Step 2: Configure Your AI Assistant

See the [home page](/) for detailed, assistant-specific configuration examples (Claude Code, Cursor, VS Code, Windsurf, Cline, etc.). The configuration snippets there all point to the same command:

```json
"args": ["-y", "@hypothesi/tauri-mcp-server"]
```

This tells your assistant to launch the MCP server via `npx @hypothesi/tauri-mcp-server`.

### Using Local Development Build

If you're developing the MCP server itself, you can point to your local build:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tauri-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-tauri/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Make sure to replace `/absolute/path/to` with the actual path to your installation.

## Step 3: Verify the Installation

Restart your AI Assistant and verify that the MCP server is loaded. You can ask:

> "What Tauri tools are available?"

The assistant should list the available MCP tools for Tauri development.

## Step 4: Start Developing

With the MCP server configured and the bridge plugin installed, you can now use your AI assistant to help develop your Tauri app. Start the development server:

> "Start the Tauri development server"

This will launch your application in development mode with hot-reload enabled.

## Step 5: Explore Available Tools

The MCP server provides tools across four categories:

- **Project Management**: Run CLI commands, read/write Tauri configs, access documentation
- **Mobile Development**: List devices, launch Android AVDs or iOS Simulators
- **UI Automation & WebView Interaction**: Find elements, take screenshots, interact with the UI, execute JavaScript, read logs
- **IPC & Plugin Tools**: Execute IPC commands, monitor IPC events, emit test events, inspect backend state

Ask your AI Assistant about specific tasks:

> "Take a screenshot of my app and check if the button is visible"

> "Start IPC monitoring and show me what commands are being called"

> "Launch an iOS Simulator and run my app on it"

## Step 6: Use Slash Commands

In addition to tools, the MCP server provides **slash commands** (prompts) for guided workflows. These are pre-built templates that walk your AI through multi-step tasks.

### Available Commands

| Command | Description |
|---------|-------------|
| `/fix-webview-errors` | Find and fix JavaScript errors in your webview |

### Using Slash Commands

Type the command directly in your AI assistant's chat:

```
/fix-webview-errors
```

The AI will then:
1. Connect to your running Tauri app
2. Retrieve console logs and errors
3. Analyze the errors and identify root causes
4. Help you locate and fix the problematic code
5. Clean up the session

::: tip When to Use Slash Commands
Use slash commands when you want a guided, multi-step workflow. They're perfect for debugging sessions and complex tasks that require multiple tools working together.
:::

See the [Prompts documentation](/api/prompts) for more details.

## Next Steps

Now that you have MCP Server Tauri set up, you can:

1. **Explore the API Reference** to learn about all available tools
2. **Read the Mobile Development Guide** to build for Android and iOS
3. **Learn about IPC Monitoring** to debug your application
4. **Check out Best Practices** for efficient development

## Troubleshooting

### MCP Server Not Loading

If your AI Assistant doesn't recognize the MCP tools:

1. Verify the path in your configuration is correct
2. Check that the build completed successfully (or use `npx @hypothesi/tauri-mcp-server` for the published version)
3. Restart your AI Assistant application
4. Check the logs for any error messages

### Build Errors

If you encounter build errors:

1. Ensure all prerequisites are installed
2. Try cleaning and rebuilding: `npm run clean && npm run build`
3. Check that you have the correct Node.js version (20+)
4. Verify Rust and Cargo are properly installed

### Need Help?

- Check the [GitHub Issues](https://github.com/hypothesi/mcp-server-tauri/issues)
- Read the [Tauri Documentation](https://tauri.app)
- Learn about the [Model Context Protocol](https://modelcontextprotocol.io)
