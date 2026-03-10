# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### 1. Test Suite (`test.yml`)

**Triggers**: Push to main/develop branches, Pull requests

**Purpose**: Runs comprehensive tests for all packages

**Jobs**:
- **test-plugin**: Test tauri-plugin-mcp-bridge (Rust + TypeScript)
  - Matrix: Ubuntu 22.04, Windows, macOS
  - Runs Rust tests, formatting checks, and Clippy
- **test-server**: Test @hypothesi/tauri-mcp-server (Node.js)
  - Matrix: Ubuntu, Windows, macOS × Node.js 20, 24
  - Runs unit tests and TypeScript type checking
- **test-app**: Build test-app (Tauri application)
  - Matrix: Ubuntu 22.04, Windows, macOS
  - Verifies the test app builds successfully
- **lint-and-standards**: ESLint checks
- **all-tests-pass**: Summary job that requires all tests to pass

### 2. Release Packages (`release.yml`)

**Triggers**: Push tags matching:
- `v*` - Release all packages with the same version
- `tauri-plugin-mcp-bridge/v*` - Release only the plugin
- `mcp-server/v*` - Release only the server
- `tauri-mcp-cli/v*` - Release only the CLI

**Purpose**: Unified release workflow for all packages

**Features**:
- Smart package detection based on tag format
- Can release individual packages or all packages
- Comprehensive testing before release
- Automatic version updates
- npm provenance attestation for supply chain security (OIDC-based, no tokens needed)

**Process**:
1. Determine which packages to release based on tag
2. Run tests across all platforms
3. Update package versions
4. Build TypeScript and/or Rust components
5. Publish to npm with `--provenance` flag
6. Publish to crates.io (if plugin)
7. Create GitHub release with changelog

### 3. Publish to MCP Registry (`publish-mcp-registry.yml`)

**Triggers**: Automatically after "Release Packages" workflow completes successfully

**Purpose**: Publish MCP server metadata to the official MCP Registry

**Features**:
- Depends on Release Packages workflow via `workflow_run`
- Only runs if Release Packages succeeded
- Uses OIDC authentication (no tokens needed)
- Publishes only metadata (npm package already published by Release workflow)

**Process**:
1. Waits for Release Packages workflow to complete
2. Installs mcp-publisher CLI
3. Authenticates via GitHub OIDC
4. Publishes server metadata to MCP Registry

### 4. Deploy Documentation (`deploy-docs.yml`)

**Triggers**:
- Push to main branch (when docs/** or related files change)
- Manual workflow dispatch

**Purpose**: Build and deploy VitePress documentation to GitHub Pages

**Process**:
1. Build documentation with VitePress
2. Upload to GitHub Pages
3. Deploy to https://hypothesi.github.io/mcp-server-tauri/

## Required Secrets

Before using the release workflows, configure these secrets in your GitHub repository settings:

1. **CARGO_REGISTRY_TOKEN**: Authentication token for crates.io
   - Get from: <https://crates.io/settings/tokens>
   - Required for: Publishing Rust crates to crates.io

## npm Publishing Setup

npm publishing uses **provenance** with OIDC authentication (no NPM_TOKEN needed):

1. Configure npm Trusted Publisher at <https://www.npmjs.com/package/@hypothesi/tauri-mcp-server/access>:
   - Provider: GitHub Actions
   - Organization: hypothesi
   - Repository: mcp-server-tauri
   - Workflow: release.yml
   - Environment: (leave empty)

2. Ensure your GitHub organization membership is public at <https://github.com/orgs/hypothesi/people>

This eliminates the need for NPM_TOKEN secrets and provides better supply chain security.

### First Publish for a New npm Package

Trusted publishing is the steady-state path, but a brand-new npm package may need a one-time manual publish before npm can be configured to trust this repository workflow.

For `@hypothesi/tauri-mcp-cli`:

1. Publish it once manually from an npm maintainer account:
   ```bash
   npm publish -w @hypothesi/tauri-mcp-cli --access public
   ```
2. Add the trusted publisher in npm package settings:
   - Provider: GitHub Actions
   - Organization: `hypothesi`
   - Repository: `mcp-server-tauri`
   - Workflow: `release.yml`
3. After that, use the normal tag-driven GitHub Actions release flow.

## Tag Formats

The release workflow supports three tag patterns:

   * **All packages** (same version): `v0.1.0`
      * Releases both packages with version 0.1.0
      * Use for coordinated releases or major versions

   * **Plugin only**: `tauri-plugin-mcp-bridge/v0.1.0`
      * Releases only the Tauri plugin
      * Updates version to 0.1.0

   * **Server only**: `mcp-server/v0.1.0`
      * Releases only the MCP server
      * Updates version to 0.1.0

   * **CLI only**: `tauri-mcp-cli/v0.1.0`
      * Releases only the CLI
      * Updates version to 0.1.0

## Usage Examples

### Running Tests Locally

```bash
# Run all tests
npm test

# Run specific package tests
cd packages/mcp-server && npm test
cd packages/tauri-plugin-mcp-bridge && cargo test

# Run linting
npm run standards
```

### Creating a Release

1. Update version in package files:

   ```bash
   # For plugin
   cd packages/tauri-plugin-mcp-bridge
   # Update version in Cargo.toml and package.json

   # For server
   cd packages/mcp-server
   # Update version in package.json
   ```

2. Update CHANGELOG.md files

3. Commit and push changes

4. Create and push a tag:

   ```bash
   # For individual package
   git tag -s tauri-plugin-mcp-bridge/v0.1.0 -m "Release tauri-plugin-mcp-bridge v0.1.0"
   git tag -s mcp-server/v0.1.0 -m "Release mcp-server v0.1.0"
   git tag -s tauri-mcp-cli/v0.1.0 -m "Release tauri-mcp-cli v0.1.0"

   # For all packages
   git tag -s v0.1.0 -m "Release v0.1.0"

   # Push tag
   git push origin --tags
   ```

The workflows will automatically:

   * Run comprehensive tests
   * Build packages
   * Publish to registries
   * Create GitHub releases

## Workflow Permissions

The workflows require the following permissions:

- **Test Suite**: Default permissions (read-only)
- **Release Packages**:
  - `contents: write` - For creating GitHub releases
  - `id-token: write` - For npm provenance attestation
- **Publish to MCP Registry**:
  - `id-token: write` - For OIDC authentication with MCP Registry
  - `contents: read` - For checking out code
- **Deploy Documentation**:
  - `contents: read` - For checking out code
  - `pages: write` - For deploying to GitHub Pages
  - `id-token: write` - For GitHub Pages deployment

## Best Practices

1. Always run tests locally before pushing: `npm test`
2. Update all three CHANGELOG.md files before releases (root, mcp-server, tauri-plugin-mcp-bridge)
3. Use semantic versioning (MAJOR.MINOR.PATCH)
4. Ensure versions are synchronized across package.json and Cargo.toml files
5. The `server.json` version is automatically updated by the release workflow - no manual update needed
6. Test workflows in a fork first if making changes
7. Monitor workflow runs for any failures in the Actions tab
8. The MCP Registry workflow runs automatically - no manual intervention needed

## Troubleshooting

### Release workflow fails at npm publish

- Verify npm Trusted Publisher is configured correctly
- Ensure the workflow name matches exactly: `release.yml`
- Check that `id-token: write` permission is set
- For a brand-new package, publish it once manually before expecting OIDC releases to work

### MCP Registry workflow doesn't trigger

- Verify the Release Packages workflow completed successfully
- Check that a version tag was pushed (not just created locally)
- Ensure your GitHub organization membership is public

### Tests fail in CI but pass locally

- Check Node.js and Rust versions match between local and CI
- Verify all dependencies are properly declared in package.json/Cargo.toml
- Review platform-specific issues (Ubuntu 22.04, Windows, macOS)
