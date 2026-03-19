---
name: tauri-mcp-cli
description: Use the Tauri MCP CLI to start and recover driver sessions, automate Tauri webviews, capture UI state, debug IPC, and work with mobile or remote devices. Use whenever an agent needs to operate a Tauri v2 app from terminal commands.
license: MIT
metadata:
  sources:
    - packages/cli/README.md
    - docs/guides/cli.md
    - docs/api/webview-interaction.md
    - docs/api/ui-automation.md
    - docs/api/ipc-plugin.md
    - docs/api/mobile-development.md
    - packages/cli/src/index.ts
---

# Tauri MCP CLI

Use this skill for the entire CLI workflow. The package intentionally ships a single bundled skill so agents do not need to pick between overlapping domain-specific skills.

## Prerequisites

- The app is running in development mode, usually with `cargo tauri dev`.
- The `tauri-plugin-mcp-bridge` plugin is installed and registered.
- `src-tauri/tauri.conf.json` sets `withGlobalTauri: true`.

## Core Rule

Start or verify a driver session before calling almost any other tool:

```bash
tauri-mcp driver-session start --port 9223
tauri-mcp driver-session status --json
```

`driver-session start` can succeed even when no app is reachable, so always check `connected: true` in the status output.

## Session and Daemon Lifecycle

```bash
# Start a session
tauri-mcp driver-session start --port 9223

# Run one or more commands in separate shell invocations
tauri-mcp webview-screenshot --file before.png
tauri-mcp webview-interact --action click --selector "#submit-btn"
tauri-mcp webview-screenshot --file after.png

# End the session
tauri-mcp driver-session stop
```

The CLI uses MCPorter keep-alive mode, so the background daemon preserves session state across separate `tauri-mcp ...` commands.

Use daemon commands only when the background process itself is unhealthy:

```bash
tauri-mcp daemon status
tauri-mcp daemon restart
tauri-mcp driver-session start --port 9223
```

## UI Interaction

```bash
# Click or focus an element
tauri-mcp webview-interact --action click --selector "#submit-btn"
tauri-mcp webview-interact --action focus --selector "#search"

# Type into a field
tauri-mcp webview-keyboard --action type --selector "#email" --text "hello@example.com"

# Wait before interacting with async UI
tauri-mcp webview-wait-for --type selector --value "#success-msg" --timeout 5000
tauri-mcp webview-interact --action click --selector "#success-msg"

# Keyboard shortcuts and scrolling
tauri-mcp webview-keyboard --action press --key "s" --modifiers '["Control"]'
tauri-mcp webview-interact --action scroll --selector ".content" --scroll-y 300
```

All CLI flags are kebab-case, not camelCase. For example, use `--window-id`, not `--windowId`.

## Inspection and Capture

```bash
# Screenshots always write files to disk
tauri-mcp webview-screenshot --file shot.png
tauri-mcp webview-screenshot --format jpeg --quality 80 --file shot.jpg
tauri-mcp webview-screenshot --json

# Run JavaScript in the webview
tauri-mcp webview-execute-js --script "document.title"
tauri-mcp webview-execute-js --script "(() => { return document.querySelectorAll('li').length; })()"

# Find elements and inspect styles
tauri-mcp webview-find-element --selector "#hero"
tauri-mcp webview-get-styles --selector "#hero" --properties '["color","font-size"]'

# Read logs and inspect windows
tauri-mcp read-logs --source console --filter "error" --lines 100
tauri-mcp manage-window --action list --json
```

If content is off-screen, scroll it into view before taking a screenshot. The CLI does not return base64 image data on stdout.

## IPC and Backend

```bash
# Verify the bridge plugin is active
tauri-mcp driver-session status --json

# Run backend commands
tauri-mcp ipc-execute-command --command "greet" --args '{"name":"World"}'
tauri-mcp ipc-get-backend-state --json

# Capture IPC traffic around an interaction
tauri-mcp ipc-monitor --action stop
tauri-mcp ipc-monitor --action start
tauri-mcp webview-interact --action click --selector "#refresh"
tauri-mcp ipc-get-captured --json
tauri-mcp ipc-monitor --action stop

# Emit synthetic events
tauri-mcp ipc-emit-event --event-name "user-action" --payload '{"action":"button-clicked"}'
```

If `driver-session status --json` returns `identifier: null`, treat that as a missing or inactive bridge plugin.

## Mobile and Remote Devices

```bash
# List targets
tauri-mcp list-devices --json

# Android emulator or iOS simulator
tauri-mcp driver-session start --port 9223

# Real Android device
adb reverse tcp:9223 tcp:9223
tauri-mcp driver-session start --port 9223

# Real iOS device or direct network connection
tauri-mcp driver-session start --host 192.168.1.101 --port 9223

# Mobile logs
tauri-mcp read-logs --source android --filter "com.myapp"
tauri-mcp read-logs --source ios --filter "MyApp"
```

For real Android devices, do not assume localhost works without `adb reverse` or an explicit `--host`.

## High-Value Failure Modes

### No active session

```bash
tauri-mcp driver-session start --port 9223
tauri-mcp driver-session status --json
```

### Stale daemon or app restart

```bash
tauri-mcp daemon restart
tauri-mcp driver-session start --port 9223
tauri-mcp driver-session status --json
```

### Wrong port

```bash
tauri-mcp driver-session start --port 9225
```

### Screenshot misuse

```bash
# Wrong: captures a file path string, not image bytes
IMG=$(tauri-mcp webview-screenshot)

# Right
tauri-mcp webview-screenshot --file shot.png
```

### JavaScript return shape

```bash
# Wrong: returns null
tauri-mcp webview-execute-js --script "() => { return document.title; }"

# Right
tauri-mcp webview-execute-js --script "document.title"
```

### Missing selector for typed input

```bash
# Wrong
tauri-mcp webview-keyboard --action type --text "hello"

# Right
tauri-mcp webview-keyboard --action type --selector "#email" --text "hello"
```

## Decision Checklist

Before acting, verify:

1. The app is running.
2. `driver-session status --json` shows `connected: true`.
3. The command uses kebab-case flags.
4. Screenshot commands write to explicit file paths when the result matters.
5. Mobile workflows specify the correct connection path and log source.
