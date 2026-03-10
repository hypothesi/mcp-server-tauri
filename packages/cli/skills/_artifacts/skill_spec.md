# Skill Spec — @hypothesi/tauri-mcp-cli

Generated from `domain_map.yaml`. Human-readable companion for review.

## Library Overview

**Package:** `@hypothesi/tauri-mcp-cli`  
**Audience:** AI coding agents automating or testing Tauri v2 desktop and mobile applications  
**Structure:** Single bundled skill (`tauri-mcp-cli`)

---

## Bundled Skill

| Skill Name | Priority | Source Docs |
|-----------|----------|-------------|
| `tauri-mcp-cli` | CRITICAL | `packages/cli/README.md`, `docs/guides/cli.md`, `docs/api/webview-interaction.md`, `docs/api/ui-automation.md`, `docs/api/ipc-plugin.md`, `docs/api/mobile-development.md` |

This skill deliberately covers the entire CLI surface so agents do not need to choose between overlapping domain-specific skills.

---

## Covered Domains

- Session and daemon management
- UI interaction
- Inspection and capture
- IPC and backend debugging
- Mobile and remote device workflows

---

## Highest-Value Failure Modes

| # | Mode | Severity |
|---|------|----------|
| 1 | Calling automation tools before session start | CRITICAL |
| 2 | Trusting `driver-session start` without checking `driver-session status --json` | HIGH |
| 3 | Using camelCase flags instead of kebab-case | HIGH |
| 4 | Expecting screenshot bytes on stdout instead of a file on disk | HIGH |
| 5 | Using IPC tools without an active `tauri-plugin-mcp-bridge` plugin | HIGH |
| 6 | Connecting to real Android devices without `adb reverse` or `--host` | HIGH |
| 7 | Typing without `--selector` on `webview-keyboard --action type` | MEDIUM |
| 8 | Returning a bare function from `webview-execute-js` | MEDIUM |

---

## Key Resolutions

| Tension | Resolution |
|---------|-----------|
| `driver-session start` may appear successful without a live app | Always follow with `driver-session status --json` and verify `connected: true` |
| `daemon stop` and `driver-session stop` sound similar | `daemon stop` kills the background process; `driver-session stop` only ends the connection |
| Screenshot commands feel like they should return image data | They always write files to disk; use `--file` or `--json` |
| Console logs and mobile logs share one command | Mobile flows must explicitly pass `--source android` or `--source ios` |

---

## Subsystems Covered

- CLI driver session management (`driver-session start/stop/status`)
- Keep-alive daemon management (`daemon start/stop/restart/status`)
- Webview UI interaction (`webview-interact`, `webview-keyboard`, `webview-wait-for`)
- Screenshots and JS execution (`webview-screenshot`, `webview-execute-js`)
- Element inspection and styles (`webview-find-element`, `webview-get-styles`)
- Log capture (`read-logs`)
- Window management (`manage-window`)
- IPC command execution and monitoring (`ipc-execute-command`, `ipc-monitor`, `ipc-get-captured`, `ipc-emit-event`, `ipc-get-backend-state`)
- Mobile device listing and remote device sessions (`list-devices`, `--host`, ADB forwarding)

---

## Gaps / Out of Scope

- Plugin installation and configuration details beyond basic verification
- Initial Tauri app setup outside the CLI workflow
- Direct MCP server usage without the CLI wrapper
