---
title: Agent Skills
description: Install Tauri MCP agent skills so your AI coding agent learns correct CLI usage automatically.
head:
  - - meta
    - name: keywords
      content: agent skills, skills.sh, npx skills, AI coding agent, tauri mcp cli
---

# Agent Skills

The `@hypothesi/tauri-mcp-cli` package ships one bundled **Agent Skill** — a portable instruction set that teaches AI coding agents how to use the Tauri MCP CLI correctly. The skill covers session lifecycle, UI automation, screenshots and inspection, IPC debugging, daemon recovery, and mobile workflows in one place.

Skills work with **40+ agents** including Claude Code, Cursor, Copilot, Windsurf, Gemini CLI, OpenCode, Cline, and others.

## Install with `npx skills` (Recommended)

The [skills](https://www.npmjs.com/package/skills) CLI from [skills.sh](https://skills.sh) is the easiest way to install:

```bash
# Interactive — choose which skills and agents to target
npx skills add hypothesi/mcp-server-tauri

# Install the bundled skill for Claude Code, no prompts
npx skills add hypothesi/mcp-server-tauri -a claude-code --all -y

# Install to a specific agent globally (applies to every project)
npx skills add hypothesi/mcp-server-tauri -g -a cursor --all -y
```

### Useful options

| Flag | Description |
|------|-------------|
| `-a <agent>` | Target a specific agent (`claude-code`, `cursor`, `copilot`, etc.) |
| `-g` | Install globally (user-level, all projects) |
| `--all` | Install every published skill from the package |
| `-y` | Skip interactive prompts |
| `-l` / `--list` | Preview available skills before installing |

```bash
# Preview available skills
npx skills add hypothesi/mcp-server-tauri --list
```

## Available Skill

| Skill | Description |
|-------|-------------|
| `tauri-mcp-cli` | One bundled skill covering session management, UI interaction, screenshots and inspection, IPC/backend workflows, and mobile or remote device usage |

## Alternative: Install via npm + intent

If you prefer not to use `npx skills`, you can install the CLI package and wire the bundled skill with the `@tanstack/intent` tool:

```bash
npm install -g @hypothesi/tauri-mcp-cli
npx @tanstack/intent@latest install
```

This scans the installed package's `skills/` directory and wires the bundled skill into your agent configuration files (`CLAUDE.md`, `.cursorrules`, etc.).

## Alternative: Claude Code Plugin

If you use Claude Code, you can install the bundled skill as a Claude Code Plugin instead:

```bash
/plugin marketplace add hypothesi/mcp-server-tauri
/plugin install tauri-mcp-cli
```

See [Claude Code Plugin](/guides/claude-code-plugin) for details.

## Skill Format

Each skill is a directory containing a `SKILL.md` with YAML frontmatter:

```yaml
---
name: tauri-mcp-cli
description: Use the Tauri MCP CLI to automate and debug Tauri apps from terminal commands...
license: MIT
---

# Instructions for the agent...
```

Skills follow the [open Agent Skills specification](https://skills.sh/docs) and are compatible with any agent that supports the format.

## Managing Installed Skills

```bash
# List installed skills
npx skills list

# Update all skills to latest
npx skills update

# Remove the bundled skill
npx skills remove tauri-mcp-cli
```

## Further Reading

- [skills.sh documentation](https://skills.sh/docs)
- [CLI Usage Guide](/guides/cli)
- [Vercel Agent Skills spec](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context)
