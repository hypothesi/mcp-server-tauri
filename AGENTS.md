# AGENTS.md

## Project Overview

MCP server for Tauri v2 application development. Provides tools for CLI execution, configuration management, mobile device/emulator management, native UI automation, and debugging.

**Monorepo packages:**

- `packages/mcp-server/` - Main MCP server implementation
- `packages/tauri-plugin-mcp-bridge/` - Tauri plugin for automation bridge (Rust)
- `packages/test-app/` - Test application for E2E testing

## Setup Commands

```bash
npm install              # Install all dependencies
npm run build            # Build all packages
npm test                 # Run tests (requires build first)
npm run standards        # Run commitlint + eslint
```

## Code Style

- **TypeScript**: Strict mode, ESM with `.js` extensions in imports, ES2022 target
- **Naming**: camelCase for functions/variables, PascalCase for classes, kebab-case for files
- **Acronyms**: All lowercase or all caps, never mixed (e.g., `url` or `URL`, never `Url`)
- **Avoid**: `any` type, magic numbers, deeply nested blocks
- **Prefer**: Early returns, higher-order functions, immutability (`readonly`, `as const`)
- **Functions**: Arrow for simple (<3 instructions), named otherwise; use RO-RO pattern
- **JSDoc**: Document public classes and methods

## Adding New MCP Tools

All tools are defined in `packages/mcp-server/src/tools-registry.ts`:

1. Add Zod schema + handler in the appropriate module (`manager/`, `driver/`, `monitor/`)
2. Import and add entry to `TOOLS` array in `tools-registry.ts`
3. Add E2E test in `packages/mcp-server/tests/e2e/`

Tool categories: `PROJECT_MANAGEMENT`, `MOBILE_DEVELOPMENT`, `UI_AUTOMATION`, `IPC_PLUGIN`

## Testing Instructions

- Always build before testing: `npm run build`
- E2E tests launch `test-app` and connect via WebSocket
- Tests located in `packages/mcp-server/tests/e2e/`
- Prefer E2E tests over unit tests
- CI timeout is 8 minutes; local is 1 minute

## Session Management

- Call `driver_session` with `action: 'start'` before using driver tools
- Always call with `action: 'stop'` to clean up
- WebSocket port range: 9223-9322

## Git Commits

Follow: https://raw.githubusercontent.com/silvermine/standardization/refs/heads/master/commitlint.js

## Releasing

This monorepo uses a **single version** across all packages. All packages share the same version number.

### Files to Update

**Version files (all must have the same version):**

- `packages/mcp-server/package.json` - `version` field
- `packages/tauri-plugin-mcp-bridge/package.json` - `version` field
- `packages/tauri-plugin-mcp-bridge/Cargo.toml` - `version` field

**Changelog files (all three must be updated):**

- `CHANGELOG.md` - Root changelog for overall project history
- `packages/mcp-server/CHANGELOG.md` - Server-specific changes
- `packages/tauri-plugin-mcp-bridge/CHANGELOG.md` - Plugin-specific changes

**Lock files (updated automatically but must be committed):**

- `package-lock.json` - Updated by `npm install`
- `packages/tauri-plugin-mcp-bridge/Cargo.lock` - Updated by `cargo update`
- `packages/test-app/src-tauri/Cargo.lock` - Updated by `cargo update`

### Release Checklist

1. **Review git log** to identify changes since the last release tag
2. **Determine version bump** (patch for fixes, minor for features, major for breaking)
3. **Update all three changelogs** with the new version entry:
   - Add entry under `## [Unreleased]` with the new version and date
   - Include changes relevant to each package (use `_No changes to this package._` if none)
   - **Do not skip any version numbers** - if v0.2.1 exists, the next must be v0.2.2, not v0.2.3
4. **Update version in package.json files** using npm (without git tag):
   ```bash
   npm version <version> --no-git-tag-version -w @hypothesi/tauri-mcp-server -w @hypothesi/tauri-plugin-mcp-bridge
   ```
5. **Update Cargo.toml version** manually to match
6. **Update lock files**:
   ```bash
   npm install
   cargo update --package tauri-plugin-mcp-bridge  # in packages/tauri-plugin-mcp-bridge/
   cargo update --package tauri-plugin-mcp-bridge  # in packages/test-app/src-tauri/
   ```
7. **Verify versions** in lock files match the new version:
   ```bash
   grep -A2 '"@hypothesi/tauri-mcp-server"' package-lock.json | head -3
   grep -A2 '"@hypothesi/tauri-plugin-mcp-bridge"' package-lock.json | head -3
   ```
8. **Stage all changed files**:
   - All three changelogs
   - Both package.json files
   - Cargo.toml
   - package-lock.json
   - Both Cargo.lock files
9. **Commit**: `git commit -m "chore: version bump: v<version>"`
10. **Create signed tag**: `git tag -s v<version> -m "Release v<version>"`
11. **Push**: `git push && git push --tags`

### Common Mistakes to Avoid

- **Skipping changelog entries**: Every version must have an entry in all three changelogs
- **Forgetting lock files**: Both `package-lock.json` and both `Cargo.lock` files must be updated
- **Version mismatch**: All version fields must match exactly
- **Missing intermediate versions**: If changelogs are missing entries for previous versions, add them before creating the new release

## Rust Code

Run `cargo fmt` and `cargo clippy` after changes in `packages/tauri-plugin-mcp-bridge/`.

## NPM Dependencies

Always use `--save-exact` flag when installing.

## Key Files

- `packages/mcp-server/src/tools-registry.ts` - Single source of truth for all MCP tools
- `packages/mcp-server/src/index.ts` - MCP server entry point
- `packages/mcp-server/src/driver/session-manager.ts` - WebSocket session management
- `packages/tauri-plugin-mcp-bridge/src/lib.rs` - Plugin entry point and WebSocket server setup
- `specs/` - Architecture docs, release process, and design decisions
