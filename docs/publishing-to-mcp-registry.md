# Publishing to MCP Registry

This document describes how to publish the MCP server to the official MCP Registry.

The companion package `@hypothesi/tauri-mcp-cli` is npm-only and is not published to the MCP Registry.

## Prerequisites

1. **npm account** - Package must be published to npm first
2. **GitHub organization membership** - Must be a public member of the `hypothesi` organization
3. **Package configuration** - `mcpName` field in `package.json` must match the registry name

## Manual Publishing

### One-time Setup

1. Install mcp-publisher:
   ```bash
   brew install mcp-publisher
   ```

2. Authenticate with GitHub:
   ```bash
   mcp-publisher login github
   ```
   Follow the prompts to authorize via GitHub device flow.

3. Ensure your membership in the `hypothesi` organization is public:
   - Go to https://github.com/orgs/hypothesi/people
   - Find your username and change visibility to "Public"

### Publishing Steps

1. Build the package:
   ```bash
   npm run build -w @hypothesi/tauri-mcp-server
   ```

2. Publish to npm:
   ```bash
   npm publish -w @hypothesi/tauri-mcp-server --access public
   ```

   Publish the CLI package separately when it changes:
   ```bash
   npm publish -w @hypothesi/tauri-mcp-cli --access public
   ```

3. Navigate to the package directory:
   ```bash
   cd packages/mcp-server
   ```

4. Publish to MCP Registry:
   ```bash
   mcp-publisher publish
   ```

## Automated Publishing with GitHub Actions

The repository uses two GitHub Actions workflows for automated publishing:

1. **Release Packages** (`.github/workflows/release.yml`) - Handles building, testing, and publishing to npm/crates.io
2. **Publish to MCP Registry** (`.github/workflows/publish-mcp-registry.yml`) - Publishes to the MCP Registry after a successful release

### Setup

**Ensure GitHub Actions has proper permissions**:
- The MCP Registry workflow uses OIDC authentication via `github-oidc`
- No secrets needed - authentication is handled via OIDC tokens
- The workflow automatically triggers after the Release Packages workflow completes successfully

### npm First Publish for a New Package

The release workflow publishes npm packages with trusted publishing and provenance:

- `id-token: write` is enabled in `.github/workflows/release.yml`
- `npm publish --provenance --access public` is used for scoped public packages
- no `NPM_TOKEN` secret is required for steady-state releases

For a brand-new npm package such as `@hypothesi/tauri-mcp-cli`, do this once before relying on CI:

1. Publish the package manually from a maintainer npm account that has permission to publish under the `@hypothesi` scope:
   ```bash
   npm publish -w @hypothesi/tauri-mcp-cli --access public
   ```
2. Open the package settings on npm and add a trusted publisher for this repository and workflow:
   - Provider: GitHub Actions
   - Organization/user: `hypothesi`
   - Repository: `mcp-server-tauri`
   - Workflow file: `release.yml`
3. Push the next release tag and let GitHub Actions publish normally.

This one-time manual publish is needed because trusted publishing is configured on the npm package after the package exists. After that, CI can publish future versions without an npm token.

### Usage

Push a version tag to trigger the release process:

```bash
git tag -s v0.6.1 -m "Release v0.6.1"
git push --tags
```

CLI-only releases can also be triggered with:

```bash
git tag -s tauri-mcp-cli/v0.6.1 -m "Release tauri-mcp-cli v0.6.1"
git push --tags
```

This will:
1. Trigger the **Release Packages** workflow which:
   - Runs all tests across multiple platforms
   - Builds the packages
   - Publishes to npm (with provenance) and crates.io
   - Creates a GitHub release

2. After successful completion, automatically trigger the **Publish to MCP Registry** workflow which:
   - Installs mcp-publisher CLI
   - Authenticates with MCP Registry using `github-oidc`
   - Publishes the server metadata to the MCP Registry

### Workflow Details

The MCP Registry publishing workflow:
- Triggers via `workflow_run` after "Release Packages" completes successfully
- Only runs for tag pushes (version releases)
- Uses OIDC authentication - no tokens required
- Publishes only the MCP server metadata (the npm package is already published by the Release workflow)

## Configuration Files

- **`packages/mcp-server/package.json`**: Contains `mcpName: "io.github.hypothesi/tauri"` for registry verification
- **`packages/mcp-server/server.json`**: MCP Registry metadata file with package information

## Troubleshooting

### "Authentication failed"

- Ensure `id-token: write` permission is set in the workflow for OIDC authentication
- For manual publishing, re-authenticate: `mcp-publisher logout && mcp-publisher login github`

### "Package validation failed"

- Verify your package successfully published to npm
- Ensure `mcpName` in `package.json` matches the `name` in `server.json`
- Check that the package has the necessary verification information

### "You do not have permission to publish this server"

- Ensure your GitHub organization membership is public
- Verify you're authenticated with the correct GitHub account
- Check that the `mcpName` matches the pattern `io.github.hypothesi/*`

### Workflow doesn't trigger

- Verify the Release Packages workflow completed successfully
- Check that the tag was pushed (not just created locally)
- For CLI-only releases, use the `tauri-mcp-cli/v*` tag format
- Ensure the workflow has `id-token: write` permission

## Version Management

When releasing a new version:

1. Update version in all three locations:
   - `packages/mcp-server/package.json`
   - `packages/tauri-plugin-mcp-bridge/package.json`
   - `packages/tauri-plugin-mcp-bridge/Cargo.toml`

2. Update the CLI npm package version too:
   - `packages/cli/package.json`

3. Update all package changelogs, including `packages/cli/CHANGELOG.md`

4. Commit changes and create a signed tag

5. Push the tag to trigger automated publishing

**Note**: The `server.json` version is automatically updated by the release workflow - no manual update needed!
