# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.3] - 2026-02-17

### Fixed
- Support selection by text content in tools with selectors
- Remove sourceMappingURL from html2canvas file to prevent 404

## [0.8.2] - 2026-02-10

### Fixed
- Fix window timing race condition: retry commands with exponential backoff when Tauri window is not yet registered after WebSocket connect

### Changed
- Consolidate `window.__MCP__` namespace and extract `resolveRef` into a standalone persistent script registered once at session init
- Update setup tool instructions with feature-flag workflow, conditional capabilities, and dev script configuration

## [0.8.1] - 2026-01-25

### Fixed
- Replace `html2canvas` with `html2canvas-pro` to fix screenshot failures with modern CSS color functions like `oklch()` (#4)

## [0.8.0] - 2025-01-15

### Added
- Add `webview_dom_snapshot` tool for accessibility tree snapshots (YAML format with roles, names, states, and element refs)
- Add `structure` snapshot type to `webview_dom_snapshot` for DOM hierarchy inspection
- Enable ref IDs from `dom_snapshot` to work with other webview tools (`webview_interact`, `webview_keyboard`, etc.)

### Changed
- Remove `tauri_` prefix from all tool names (e.g., `tauri_driver_session` → `driver_session`)

### Fixed
- Convert PNG to JPEG in screenshots when requested format is JPEG
- Update server.json version dynamically in publish workflow

## [0.7.0] - 2026-01-06

### Added
- Implement IPC monitoring with JS-side interception for capturing `invoke()` calls
- Derive plugin version programmatically from package.json

### Fixed
- Fixed compilation error on Android and iOS caused by desktop-only window resize APIs

### Breaking Changes

#### Permission Identifier Renamed

The `mcp-bridge:allow-all` permission has been replaced with `mcp-bridge:default`.

**Migration:** Update your `src-tauri/capabilities/default.json` (or similar capabilities file):

```diff
  "permissions": [
    "core:default",
-   "mcp-bridge:allow-all"
+   "mcp-bridge:default"
  ]
```

## [0.6.5] - 2025-12-31

### Added
- Add `maxWidth` parameter to `tauri_webview_screenshot` tool for automatic image resizing
- Support `TAURI_MCP_SCREENSHOT_MAX_WIDTH` environment variable for default max width

### Fixed
- Search common paths for `adb` when `ANDROID_HOME` is not set

## [0.6.4] - 2025-12-28

### Fixed
- Update MCP server.json version and GitHub URL for registry compatibility

## [0.6.3] - 2025-12-28

### Fixed
- Fix logger interfering with MCP communication by using stderr instead of stdout
- Fix MCP Registry publishing workflow to correctly locate `server.json` and lint commits from the correct base version

## [0.6.2] - 2025-12-24

### Fixed
- Convert update-server-json-version script to ES modules to fix CI compatibility

## [0.6.1] - 2025-12-23

### Added
- Automated MCP Registry publishing workflow with OIDC authentication
- MCP Registry server metadata (`server.json`) for registry integration
- Automated `server.json` version synchronization in release workflow
- npm provenance attestation for supply chain security

### Changed
- Standardized Node.js version to `lts/*` across all workflows
- Updated `.nvmrc` to Node.js 24

### Documentation
- Added comprehensive MCP Registry publishing guide
- Updated workflows README with npm trusted publishers setup
- Added troubleshooting section for common workflow issues

## [0.6.0] - 2025-12-23

### Added
- Multi-app support: Connect to multiple Tauri apps simultaneously
- Default app concept: Most recently connected app is used when no identifier specified
- App identifier parameter (`appIdentifier`) added to all webview and IPC tools
- Port-based session tracking for handling duplicate bundle IDs

### Changed
- Session manager now uses `Map<port, SessionInfo>` instead of single session
- Each session maintains its own `PluginClient` instance
- `tauri_driver_session` status returns array format when multiple apps connected
- `tauri_driver_session` stop without identifier stops all sessions
- Tool descriptions updated to explain multi-app behavior

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
- Simplify Quick Start docs to feature AI-assisted setup

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
- Native Android screenshot support via JNI

### Fixed
- Resolve adb path from ANDROID_HOME for log reading

## [0.2.2] - 2025-12-01

### Fixed
- Fix screenshot crash on iOS

### Documentation
- Add llms.txt integration for AI-friendly documentation
- Add more convenient installation instructions
- Improve version number freshness in docs

## [0.2.1] - 2025-11-30

### Fixed
- Make Tauri APIs a peerDependency in the plugin JS bindings

### Documentation
- Update tools list
- Clarify the role of the JS bindings
- Install plugin only in development in example
- Encourage use of default permissions

## [0.2.0] - 2025-11-29

### Added
- MCP prompts for guided workflows (setup, debugging, testing, mobile development)
- Multi-window support for targeting specific webview windows

### Changed
- Improve MCP tool descriptions and metadata for better AI agent comprehension

## [0.1.3] - 2025-11-26

### Documentation
- README for NPM package
- crates.io badge to documentation
- Improve GitHub release notes generation
- Improve SEO with meta tags, sitemap, and page frontmatter

### Fixed
- Fix API docs link

## [0.1.2] - 2025-11-26

### Added
- Changelog page in documentation site with dynamic GitHub releases
- Version badge in docs navigation bar

### Fixed
- Add missing system dependencies to Rust release pipeline

## [0.1.1] - 2025-11-26

### Fixed
- Handle WebSocket disconnects reliably during port scanning
- Improve `execute_js` error handling with better timeout coordination

### Changed
- Expand tool descriptions for better AI agent comprehension

### Documentation
- Clarify that `app.withGlobalTauri` is required in `tauri.conf.json`
- Add Rust code style guidelines for agents (`cargo fmt`, `cargo clippy`)

## [0.1.0] - 2025-11-26

### Added
- Initial project setup with MCP server for Tauri v2 development
- Comprehensive tooling for Tauri application management
- Native UI automation capabilities
- IPC monitoring via MCP Bridge plugin
- Mobile development tools (Android/iOS)
