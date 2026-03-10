---
title: Claude Code Plugin
description: Install Tauri MCP agent skills as a Claude Code Plugin for seamless integration.
head:
  - - meta
    - name: keywords
      content: claude code plugin, marketplace, tauri mcp, agent skills
---

# Claude Code Plugin

The Tauri MCP CLI is available as a **Claude Code Plugin**, making it easy to install agent skills directly into Claude Code without manual file editing.

## Install from Marketplace

### 1. Add the marketplace

In Claude Code, run:

```
/plugin marketplace add hypothesi/mcp-server-tauri
```

### 2. Install the plugin

```
/plugin install tauri-mcp-cli
```

### 3. Verify

```
/plugin list
```

You should see `tauri-mcp-cli` listed and enabled.

## What Gets Installed

The plugin provides:

- **Agent Skill** — one bundled `tauri-mcp-cli` skill that teaches Claude Code how to use the Tauri MCP CLI correctly across session lifecycle, UI interaction, screenshots, IPC debugging, and mobile or remote devices
- **Slash commands** — any commands defined in the plugin

## Managing the Plugin

```bash
# Enable the plugin
/plugin enable tauri-mcp-cli

# Disable without removing
/plugin disable tauri-mcp-cli

# Remove completely
/plugin uninstall tauri-mcp-cli
```

## Plugin Structure

The plugin follows the standard Claude Code Plugin format:

```
packages/cli/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   └── tauri-mcp-cli/
│       └── SKILL.md
└── ...
```

The plugin manifest lives at `.claude-plugin/plugin.json`:

```json
{
  "name": "tauri-mcp-cli",
  "description": "Agent Skills for automating and testing Tauri v2 applications",
  "version": "0.9.0"
}
```

## Alternative Installation Methods

If you prefer not to use the plugin system:

- **[Agent Skills via `npx skills`](/guides/agent-skills)** — works with 40+ agents, not just Claude Code
- **[CLI direct install](/guides/cli)** — `npm i -g @hypothesi/tauri-mcp-cli`

## Further Reading

- [Claude Code Plugin documentation](https://code.claude.com/docs/en/plugin-marketplaces)
- [Agent Skills guide](/guides/agent-skills)
- [CLI Usage](/guides/cli)
