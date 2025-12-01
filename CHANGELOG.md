# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
