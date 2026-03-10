# CLI Usage

Use `@hypothesi/tauri-mcp-cli` when you want to call the Tauri MCP tools from a terminal instead of from an MCP client.

## Install

```bash
npm install -g @hypothesi/tauri-mcp-cli
```

## Session Workflow

Start a long-lived Tauri session:

```bash
tauri-mcp driver-session start --port 9223
```

Call another tool in a separate command:

```bash
tauri-mcp webview-screenshot --file screenshot.png
```

Check status or stop the session later:

```bash
tauri-mcp driver-session status --json
tauri-mcp driver-session stop
```

## Keep-Alive Behavior

The CLI uses MCPorter keep-alive mode behind the scenes. That means:

- each `tauri-mcp ...` command exits normally
- the underlying MCP server process stays warm in the background
- `driver_session` state survives across separate CLI invocations

You can inspect or stop the daemon directly:

```bash
tauri-mcp daemon status
tauri-mcp daemon stop
```

## Output

- Image tools write image files to disk by default.
- Use `--file <path>` to control the image filename.
- Use `--json` for structured output.
