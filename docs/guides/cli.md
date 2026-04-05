# CLI Usage

Use `@hypothesi/tauri-mcp-cli` when you want to call the Tauri MCP tools from a terminal,
script, or CI pipeline instead of from an MCP client.

## Install

```bash
npm install -g @hypothesi/tauri-mcp-cli
```

Or run without a permanent install:

```bash
npx @hypothesi/tauri-mcp-cli <command>
```

## Prerequisites

- A Tauri v2 app running in development mode (`cargo tauri dev`)
- The `tauri-plugin-mcp-bridge` plugin installed in the app
- `withGlobalTauri: true` in `src-tauri/tauri.conf.json`

## Session Workflow

### 1. Start a session

```bash
tauri-mcp driver-session start --port 9223
```

The `--port` must match the WebSocket port the MCP Bridge plugin is listening on (default:
9223).

### 2. Call tools in separate invocations

```bash
tauri-mcp webview-screenshot --file screenshot.png
tauri-mcp webview-interact --action click --selector "#submit-btn"
tauri-mcp webview-execute-js --script "document.title"
tauri-mcp driver-session status --json
```

### 3. Stop the session

```bash
tauri-mcp driver-session stop
```

## Keep-Alive Behavior

The CLI uses MCPorter keep-alive mode. That means:

- each `tauri-mcp ...` command exits normally after it completes
- the underlying MCP server process stays warm in the background
- `driver_session` state survives across separate CLI invocations

This makes it suitable for scripted workflows where each step is a separate command.

## Output

- Image tools write image files to disk by default.
- Default filename: `<tool-name>-<timestamp>.png` in the current directory.
- Use `--file <path>` to control the image filename.
- Use `--json` for structured JSON output. Images are still written to disk; the JSON
  includes their file paths.
- Use `--raw <json>` to pass raw JSON arguments directly to the underlying tool.

## Daemon Management

Manage the keep-alive daemon directly when troubleshooting:

```bash
tauri-mcp daemon status    # Show daemon status
tauri-mcp daemon stop      # Stop the daemon
tauri-mcp daemon start     # Start or prewarm the daemon
tauri-mcp daemon restart   # Restart the daemon
```

## Troubleshooting

### "No active session" error

The daemon restarted and lost session state. Re-run the session start:

```bash
tauri-mcp driver-session start --port 9223
```

### Connection refused or stale daemon

```bash
tauri-mcp daemon restart
tauri-mcp driver-session start --port 9223
```

### Check current state

```bash
tauri-mcp daemon status
tauri-mcp driver-session status --json
```

### Stale daemon config

MCPorter reads `~/.mcporter/tauri-mcp-cli.json`. If it becomes corrupted, delete it and
run any `tauri-mcp` command to regenerate it.

## Agent Skills

This package ships one bundled [Agent Skill](https://agentskills.io) that AI coding agents
can load automatically. After installing the package, run:

```bash
npx @tanstack/intent@latest install
```

This wires the CLI's bundled `tauri-mcp-cli` skill into your agent config (CLAUDE.md,
.cursorrules, etc.) so agents understand session lifecycle, screenshot patterns, IPC
debugging, and device workflows without extra prompting.

See the [Agent Skills guide](/guides/agent-skills) for the full skills inventory.
