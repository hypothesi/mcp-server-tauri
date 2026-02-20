/**
 * WebSocket protocol types for communication between MCP server and Tauri plugin
 *
 * This file defines the message format for the WebSocket-based communication
 * between the Node.js MCP server and the Rust Tauri plugin.
 */

/** Commands that can be sent to the Tauri plugin */
export type PluginCommandType =
   | 'execute_command'
   | 'get_window_info'
   | 'get_backend_state'
   | 'emit_event'
   | 'start_ipc_monitor'
   | 'stop_ipc_monitor'
   | 'get_ipc_events'
   | 'execute_js'
   | 'capture_native_screenshot';

/** Request message sent from MCP server to Tauri plugin */
export interface PluginRequest {
   id: string;
   command: PluginCommandType;
   args?: unknown;
}

/** Response message sent from Tauri plugin to MCP server */
export interface PluginResponse {
   id: string;
   success: boolean;
   data?: unknown;
   error?: string;
}

/** Event broadcast from Tauri plugin (not in response to a request) */
export interface PluginEvent {
   type: 'ipc_event' | 'console_log' | 'error' | 'element_picked' | 'element_pointed';
   payload: unknown;
   timestamp?: string;
}

/** Structured info about a parent element in the DOM ancestry */
export interface ParentElementInfo {
   tag: string;
   id: string | null;
   classes: string[];
   boundingRect: {
      x: number;
      y: number;
      width: number;
      height: number;
   };
}

/** Metadata collected about a picked/pointed DOM element */
export interface ElementMetadata {
   tag: string;
   id: string | null;
   classes: string[];
   attributes: Record<string, string>;
   textContent: string;
   boundingRect: {
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
   };
   cssSelector: string;
   xpath: string;
   computedStyles: Record<string, string>;
   parentChain: ParentElementInfo[];
   timestamp: number;
}

/** Broadcast message for element picker events */
export interface ElementPickerBroadcast {
   type: 'element_picked' | 'element_pointed';
   payload: {
      pickerId?: string;
      element?: ElementMetadata;
      cancelled?: boolean;
   };
}

/** IPC event captured by the monitor */
export interface IPCEvent {
   command: string;
   args?: unknown;
   response?: unknown;
   duration?: number;
   timestamp: string;
}

/** Window information returned by get_window_info */
export interface WindowInfo {
   width: number;
   height: number;
   x: number;
   y: number;
   title: string;
   focused: boolean;
   visible: boolean;
}

/** Backend state returned by get_backend_state */
export interface BackendState {
   app: {
      name: string;
      identifier: string;
      version: string;
   };
   tauri: {
      version: string;
   };
   environment: {
      debug: boolean;
      os: string;
      arch: string;
      family: string;
   };
   windows: Array<{
      label: string;
      title: string;
      focused: boolean;
      visible: boolean;
   }>;
   window_count: number;
   timestamp: number;
}

/** Console log entry */
export interface ConsoleLogEntry {
   level: 'log' | 'info' | 'warn' | 'error' | 'debug';
   message: string;
   timestamp: string;
   source?: string;
}

/** Screenshot result */
export interface ScreenshotResult {
   data: string;
   format: 'png' | 'jpeg';
   width?: number;
   height?: number;
}
