# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2025-12-23

### Added
- Multi-app support: connect to multiple Tauri apps simultaneously and select targets via `appIdentifier`
- Add `appIdentifier` support to console log reads

### Changed
- `tauri_driver_session` stop without identifier stops all sessions

## [0.5.1] - 2025-12-21

### Fixed
- Fix plugin client singleton to reset when host/port parameters change
- Require active session before webview tools can connect to prevent connecting to wrong app

## [0.5.0] - 2025-12-21

### Added
- Add `tauri_manage_window` tool combining list, info, and resize window actions
- Add `tauri_get_setup_instructions` tool for AI-assisted plugin setup
- Add app identifier to `tauri_driver_session` status response for session verification

### Changed
- Update `/setup` prompt to require user permission before making changes

## [0.4.0] - 2025-12-05

### Changed
- Improve MCP logging and capture of unhandled errors for better debuggability and observability

## [0.3.1] - 2025-12-02

### Fixed
- Increase `find_element` outerHTML truncation limit from 200 to 5000 characters

### Documentation
- Add links to MCP prompts specification in docs
- Add workaround for editors that don't support MCP prompts (e.g., Windsurf)
- Add copy button for setup instructions in Getting Started guide
- Clarify `tauri_webview_execute_js` script format and return value requirements

## [0.3.0] - 2025-12-02

### Added
- Add `filePath` option to screenshot tool for saving screenshots to disk
- Return MCP SDK image shape for screenshots (base64 data with mimeType)
- Simplify MCP tools and add `/setup` prompt

### Fixed
- Resolve adb path from ANDROID_HOME for log reading

## [0.2.2] - 2025-12-01

_No changes to this package._

## [0.2.1] - 2025-11-30

_No changes to this package._

## [0.2.0] - 2025-11-29

### Added
- MCP prompts for guided workflows (setup, debugging, testing, mobile development)
- Multi-window support for targeting specific webview windows

### Changed
- Improve MCP tool descriptions and metadata for better AI agent comprehension

## [0.1.3] - 2025-11-26

### Documentation
- README for NPM package with usage instructions and tool reference

## [0.1.2] - 2025-11-26

_No changes to this package._

## [0.1.1] - 2025-11-26

### Fixed
- Handle WebSocket disconnects reliably during port scanning by always cleaning up `PluginClient` connections
- Prevent uncaught exceptions from orphaned WebSocket error events by adding default error handler
- Reject pending requests when WebSocket connection closes unexpectedly
- Auto-reconnect with exponential backoff (max 30s) instead of fixed retry limit
- Handle MCP server connection errors gracefully (broken pipe, EPIPE)
- Improve `execute_js` timeout coordination (7s client timeout vs 5s Rust timeout)

### Changed
- Expand tool descriptions for `tauri_plugin_ipc_monitor`, `tauri_plugin_ipc_get_events`, and `tauri_plugin_emit_event` for better AI agent comprehension
- `sendCommand` now auto-reconnects if WebSocket is not connected

### Added
- Initial release of @hypothesi/tauri-mcp-server
- Comprehensive MCP server for Tauri v2 development
- Tauri CLI command execution
- Configuration file management
- Mobile device and emulator management
- Native UI automation capabilities
- IPC monitoring via MCP Bridge plugin
- Log monitoring (Android/iOS/system)
- Native capability management
- Tauri documentation retrieval
