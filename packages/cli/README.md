# @hypothesi/tauri-mcp-cli

CLI wrapper for calling the Tauri MCP server tools directly from the terminal.

## Install

```bash
npm install -g @hypothesi/tauri-mcp-cli
```

Or run without a permanent install:

```bash
npx @hypothesi/tauri-mcp-cli <command>
```

## Session Lifecycle

Most automation tools require an active driver session. Start one before calling other tools.

### 1. Start a session

```bash
tauri-mcp driver-session start --port 9223
```

The session connects to a Tauri app running in development mode (`cargo tauri dev`) on the specified port. The MCP server process stays alive in the background via MCPorter keep-alive, so later commands reuse the same session.

### 2. Call tools in separate invocations

```bash
tauri-mcp webview-screenshot --file screenshot.png
tauri-mcp webview-execute-script --script "document.title"
tauri-mcp driver-session status --json
```

Each command exits normally. Session state persists across invocations.

### 3. Stop the session

```bash
tauri-mcp driver-session stop
```

## Output

- Image-producing tools write image files to disk by default.
- Default filename: `<tool-name>-<timestamp>.png` in the current directory.
- Use `--file <path>` to control the output filename.
- Use `--json` to print structured JSON output. Images are still written to disk; the JSON includes their file paths.

## Daemon Management

The keep-alive daemon persists the MCP server between commands. Manage it directly:

```bash
tauri-mcp daemon status    # Show daemon status
tauri-mcp daemon stop      # Stop the daemon
tauri-mcp daemon start     # Start or prewarm the daemon
tauri-mcp daemon restart   # Restart the daemon
```

## Troubleshooting

### "No active session" error

The daemon restarted and lost session state. Re-run `driver-session start`:

```bash
tauri-mcp driver-session start --port 9223
```

### Connection refused or stale daemon

```bash
tauri-mcp daemon restart
tauri-mcp driver-session start --port 9223
```

### Check daemon and session state

```bash
tauri-mcp daemon status
tauri-mcp driver-session status --json
```

## Agent Skills

This package ships one bundled [Agent Skill](https://agentskills.io) so AI coding agents learn correct CLI usage automatically. After installing the package, wire it into your agent config:

```bash
npx @tanstack/intent@latest install
```

Bundled skill:

- `tauri-mcp-cli` — one skill covering session lifecycle, UI automation, screenshots and inspection, IPC debugging, and mobile or remote device workflows

See the [Agent Skills guide](../../docs/guides/agent-skills.md) for installation options and the full coverage summary.
