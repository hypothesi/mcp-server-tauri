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
   listWindows,
   ExecuteIPCCommandSchema,
   ManageIPCMonitoringSchema, GetIPCEventsSchema, EmitTestEventSchema,
   GetBackendStateSchema, ListWindowsSchema,
} from './driver/plugin-commands.js';
import {
   interact, screenshot, keyboard, waitFor, getStyles,
   executeJavaScript, findElement,
   InteractSchema, ScreenshotSchema, KeyboardSchema,
   WaitForSchema, GetStylesSchema, ExecuteJavaScriptSchema,
   FindElementSchema,
} from './driver/webview-interactions.js';

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
   MOBILE_DEVELOPMENT: 'Mobile Development',
   UI_AUTOMATION: 'UI Automation & WebView Interaction',
   IPC_PLUGIN: 'IPC & Plugin Tools (via MCP Bridge)',
} as const;

/**
 * Complete registry of all available tools
 * This is the single source of truth for tool definitions
 */
export const TOOLS: ToolDefinition[] = [
   // Mobile Development Tools
   {
      name: 'tauri_list_devices',
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
      name: 'tauri_driver_session',
      description:
         '[Tauri Apps Only] Start/stop automation session to connect to a RUNNING Tauri app. ' +
         'Use action "status" to check current connection state. ' +
         'REQUIRED before using other tauri_webview_* or tauri_plugin_* tools. ' +
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

         return await manageDriverSession(parsed.action, parsed.host, parsed.port);
      },
   },

   {
      name: 'tauri_webview_find_element',
      description:
         '[Tauri Apps Only] Find DOM elements in a running Tauri app\'s webview. ' +
         'Requires active tauri_driver_session. ' +
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
         });
      },
   },

   {
      name: 'tauri_read_logs',
      description:
         '[Tauri Apps Only] Read logs from various sources: "console" for webview JS logs, ' +
         '"android" for logcat, "ios" for simulator logs, "system" for desktop logs. ' +
         'Requires active tauri_driver_session for console logs. ' +
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
      name: 'tauri_webview_interact',
      description:
         '[Tauri Apps Only] Click, scroll, swipe, focus, or perform gestures in a Tauri app webview. ' +
         'Supported actions: click, double-click, long-press, scroll, swipe, focus. ' +
         'Requires active tauri_driver_session. ' +
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
      name: 'tauri_webview_screenshot',
      description:
         '[Tauri Apps Only] Screenshot a running Tauri app\'s webview. ' +
         'Requires active tauri_driver_session. Captures only visible viewport. ' +
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
      name: 'tauri_webview_keyboard',
      description:
         '[Tauri Apps Only] Type text or send keyboard events in a Tauri app. ' +
         'Requires active tauri_driver_session. ' +
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
            });
         }
         return await keyboard({
            action: parsed.action,
            selectorOrKey: parsed.key,
            textOrModifiers: parsed.modifiers,
            windowId: parsed.windowId,
         });
      },
   },

   {
      name: 'tauri_webview_wait_for',
      description:
         '[Tauri Apps Only] Wait for elements, text, or IPC events in a Tauri app. ' +
         'Requires active tauri_driver_session. ' +
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
         });
      },
   },

   {
      name: 'tauri_webview_get_styles',
      description:
         '[Tauri Apps Only] Get computed CSS styles from elements in a Tauri app. ' +
         'Requires active tauri_driver_session. ' +
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
         });
      },
   },

   {
      name: 'tauri_webview_execute_js',
      description:
         '[Tauri Apps Only] Execute JavaScript in a Tauri app\'s webview context. ' +
         'Requires active tauri_driver_session. Has access to window.__TAURI__. ' +
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
         });
      },
   },

   // IPC & Plugin Tools
   {
      name: 'tauri_ipc_execute_command',
      description:
         '[Tauri Apps Only] Execute Tauri IPC commands (invoke Rust backend functions). ' +
         'Requires active tauri_driver_session. This is Tauri-specific IPC, not browser APIs. ' +
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

         return await executeIPCCommand(parsed.command, parsed.args);
      },
   },

   {
      name: 'tauri_ipc_monitor',
      description:
         '[Tauri Apps Only] Monitor Tauri IPC calls between frontend and Rust backend. ' +
         'Requires active tauri_driver_session. Captures invoke() calls and responses. ' +
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

         return await manageIPCMonitoring(parsed.action);
      },
   },

   {
      name: 'tauri_ipc_get_captured',
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

         return await getIPCEvents(parsed.filter);
      },
   },

   {
      name: 'tauri_ipc_emit_event',
      description:
         '[Tauri Apps Only] Emit a Tauri event to test event handlers. ' +
         'Requires active tauri_driver_session. Events are Tauri-specific (not DOM events). ' +
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

         return await emitTestEvent(parsed.eventName, parsed.payload);
      },
   },

   {
      name: 'tauri_ipc_get_backend_state',
      description:
         '[Tauri Apps Only] Get Tauri backend state: app metadata, Tauri version, environment. ' +
         'Requires active tauri_driver_session. ' +
         'Use to verify you\'re connected to a Tauri app and get app info.',
      category: TOOL_CATEGORIES.IPC_PLUGIN,
      schema: GetBackendStateSchema,
      annotations: {
         title: 'Get Tauri Backend State',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async () => {
         return await getBackendState();
      },
   },

   // Window Management Tools
   {
      name: 'tauri_list_windows',
      description:
         '[Tauri Apps Only] List all Tauri webview windows with details including ' +
         'labels, titles, URLs, and state (focused, visible, isMain). ' +
         'Requires active tauri_driver_session. Use to discover windows before targeting them. ' +
         'For browser tabs/windows, use Chrome DevTools MCP instead.',
      category: TOOL_CATEGORIES.UI_AUTOMATION,
      schema: ListWindowsSchema,
      annotations: {
         title: 'List Tauri Windows',
         readOnlyHint: true,
         openWorldHint: false,
      },
      handler: async () => {
         return await listWindows();
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
