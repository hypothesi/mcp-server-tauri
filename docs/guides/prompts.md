---
title: Using Prompts (Slash Commands)
description: Learn how to use MCP prompts to run guided, multi-step workflows for common Tauri development tasks.
head:
  - - meta
    - name: keywords
      content: tauri prompts, slash commands, mcp workflows, ai debugging, guided workflows
---

# Using Prompts (Slash Commands)

[Prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts) are pre-built templates that guide your AI assistant through multi-step workflows. In MCP clients like Claude Desktop, Cursor, and VS Code, these appear as **slash commands** you can invoke directly.

::: warning Prompts Not Supported Everywhere
Some MCP clients don't support prompts yet (e.g., [Windsurf](https://codeium.mintlify.app/windsurf/cascade/mcp#general-information)). If slash commands don't work in your editor, see the [Getting Started guide](/guides/getting-started#manual-prompt-instructions) for a workaround.
:::

## What Are Prompts?

While **tools** are individual actions the AI can take (like taking a screenshot or clicking a button), **prompts** are complete workflows that combine multiple tools into a guided experience.

| Aspect | Tools | Prompts |
|--------|-------|---------|
| **Control** | AI-controlled | User-controlled |
| **Scope** | Single action | Multi-step workflow |
| **Invocation** | AI decides when to use | You type a slash command |
| **Example** | `tauri_webview_screenshot` | `/fix-webview-errors` |

## Available Prompts

### /select

**Purpose:** Visually select an element in your running Tauri app so you can discuss it with the AI.

**When to use:**
- You want to point at a specific element and ask the AI about it
- You see a styling issue and want to show the AI exactly which element
- You want the AI to inspect or modify a particular UI component

**What it does:**

```
1. Ensures a session is active with your Tauri app
2. Activates a visual element picker overlay
3. You click the element you want to discuss
4. The AI receives element metadata and a screenshot
5. The AI responds using that context
```

**Prerequisites:**
- Your Tauri app must be running with the MCP bridge plugin installed
- `withGlobalTauri` must be enabled in `tauri.conf.json`

**Example session:**

```
You: /select this button should be green instead of blue

AI: I'll help you change the button color. Let me activate the element picker...

    [Picker overlay appears in your app]
    [You click the button]

    I can see the button you selected:
    - Element: <button> with class "btn-primary"
    - Current color: rgb(59, 130, 246) (blue)
    - CSS Selector: .action-bar > button.btn-primary

    I'll update the CSS to change it to green...
```

You can also use `/select` without a message — the AI will simply ask you what you'd like to do with the selected element.

---

### /fix-webview-errors

**Purpose:** Find and fix JavaScript errors in your Tauri app's webview.

**When to use:**
- Your app is showing unexpected behavior
- You see errors in the browser console
- Something isn't working and you're not sure why

**What it does:**

```
1. Connects to your running Tauri app
2. Retrieves console logs and errors from the webview
3. Analyzes error messages and stack traces
4. Identifies the type of error (TypeError, ReferenceError, etc.)
5. Locates the problematic source code
6. Proposes concrete fixes
7. Cleans up the session
```

**Prerequisites:**
- Your Tauri app must be running
- The MCP bridge plugin must be installed
- `withGlobalTauri` must be enabled in `tauri.conf.json`

**Example session:**

```
You: /fix-webview-errors

AI: I'll help you find and fix JavaScript errors in your Tauri app.

    Starting automation session... ✓ Connected on port 9223

    Retrieving console logs...

    Found 2 errors:

    1. TypeError: Cannot read property 'map' of undefined
       at UserList.vue:42

    2. ReferenceError: fetchUsers is not defined
       at App.vue:15

    Let me analyze these...

    [AI continues to locate code and propose fixes]
```

## How to Use Prompts

### In Claude Desktop

Type the command in the chat input:

```
/fix-webview-errors
```

### In VS Code / Cursor

Use the command in the Copilot or AI chat panel:

```
/fix-webview-errors
```

::: tip Prompt Discovery
Most MCP clients will show available prompts when you type `/`. Look for prompts from the "tauri" server.
:::

## When to Use Prompts vs. Direct Requests

### Use a Prompt When:

- You want a **guided, structured workflow**
- You're debugging and want **comprehensive analysis**
- You want the AI to follow **best practices** automatically
- You're not sure which tools to use

### Use Direct Requests When:

- You need a **quick, one-off action** ("take a screenshot")
- You want **specific control** over what happens
- You're doing something the prompts don't cover
- You want to **combine tools** in a custom way

## Troubleshooting

### Prompt Not Found

If your AI assistant doesn't recognize the slash command:

1. **Verify the MCP server is loaded** - Ask "What Tauri tools are available?"
2. **Restart your AI assistant** - MCP servers are loaded at startup
3. **Check your configuration** - Ensure the tauri MCP server is configured correctly

### Session Connection Failed

If the prompt can't connect to your app:

1. **Is your app running?** - Start it with `tauri dev`
2. **Is the MCP bridge plugin installed?** - Check your `Cargo.toml`
3. **Is `withGlobalTauri` enabled?** - Check your `tauri.conf.json`
4. **Is port 9223 available?** - The bridge uses this port by default

### No Errors Found

If the prompt reports no errors but something is wrong:

1. **Reproduce the issue** - Trigger the error while the session is active
2. **Check the browser console manually** - Some errors may not be captured
3. **Try a direct request** - Ask the AI to "get console logs" directly

## Creating Custom Workflows

While built-in prompts cover common scenarios, you can always ask your AI to perform similar workflows manually:

> "Connect to my Tauri app, check for console errors, and help me debug any issues you find"

This gives you the same result with more flexibility to customize the process.

## See Also

- [API Reference: Prompts](/api/prompts) - Technical details and full prompt specifications
- [Getting Started](/guides/getting-started) - Initial setup guide
- [UI Automation Tools](/api/ui-automation) - Tools used by debugging prompts
