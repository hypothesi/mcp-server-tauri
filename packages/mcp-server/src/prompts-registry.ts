/**
 * Single source of truth for all MCP prompt definitions
 * Prompts are user-controlled templates that appear as slash commands in MCP clients
 */

import { PLUGIN_VERSION_CARGO } from './version.js';

export interface PromptArgument {
   name: string;
   description: string;
   required?: boolean;
}

export interface PromptMessage {
   role: 'user' | 'assistant';
   content: {
      type: 'text';
      text: string;
   };
}

export interface PromptDefinition {
   name: string;
   description: string;
   arguments?: PromptArgument[];
   handler: (args: Record<string, string>) => PromptMessage[];
}

const FIX_WEBVIEW_ERRORS_PROMPT = `I need help finding and fixing JavaScript errors in my Tauri app's webview.

Please follow these steps:

1. **Start a session** - Use \`driver_session\` with action "start" to connect to the running Tauri app

2. **Get console logs** - Use \`read_logs\` with source "console" to retrieve JavaScript errors or warnings

3. **Analyze the errors** - Look at the error messages, stack traces, and identify:
   - What type of error it is (TypeError, ReferenceError, SyntaxError, etc.)
   - Which file and line number the error originates from
   - What the root cause might be

4. **Find the source code** - Use code search or file reading tools to locate the problematic code in my project

5. **Propose a fix** - Explain what's wrong and suggest a concrete fix for each error found

6. **Stop the session** - Use \`driver_session\` with action "stop" to clean up

If no errors are found, let me know the app is running cleanly.

If the session fails to start, help me troubleshoot the connection (is the app running? is the MCP bridge plugin installed?).`;

const SETUP_PROMPT = `Help me set up or update the MCP Bridge plugin in my Tauri project.

## IMPORTANT: Do Not Act Without Permission

**You must NOT make any changes to files without my explicit approval.**

1. First, examine my project to understand its current state
2. Then, present a clear summary of what changes are needed
3. Wait for my approval before making ANY modifications
4. Only proceed with changes after I confirm

## Prerequisites Check

First, verify this is a Tauri v2 project:
- Look for \`src-tauri/\` directory and \`tauri.conf.json\`
- If this is NOT a Tauri project, stop and let me know this setup only applies to Tauri apps

## What to Check

Examine these files and report what needs to be added or updated:

### 1. Rust Plugin Dependency
Check \`src-tauri/Cargo.toml\` for \`tauri-plugin-mcp-bridge\`. If missing or outdated, note that it needs:
\`\`\`toml
[dependencies]
tauri-plugin-mcp-bridge = "${PLUGIN_VERSION_CARGO}"
\`\`\`

### 2. Plugin Registration
Check \`src-tauri/src/lib.rs\` or \`src-tauri/src/main.rs\` for plugin registration. It should have:
\`\`\`rust
#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}
\`\`\`

### 3. Global Tauri Setting
Check \`src-tauri/tauri.conf.json\` for \`withGlobalTauri: true\` under the \`app\` section.
**This is required** - without it, the MCP bridge cannot communicate with the webview.

### 4. Plugin Permissions
Check \`src-tauri/capabilities/default.json\` (or similar) for \`"mcp-bridge:default"\` permission.

## Your Response Format

After examining the project, respond with:

1. **Current State**: What's already configured correctly
2. **Changes Needed**: A numbered list of specific changes required
3. **Ask for Permission**: "May I proceed with these changes?"

Only after I say yes should you make any modifications.

## After Setup

Once changes are approved and made:
1. Run the Tauri app in development mode (\`cargo tauri dev\`)
2. Use \`driver_session\` with action "start" to connect
3. Use \`driver_session\` with action "status" to verify

## Notes

- The plugin only runs in debug builds so it won't affect production
- The WebSocket server binds to \`0.0.0.0:9223\` by default
- For localhost-only access, use \`Builder::new().bind_address("127.0.0.1").build()\``;

/**
 * Complete registry of all available prompts
 */
export const PROMPTS: PromptDefinition[] = [
   {
      name: 'fix-webview-errors',
      description:
         '[Tauri Apps Only] Find and fix JavaScript errors in a running Tauri app. ' +
         'Use ONLY for Tauri projects (with src-tauri/ and tauri.conf.json). ' +
         'For browser debugging, use Chrome DevTools MCP instead. ' +
         'For Electron apps, this prompt will NOT work.',
      arguments: [],
      handler: () => {
         return [
            {
               role: 'user',
               content: {
                  type: 'text',
                  text: FIX_WEBVIEW_ERRORS_PROMPT,
               },
            },
         ];
      },
   },

   {
      name: 'setup',
      description:
         'Set up or update the MCP Bridge plugin in a Tauri project. ' +
         'Examines the project, reports what changes are needed, and asks for permission before ' +
         'making any modifications. Use for initial setup or to update to the latest version.',
      arguments: [],
      handler: () => {
         return [
            {
               role: 'user',
               content: {
                  type: 'text',
                  text: SETUP_PROMPT,
               },
            },
         ];
      },
   },
];

/**
 * Create a Map for fast prompt lookup by name
 */
export const PROMPT_MAP = new Map(PROMPTS.map((prompt) => { return [ prompt.name, prompt ]; }));
