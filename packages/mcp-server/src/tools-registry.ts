/**
 * Single source of truth for all MCP tool definitions
 * This file defines all available tools and their metadata
 */

import { z } from 'zod';
import { listDevices, ListDevicesSchema } from './manager/mobile.js';
import {
   manageDriverSession,
   ManageDriverSessionSchema,
} from './driver/session-manager.js';
import { readLogs, ReadLogsSchema } from './monitor/logs.js';
import {
   executeIPCCommand,
   manageIPCMonitoring, getIPCEvents, emitTestEvent, getBackendState,
   manageWindow,
   ExecuteIPCCommandSchema,
   ManageIPCMonitoringSchema, GetIPCEventsSchema, EmitTestEventSchema,
   GetBackendStateSchema, ManageWindowSchema,
} from './driver/plugin-commands.js';
import {
   interact, screenshot, keyboard, waitFor, getStyles,
   executeJavaScript, findElement, domSnapshot,
   InteractSchema, ScreenshotSchema, KeyboardSchema,
   WaitForSchema, GetStylesSchema, ExecuteJavaScriptSchema,
   FindElementSchema, DomSnapshotSchema,
} from './driver/webview-interactions.js';
import { PLUGIN_VERSION_CARGO } from './version.js';

/**
 * Standard multi-app description for webview tools.
 */
const MULTI_APP_DESC = 'Targets the only connected app, or the default app if multiple are connected. ' +
   'Specify appIdentifier (port or bundle ID) to target a specific app.';

/**
 * Content types that tools can return.
 * Text content is the default, image content is used for screenshots.
 */
export interface TextContent {
   type: 'text';
   text: string;
}

export interface ImageContent {
   type: 'image';
   data: string; // Base64-encoded image data (without data URL prefix)
   mimeType: string; // e.g., 'image/png' or 'image/jpeg'
}

export type ToolContent = TextContent | ImageContent;

/**
 * Tool result can be a string (legacy, converted to TextContent) or structured content.
 */
export type ToolResult = string | ToolContent | ToolContent[];

export type ToolHandler = (args: unknown) => Promise<ToolResult>;

/**
 * Tool annotations that help the AI understand when and how to use tools.
 * These follow the MCP specification for ToolAnnotations.
 */
export interface ToolAnnotations {
   // Human-readable title for display
   title?: string;

   // If true, the tool does not modify its environment (default: false)
   readOnlyHint?: boolean;

   // If true, the tool may perform destructive updates (default: true)
   destructiveHint?: boolean;

   // If true, calling repeatedly with same args has no additional effect
   idempotentHint?: boolean;

   // If true, tool interacts with external systems (default: true)
   openWorldHint?: boolean;
}

export interface ToolDefinition {
   name: string;
   description: string;
   category: string;
   schema: z.ZodSchema;
   handler: ToolHandler;
   annotations?: ToolAnnotations;
}

/**
 * Tool categories for organization
 */
export const TOOL_CATEGORIES = {
   SETUP: 'Setup & Configuration',
   MOBILE_DEVELOPMENT: 'Mobile Development',
   UI_AUTOMATION: 'UI Automation & WebView Interaction',
   IPC_PLUGIN: 'IPC & Plugin Tools (via MCP Bridge)',
} as const;

// Setup instructions for the MCP Bridge plugin
const SETUP_INSTRUCTIONS = `# MCP Bridge Plugin Setup Instructions

Use these instructions to set up or update the MCP Bridge plugin in a Tauri v2 project.

## IMPORTANT: Do Not Act Without Permission

**You must NOT make any changes to files without the user's explicit approval.**

1. First, examine the project to understand its current state
2. Then, present a clear summary of what changes are needed
3. Wait for user approval before making ANY modifications
4. Only proceed with changes after they confirm

## Prerequisites Check

First, verify this is a Tauri v2 project:
- Look for \`src-tauri/\` directory and \`tauri.conf.json\`
- If this is NOT a Tauri project, stop and let the user know this setup only applies to Tauri apps

## What to Check

Examine these files and report what needs to be added or updated:

### 1. Rust Plugin Dependency

Check \`src-tauri/Cargo.toml\` for \`tauri-plugin-mcp-bridge\`.
It should be an **optional** dependency behind a Cargo feature
so that it is completely excluded from production builds:

\`\`\`toml
[dependencies]
tauri-plugin-mcp-bridge = { version = "${PLUGIN_VERSION_CARGO}", optional = true }
\`\`\`

Under \`[features]\`, add a feature that enables it:

\`\`\`toml
[features]
mcp-bridge = ["dep:tauri-plugin-mcp-bridge"]
\`\`\`

### 2. Plugin Registration

Check \`src-tauri/src/lib.rs\` or \`src-tauri/src/main.rs\` for plugin
registration. It should be gated behind the \`mcp-bridge\` feature flag:

\`\`\`rust
#[cfg(all(feature = "mcp-bridge", debug_assertions))]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}
\`\`\`

### 3. Global Tauri Setting

Check \`src-tauri/tauri.conf.json\` for \`withGlobalTauri: true\` under the \`app\` section.
**This is required** - without it, the MCP bridge cannot communicate with the webview.

This setting should only be enabled for development. If the project
uses a \`tauri.dev.conf.json\` overlay (applied only during
\`cargo tauri dev\`), prefer placing it there:

\`\`\`json
{
   "app": {
      "withGlobalTauri": true
   }
}
\`\`\`

### 4. Plugin Capability (Conditional via build.rs)

The \`mcp-bridge:default\` permission must **not** be added to
\`src-tauri/capabilities/default.json\`. Instead, it should be
conditionally generated by the build script so that it only exists
when the \`mcp-bridge\` feature is active.

Check \`src-tauri/build.rs\` and update it to conditionally write
(or remove) a separate capability file before
\`tauri_build::build()\` runs. Tauri auto-discovers all \`.json\`
files in \`capabilities/\`, so this ensures the permission is only
present when the feature is enabled:

\`\`\`rust
fn main() {
   let mcp_cap_path = std::path::Path::new("capabilities/mcp-bridge.json");
   #[cfg(all(feature = "mcp-bridge", debug_assertions))]
   {
      let cap = r#"{
   "identifier": "mcp-bridge",
   "description": "enables MCP bridge for development",
   "windows": [
      "main"
   ],
   "permissions": [
      "mcp-bridge:default"
   ]
}"#;
      std::fs::write(mcp_cap_path, cap)
         .expect("failed to write mcp-bridge capability");
   }
   #[cfg(not(all(feature = "mcp-bridge", debug_assertions)))]
   {
      let _ = std::fs::remove_file(mcp_cap_path);
   }

   tauri_build::build()
}
\`\`\`

If \`build.rs\` already has other logic, integrate the conditional
block before the \`tauri_build::build()\` call.

### 5. Gitignore the Generated Capability File

Since \`capabilities/mcp-bridge.json\` is generated at build time, add it to \`src-tauri/.gitignore\`:

\`\`\`gitignore
/capabilities/mcp-bridge.json
\`\`\`

### 6. Dev Scripts (package.json)

If the project uses npm scripts to run \`tauri dev\`, add
\`--features mcp-bridge\` to the dev scripts so the feature is
automatically enabled. For example:

\`\`\`json
{
   "scripts": {
      "dev": "tauri dev --features mcp-bridge",
      "dev:ios": "tauri ios dev --features mcp-bridge",
      "dev:android": "tauri android dev --features mcp-bridge"
   }
}
\`\`\`

Do **not** add \`--features mcp-bridge\` to release-profile dev
scripts (e.g. those using \`--release\`), as \`debug_assertions\`
is false in release builds and the guard will exclude the plugin
anyway.

## Response Format

After examining the project, respond with:

1. **Current State**: What's already configured correctly
2. **Changes Needed**: A numbered list of specific changes required
3. **Ask for Permission**: "May I proceed with these changes?"

Only after the user says yes should you make any modifications.

## After Setup

Once changes are approved and made:
1. Run the Tauri app in development mode — if npm scripts were
   updated, use \`npm run dev\`. Otherwise use
   \`cargo tauri dev --features mcp-bridge\` directly.
2. Use \`driver_session\` with action "start" to connect
3. Use \`driver_session\` with action "status" to verify

## Notes

- The plugin is completely excluded from production builds — both
  \`cfg(feature = "mcp-bridge")\` and \`cfg(debug_assertions)\` must
  be true, so even if the feature flag is accidentally enabled in a
  release build, the plugin will not be included
- The \`mcp-bridge\` Cargo feature must be passed explicitly — either via npm dev scripts or \`cargo tauri dev --features mcp-bridge\`
- The WebSocket server binds to \`0.0.0.0:9223\` by default
- For localhost-only access, use \`Builder::new().bind_address("127.0.0.1").build()\`
`;

/**
 * Complete registry of all available tools
 * This is the single source of truth for tool definitions
 */
export const TOOLS: ToolDefinition[] = [
   // Setup & Configuration Tools
   {
      name: 'get_setup_instructions',
      description:
         'Get instructions for setting up or updating the MCP Bridge plugin in a Tauri project. ' +
         'Call this tool when: (1) driver_session fails to connect, (2) you detect the plugin ' +
         'is not installed or outdated, or (3) the user asks about setup. ' +
         'Returns step-by-step guidance that you should follow to help the user configure their project. ' +
         'IMPORTANT: The instructions require you to examine the project first and ask for permission ' +
         'before making any changes.',
      category: TOOL_CATEGORIES.SETUP,
      schema: z.object({}),
      annotations: {
         title: 'Get Setup Instructions',
         readOnlyHint: true,
         destructiveHint: false,
         idempotentHint: true,
         openWorldHint: false,
      },
      handler: async () => {
         return SETUP_INSTRUCTIONS;
      },
   },

   // Mobile Development Tools
   {
      name: 'list_devices',
      description:
         '[Tauri Mobile Apps Only] List Android emulators/devices and iOS simulators. ' +
         'Use for Tauri mobile development (tauri android dev, tauri ios dev). ' +
         'Not needed for desktop-only Tauri apps or web projects.',
      category: TOOL_CATEGORIES.MOBILE_DEVELOPMENT,
      schema: ListDevicesSchema,
      annotations: {
         title: 'List Mobile Devices',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async () => {
         const devices = await listDevices();

         return `Android Devices:\n${devices.android.join('\n') || 'None'}\n\niOS Booted Simulators:\n${devices.ios.join('\n') || 'None'}`;
      },
   },

   // UI Automation Tools
   {
      name: 'driver_session',
      description:
         '[Tauri Apps Only] Start/stop automation session to connect to a RUNNING Tauri app. ' +
         'Supports multiple concurrent app connections - each app runs on a unique port. ' +
         'The most recently connected app becomes the "default" app used when no appIdentifier is specified. ' +
         'Use action "status" to check connection state: returns single app format when 1 app connected, ' +
         'or array format with "isDefault" indicator when multiple apps connected. ' +
         'Action "stop" without appIdentifier stops ALL sessions; with appIdentifier stops only that app. ' +
         'The identifier field (e.g., "com.example.myapp") uniquely identifies each app. ' +
         'REQUIRED before using other webview_* or ipc_* tools. ' +
         'Connects via WebSocket to the MCP Bridge plugin in the Tauri app. ' +
         'For browser automation, use Chrome DevTools MCP instead. ' +
         'For Electron apps, this tool will NOT work.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ManageDriverSessionSchema,
      annotations: {
         title: 'Manage Tauri Session',
         readOnlyHint: false,
         destructiveHint: false,
         idempotentHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ManageDriverSessionSchema.parse(args);

         return await manageDriverSession(parsed.action, parsed.host, parsed.port, parsed.appIdentifier);
      },
   },

   {
      name: 'webview_find_element',
      description:
         '[Tauri Apps Only] Find DOM elements in a running Tauri app\'s webview. ' +
         'Requires active driver_session. ' +
         MULTI_APP_DESC + ' ' +
         'For browser pages or documentation sites, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: FindElementSchema,
      annotations: {
         title: 'Find Element in Tauri Webview',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = FindElementSchema.parse(args);

         return await findElement({
            selector: parsed.selector,
            strategy: parsed.strategy,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'read_logs',
      description:
         '[Tauri Apps Only] Read logs from various sources: "console" for webview JS logs, ' +
         '"android" for logcat, "ios" for simulator logs, "system" for desktop logs. ' +
         'Requires active driver_session for console logs. ' +
         'Use for debugging Tauri app issues at any level.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ReadLogsSchema,
      annotations: {
         title: 'Read Logs',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ReadLogsSchema.parse(args);

         return await readLogs(parsed);
      },
   },

   // WebView Interaction Tools
   {
      name: 'webview_interact',
      description:
         '[Tauri Apps Only] Click, scroll, swipe, focus, or perform gestures in a Tauri app webview. ' +
         'Supported actions: click, double-click, long-press, scroll, swipe, focus. ' +
         'Requires active driver_session. ' +
         'For browser interaction, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: InteractSchema,
      annotations: {
         title: 'Interact with Tauri Webview',
         readOnlyHint: false,
         destructiveHint: false,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = InteractSchema.parse(args);

         return await interact(parsed);
      },
   },

   {
      name: 'webview_screenshot',
      description:
         '[Tauri Apps Only] Screenshot a running Tauri app\'s webview. ' +
         'Requires active driver_session. Captures only visible viewport. ' +
         MULTI_APP_DESC + ' ' +
         'For browser screenshots, use Chrome DevTools MCP instead. ' +
         'For Electron apps, this will NOT work.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ScreenshotSchema,
      annotations: {
         title: 'Screenshot Tauri Webview',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ScreenshotSchema.parse(args);

         const result = await screenshot({
            quality: parsed.quality,
            format: parsed.format,
            windowId: parsed.windowId,
            filePath: parsed.filePath,
            appIdentifier: parsed.appIdentifier,
            maxWidth: parsed.maxWidth,
         });

         // If saved to file, return text confirmation
         if ('filePath' in result) {
            return `Screenshot saved to: ${result.filePath}`;
         }

         // Return the content array directly for proper image handling
         return result.content;
      },
   },

   {
      name: 'webview_keyboard',
      description:
         '[Tauri Apps Only] Type text or send keyboard events in a Tauri app. ' +
         'Requires active driver_session. ' +
         MULTI_APP_DESC + ' ' +
         'For browser keyboard input, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: KeyboardSchema,
      annotations: {
         title: 'Keyboard Input in Tauri',
         readOnlyHint: false,
         destructiveHint: false,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = KeyboardSchema.parse(args);

         if (parsed.action === 'type') {
            return await keyboard({
               action: parsed.action,
               selectorOrKey: parsed.selector,
               textOrModifiers: parsed.text,
               windowId: parsed.windowId,
               appIdentifier: parsed.appIdentifier,
            });
         }
         return await keyboard({
            action: parsed.action,
            selectorOrKey: parsed.key,
            textOrModifiers: parsed.modifiers,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'webview_wait_for',
      description:
         '[Tauri Apps Only] Wait for elements, text, or IPC events in a Tauri app. ' +
         'Requires active driver_session. ' +
         MULTI_APP_DESC + ' ' +
         'For browser waits, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: WaitForSchema,
      annotations: {
         title: 'Wait for Condition in Tauri',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = WaitForSchema.parse(args);

         return await waitFor({
            type: parsed.type,
            value: parsed.value,
            timeout: parsed.timeout,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'webview_get_styles',
      description:
         '[Tauri Apps Only] Get computed CSS styles from elements in a Tauri app. ' +
         'Requires active driver_session. ' +
         MULTI_APP_DESC + ' ' +
         'For browser style inspection, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: GetStylesSchema,
      annotations: {
         title: 'Get Styles in Tauri Webview',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = GetStylesSchema.parse(args);

         return await getStyles({
            selector: parsed.selector,
            properties: parsed.properties,
            multiple: parsed.multiple,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'webview_execute_js',
      description:
         '[Tauri Apps Only] Execute JavaScript in a Tauri app\'s webview context. ' +
         'Requires active driver_session. Has access to window.__TAURI__. ' +
         'If you need a return value, it must be JSON-serializable. ' +
         'For functions that return values, use an IIFE: "(() => { return 5; })()" not "() => { return 5; }". ' +
         MULTI_APP_DESC + ' ' +
         'For browser JS execution, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ExecuteJavaScriptSchema,
      annotations: {
         title: 'Execute JS in Tauri Webview',
         readOnlyHint: false,
         destructiveHint: false,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ExecuteJavaScriptSchema.parse(args);

         return await executeJavaScript({
            script: parsed.script,
            args: parsed.args,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'webview_dom_snapshot',
      description:
         '[Tauri Apps Only] Get a structured DOM snapshot of a Tauri app\'s webview. ' +
         'Supports different snapshot types for AI consumption. ' +
         'The "accessibility" type returns a YAML representation of the accessibility tree ' +
         'similar to Playwright\'s aria snapshots, including roles, names, states, and element refs. ' +
         'Use this for understanding UI semantics, finding interactive elements, or accessibility testing. ' +
         'The "structure" type returns a YAML representation of the DOM hierarchy ' +
         'with element tag names, IDs, CSS classes, and data-testid attributes (if present). ' +
         'Use this for understanding page layout, debugging CSS selectors, or locating elements by class/ID. ' +
         'Use the optional selector parameter to scope the snapshot to a subtree. ' +
         'Requires active driver_session. ' +
         MULTI_APP_DESC,
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: DomSnapshotSchema,
      annotations: {
         title: 'DOM Snapshot',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = DomSnapshotSchema.parse(args);

         return await domSnapshot({
            type: parsed.type,
            selector: parsed.selector,
            windowId: parsed.windowId,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   // IPC & Plugin Tools
   {
      name: 'ipc_execute_command',
      description:
         '[Tauri Apps Only] Execute Tauri IPC commands (invoke Rust backend functions). ' +
         'Requires active driver_session. This is Tauri-specific IPC, not browser APIs. ' +
         'For Electron IPC or browser APIs, use appropriate tools for those frameworks.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: ExecuteIPCCommandSchema,
      annotations: {
         title: 'Execute Tauri IPC Command',
         readOnlyHint: false,
         destructiveHint: false,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ExecuteIPCCommandSchema.parse(args);

         return await executeIPCCommand({
            command: parsed.command,
            args: parsed.args,
            appIdentifier: parsed.appIdentifier,
         });
      },
   },

   {
      name: 'ipc_monitor',
      description:
         '[Tauri Apps Only] Monitor Tauri IPC calls between frontend and Rust backend. ' +
         'Requires active driver_session. Captures invoke() calls and responses. ' +
         'This is Tauri-specific; for browser network monitoring, use Chrome DevTools MCP.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: ManageIPCMonitoringSchema,
      annotations: {
         title: 'Monitor Tauri IPC',
         readOnlyHint: false,
         destructiveHint: false,
         idempotentHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ManageIPCMonitoringSchema.parse(args);

         return await manageIPCMonitoring(parsed.action, parsed.appIdentifier);
      },
   },

   {
      name: 'ipc_get_captured',
      description:
         '[Tauri Apps Only] Get captured Tauri IPC traffic (requires ipc_monitor started). ' +
         'Shows captured commands (invoke calls) and events with arguments and responses. ' +
         'For browser network requests, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: GetIPCEventsSchema,
      annotations: {
         title: 'Get Captured IPC Traffic',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = GetIPCEventsSchema.parse(args);

         return await getIPCEvents(parsed.filter, parsed.appIdentifier);
      },
   },

   {
      name: 'ipc_emit_event',
      description:
         '[Tauri Apps Only] Emit a Tauri event to test event handlers. ' +
         'Requires active driver_session. Events are Tauri-specific (not DOM events). ' +
         'For browser DOM events, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: EmitTestEventSchema,
      annotations: {
         title: 'Emit Tauri Event',
         readOnlyHint: false,
         destructiveHint: false,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = EmitTestEventSchema.parse(args);

         return await emitTestEvent(parsed.eventName, parsed.payload, parsed.appIdentifier);
      },
   },

   {
      name: 'ipc_get_backend_state',
      description:
         '[Tauri Apps Only] Get Tauri backend state: app metadata, Tauri version, environment. ' +
         'Requires active driver_session. ' +
         'Use to verify you\'re connected to a Tauri app and get app info.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: GetBackendStateSchema,
      annotations: {
         title: 'Get Tauri Backend State',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = GetBackendStateSchema.parse(args);

         return await getBackendState({ appIdentifier: parsed.appIdentifier });
      },
   },

   // Window Management Tools
   {
      name: 'manage_window',
      description:
         '[Tauri Apps Only] Manage Tauri windows. Actions: ' +
         '"list" - List all windows with labels, titles, URLs, and state. ' +
         '"info" - Get detailed info for a window (size, position, title, focus, visibility). ' +
         '"resize" - Resize a window (requires width/height, uses logical pixels by default). ' +
         'Requires active driver_session. ' +
         'For browser windows, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ManageWindowSchema,
      annotations: {
         title: 'Manage Tauri Window',
         readOnlyHint: false,
         destructiveHint: false,
         idempotentHint: true,
         openWorldHint: false,
      },
      handler: async (args) => {
         const parsed = ManageWindowSchema.parse(args);

         return await manageWindow(parsed);
      },
   },
];

/**
 * Get all tool names for type checking
 */
export type ToolName = typeof TOOLS[number]['name'];

/**
 * Get tools grouped by category
 */
export function getToolsByCategory(): Record<string, ToolDefinition[]> {
   const grouped: Record<string, ToolDefinition[]> = {};

   for (const tool of TOOLS) {
      if (!grouped[tool.category]) {
         grouped[tool.category] = [];
      }
      grouped[tool.category].push(tool);
   }

   return grouped;
}

/**
 * Get total tool count
 */
export function getToolCount(): number {
   return TOOLS.length;
}

/**
 * Create a Map for fast tool lookup by name
 */
export const TOOL_MAP = new Map(TOOLS.map((tool) => { return [ tool.name, tool ]; }));
