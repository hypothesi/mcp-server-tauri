# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
