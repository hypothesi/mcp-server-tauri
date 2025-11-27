# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
