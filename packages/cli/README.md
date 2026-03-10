# @hypothesi/tauri-mcp-cli

CLI wrapper for calling the Tauri MCP server tools directly from the terminal.

## Install

```bash
npm install -g @hypothesi/tauri-mcp-cli
```

## Usage

Start a long-lived Tauri session:

```bash
tauri-mcp driver-session start --port 9223
```

Run another command against the same session:

```bash
tauri-mcp webview-screenshot --file screenshot.png
```

Check status or stop the daemon-managed session:

```bash
tauri-mcp driver-session status --json
tauri-mcp driver-session stop
tauri-mcp daemon status
tauri-mcp daemon stop
```

## Output

- Image-producing tools write image files to disk by default.
- Use `--file <path>` to control the output filename.
- Use `--json` to print structured JSON instead of plain text.

## Notes

This package uses `mcporter` keep-alive behavior under the hood so `driver_session` state survives across separate CLI invocations.
