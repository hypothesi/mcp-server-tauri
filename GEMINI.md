# Tauri MCP CLI

You are using the Tauri MCP CLI extension. This tool allows you to automate, test, and debug Tauri v2 applications.

## Core Workflow

1. **Start a Session**: Always start with `tauri-mcp driver-session start --port 9223`.
2. **Use Tools**: Use `webview-interact`, `webview-screenshot`, etc.
3. **Stop Session**: Clean up with `tauri-mcp driver-session stop`.

## Critical Failure Modes

* **No Active Session**: Most tools fail if a session isn't running. Check `driver-session status` first.
* **CamelCase Flags**: All CLI flags are `kebab-case` (e.g., `--window-id`, not `--windowId`).
* **Screenshot Output**: Screenshots are saved to disk, never printed as base64.
* **Real Devices**: Android devices require `adb reverse tcp:9223 tcp:9223` before connecting.

## Skill

Use the bundled `tauri-mcp-cli` skill for CLI automation tasks.
