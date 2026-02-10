import { z } from 'zod';
import { connectPlugin } from './plugin-client.js';
import { hasActiveSession, getDefaultSession, resolveTargetApp } from './session-manager.js';
import { createMcpLogger } from '../logger.js';
import {
   buildScreenshotScript,
   buildScreenshotCaptureScript,
   getHtml2CanvasSource,
   HTML2CANVAS_SCRIPT_ID,
} from './scripts/html2canvas-loader.js';
import { registerScript, isScriptRegistered } from './script-manager.js';
import { getResolveRefSource, RESOLVE_REF_SCRIPT_ID } from './scripts/index.js';

/**
 * WebView Executor - Native IPC-based JavaScript execution
 *
 * This module provides native Tauri IPC-based execution,
 * enabling cross-platform support (Linux, Windows, macOS) without external dependencies.
 *
 * Communication flow:
 * MCP Server (Node.js) → plugin-client (WebSocket) → mcp-bridge plugin → Tauri Webview
 */

// ============================================================================
// Auto-Initialization System
// ============================================================================

let isInitialized = false;

const driverLogger = createMcpLogger('DRIVER');

/**
 * Ensures the MCP server is fully initialized and ready to use.
 * This is called automatically by all tool functions.
 *
 * Initialization includes:
 * - Verifying an active session exists (via driver_session)
 * - Connecting to the plugin WebSocket using session config
 * - Console capture is already initialized by bridge.js in the Tauri app
 *
 * This function is idempotent - calling it multiple times is safe.
 *
 * @throws Error if no session is active (driver_session must be called first)
 */
export async function ensureReady(): Promise<void> {
   if (isInitialized) {
      return;
   }

   // Require an active session to prevent connecting to wrong app
   if (!hasActiveSession()) {
      throw new Error(
         'No active session. Call driver_session with action "start" first to connect to a Tauri app.'
      );
   }

   // Get default session for initial connection
   const session = getDefaultSession();

   if (session) {
      await connectPlugin(session.host, session.port);
   }

   // Register the resolve-ref helper so ref-based selectors work in all tools
   await registerScript(RESOLVE_REF_SCRIPT_ID, 'inline', getResolveRefSource());

   isInitialized = true;
}

/**
 * Reset initialization state (useful for testing or reconnecting).
 */
export function resetInitialization(): void {
   isInitialized = false;
}

// ============================================================================
// Core Execution Functions
// ============================================================================

export interface ExecuteInWebviewResult {
   result: string;
   windowLabel: string;
   warning?: string;
}

/**
 * Execute JavaScript in the Tauri webview using native IPC via WebSocket.
 *
 * @param script - JavaScript code to execute in the webview context
 * @param windowId - Optional window label to target (defaults to "main")
 * @param appIdentifier - Optional app identifier to target specific app
 * @returns Result of the script execution with window context
 */
export async function executeInWebview(script: string, windowId?: string, appIdentifier?: string | number): Promise<string> {
   const { result } = await executeInWebviewWithContext(script, windowId, appIdentifier);

   return result;
}

/**
 * Execute JavaScript in the Tauri webview and return window context.
 *
 * @param script - JavaScript code to execute in the webview context
 * @param windowId - Optional window label to target (defaults to "main")
 * @param appIdentifier - Optional app identifier to target specific app
 * @returns Result of the script execution with window context
 */
export async function executeInWebviewWithContext(
   script: string,
   windowId?: string,
   appIdentifier?: string | number
): Promise<ExecuteInWebviewResult> {
   try {
      // Ensure we're fully initialized
      await ensureReady();

      // Resolve target session
      const session = resolveTargetApp(appIdentifier);

      const client = session.client;

      // Send script directly - Rust handles wrapping and IPC callbacks.
      // Use 7s timeout (longer than Rust's 5s) so errors return before Node times out.
      const response = await client.sendCommand({
         command: 'execute_js',
         args: { script, windowLabel: windowId },
      }, 7000);

      if (!response.success) {
         throw new Error(response.error || 'Unknown execution error');
      }

      // Extract window context from response
      const windowContext = response.windowContext;

      // Parse and return the result
      const data = response.data;

      let result: string;

      if (data === null || data === undefined) {
         result = 'null';
      } else if (typeof data === 'string') {
         result = data;
      } else {
         result = JSON.stringify(data);
      }

      return {
         result,
         windowLabel: windowContext?.windowLabel || 'main',
         warning: windowContext?.warning,
      };
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`WebView execution failed: ${message}`);
   }
}

/**
 * Execute async JavaScript in the webview with timeout support.
 *
 * @param script - JavaScript code to execute (can use await)
 * @param windowId - Optional window label to target (defaults to "main")
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Result of the script execution
 */
export async function executeAsyncInWebview(script: string, windowId?: string, timeout = 5000): Promise<string> {
   const wrappedScript = `
      return (async () => {
         const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Script execution timeout')), ${timeout});
         });

         const scriptPromise = (async () => {
            ${script}
         })();

         return await Promise.race([scriptPromise, timeoutPromise]);
      })();
   `;

   return executeInWebview(wrappedScript, windowId);
}

// ============================================================================
// Console Log Capture System
// ============================================================================

/**
 * Initialize console log capture in the webview.
 * This intercepts console methods and stores logs in memory.
 *
 * NOTE: Console capture is now automatically initialized by bridge.js when the
 * Tauri app starts. This function is kept for backwards compatibility and will
 * simply return early if capture is already initialized.
 */
export async function initializeConsoleCapture(): Promise<string> {
   const script = `
      if (!window.__MCP_CONSOLE_LOGS__) {
         window.__MCP_CONSOLE_LOGS__ = [];
         const originalConsole = { ...console };

         ['log', 'debug', 'info', 'warn', 'error'].forEach(level => {
            console[level] = function(...args) {
               window.__MCP_CONSOLE_LOGS__.push({
                  level: level,
                  message: args.map(a => {
                     try {
                        return typeof a === 'object' ? JSON.stringify(a) : String(a);
                     } catch(e) {
                        return String(a);
                     }
                  }).join(' '),
                  timestamp: Date.now()
               });

               // Keep original console behavior
               originalConsole[level].apply(console, args);
            };
         });

         return 'Console capture initialized';
      }
      return 'Console capture already initialized';
   `;

   return executeInWebview(script);
}

/**
 * Retrieve captured console logs with optional filtering.
 *
 * @param filter - Optional regex pattern to filter log messages
 * @param since - Optional ISO timestamp to filter logs after this time
 * @param windowId - Optional window label to target (defaults to "main")
 * @param appIdentifier - Optional app identifier to target specific app
 * @returns Formatted console logs as string
 */
export async function getConsoleLogs(
   filter?: string,
   since?: string,
   windowId?: string,
   appIdentifier?: string | number
): Promise<string> {
   const filterStr = filter ? filter.replace(/'/g, '\\\'') : '';

   const sinceStr = since || '';

   const script = `
      const logs = window.__MCP_CONSOLE_LOGS__ || [];
      let filtered = logs;

      if ('${sinceStr}') {
         const sinceTime = new Date('${sinceStr}').getTime();
         filtered = filtered.filter(l => l.timestamp > sinceTime);
      }

      if ('${filterStr}') {
         try {
            const regex = new RegExp('${filterStr}', 'i');
            filtered = filtered.filter(l => regex.test(l.message));
         } catch(e) {
            throw new Error('Invalid filter regex: ' + e.message);
         }
      }

      return filtered.map(l =>
         '[ ' + new Date(l.timestamp).toISOString() + ' ] [ ' + l.level.toUpperCase() + ' ] ' + l.message
      ).join('\\n');
   `;

   return executeInWebview(script, windowId, appIdentifier);
}

/**
 * Clear all captured console logs.
 */
export async function clearConsoleLogs(): Promise<string> {
   const script = `
      window.__MCP_CONSOLE_LOGS__ = [];
      return 'Console logs cleared';
   `;

   return executeInWebview(script);
}

// ============================================================================
// Screenshot Functionality
// ============================================================================

import type { ToolContent } from '../tools-registry.js';

interface WindowContextInfo {
   windowLabel: string;
   totalWindows: number;
   warning?: string;
}

/**
 * Result of a screenshot capture, containing both image data and optional context.
 */
export interface ScreenshotResult {
   content: ToolContent[];
}

/**
 * Parse a data URL to extract the base64 data and mime type.
 */
function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
   const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);

   if (!match) {
      return null;
   }
   return { mimeType: match[1], data: match[2] };
}

/**
 * Build screenshot result with image content and optional text context.
 */
function buildScreenshotResult(dataUrl: string, method: string, windowContext?: WindowContextInfo): ScreenshotResult {
   const parsed = parseDataUrl(dataUrl);

   if (!parsed) {
      throw new Error(`Invalid data URL format: ${dataUrl.substring(0, 50)}...`);
   }

   const content: ToolContent[] = [];

   // Add context text if there's window info or warnings
   let contextText = `Screenshot captured via ${method}`;

   if (windowContext) {
      contextText += ` in window "${windowContext.windowLabel}"`;
      if (windowContext.warning) {
         contextText += `\n\n⚠️ ${windowContext.warning}`;
      }
   }
   content.push({ type: 'text', text: contextText });

   // Add the image content
   content.push({
      type: 'image',
      data: parsed.data,
      mimeType: parsed.mimeType,
   });

   return { content };
}

export interface CaptureScreenshotOptions {
   format?: 'png' | 'jpeg';
   quality?: number;
   windowId?: string;
   appIdentifier?: string | number;
   maxWidth?: number;
}

/**
 * Prepares the html2canvas script for screenshot capture.
 * Tries to use the script manager for persistence, falls back to inline injection.
 */
async function prepareHtml2canvasScript(format: 'png' | 'jpeg', quality: number): Promise<string> {
   try {
      // Check if html2canvas is already registered
      const isRegistered = await isScriptRegistered(HTML2CANVAS_SCRIPT_ID);

      if (!isRegistered) {
         // Register html2canvas via script manager for persistence across navigations
         const html2canvasSource = getHtml2CanvasSource();

         await registerScript(HTML2CANVAS_SCRIPT_ID, 'inline', html2canvasSource);
      }

      // Use the capture-only script since html2canvas is now registered
      return buildScreenshotCaptureScript(format, quality);
   } catch{
      // Script manager not available, fall back to inline injection
      return buildScreenshotScript(format, quality);
   }
}

/**
 * Capture a screenshot of the entire webview.
 *
 * @param options - Screenshot options (format, quality, windowId, appIdentifier, etc.)
 * @returns Screenshot result with image content
 */
export async function captureScreenshot(options: CaptureScreenshotOptions = {}): Promise<ScreenshotResult> {
   const { format = 'jpeg', quality = 80, windowId, appIdentifier, maxWidth } = options;

   // Primary implementation: Use native platform-specific APIs
   // - macOS: WKWebView takeSnapshot
   // - Windows: WebView2 CapturePreview
   // - Linux: Chromium/WebKit screenshot APIs
   try {
      // Ensure we're fully initialized
      await ensureReady();

      // Resolve target session
      const session = resolveTargetApp(appIdentifier);

      const client = session.client;

      // Use longer timeout (15s) for native screenshot - the Rust code waits up to 10s
      const response = await client.sendCommand({
         command: 'capture_native_screenshot',
         args: {
            format,
            quality,
            windowLabel: windowId,
            maxWidth,
         },
      }, 15000);

      if (!response.success || !response.data) {
         throw new Error(response.error || 'Native screenshot returned invalid data');
      }

      // The native command returns a base64 data URL
      const dataUrl = response.data as string;

      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
         throw new Error('Native screenshot returned invalid data');
      }

      // Build response with window context
      return buildScreenshotResult(dataUrl, 'native API', response.windowContext);
   } catch(nativeError: unknown) {
      // Log the native error for debugging, then fall back
      const nativeMsg = nativeError instanceof Error ? nativeError.message : String(nativeError);

      driverLogger.error(`Native screenshot failed: ${nativeMsg}, falling back to html2canvas`);
   }

   // Fallback 1: Use html2canvas library for high-quality DOM rendering
   // Try to use the script manager to register html2canvas for persistence
   const html2canvasScript = await prepareHtml2canvasScript(format, quality);

   // Fallback: Try Screen Capture API if available
   // Note: This script is wrapped by executeAsyncInWebview, so we don't need an IIFE
   const screenCaptureScript = `
      // Check if Screen Capture API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
         throw new Error('Screen Capture API not available');
      }

      // Request screen capture permission and get the stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
         video: {
            displaySurface: 'window',
            cursor: 'never'
         },
         audio: false
      });

      // Get the video track
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
         throw new Error('No video track available');
      }

      // Create a video element to display the stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;

      // Wait for the video to load metadata
      await new Promise((resolve, reject) => {
         video.onloadedmetadata = resolve;
         video.onerror = reject;
         setTimeout(() => reject(new Error('Video load timeout')), 5000);
      });

      // Play the video
      await video.play();

      // Create canvas to capture the frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Stop all tracks to release the capture
      stream.getTracks().forEach(track => track.stop());

      // Convert to data URL with specified format and quality
      const mimeType = '${format}' === 'jpeg' ? 'image/jpeg' : 'image/png';
      return canvas.toDataURL(mimeType, ${quality / 100});
   `;

   try {
      // Try html2canvas second (after native APIs)
      const result = await executeAsyncInWebview(html2canvasScript, undefined, 10000); // Longer timeout for library loading

      // Validate that we got a real data URL, not 'null' or empty
      if (result && result !== 'null' && result.startsWith('data:image/')) {
         return buildScreenshotResult(result, 'html2canvas');
      }

      throw new Error(`html2canvas returned invalid result: ${result?.substring(0, 100) || 'null'}`);
   } catch(html2canvasError: unknown) {
      try {
         // Fallback to Screen Capture API
         const result = await executeAsyncInWebview(screenCaptureScript);

         // Validate that we got a real data URL
         if (result && result.startsWith('data:image/')) {
            return buildScreenshotResult(result, 'Screen Capture API');
         }

         throw new Error(`Screen Capture API returned invalid result: ${result?.substring(0, 50) || 'null'}`);
      } catch(screenCaptureError: unknown) {
         // All methods failed - throw a proper error
         const html2canvasMsg = html2canvasError instanceof Error ? html2canvasError.message : 'html2canvas failed';

         const screenCaptureMsg = screenCaptureError instanceof Error ? screenCaptureError.message : 'Screen Capture API failed';

         throw new Error(
            'Screenshot capture failed. Native API not available, ' +
            `html2canvas error: ${html2canvasMsg}, ` +
            `Screen Capture API error: ${screenCaptureMsg}`
         );
      }
   }
}

// ============================================================================
// Schemas for Validation
// ============================================================================

export const ExecuteScriptSchema = z.object({
   script: z.string().describe('JavaScript code to execute in the webview'),
});

export const GetConsoleLogsSchema = z.object({
   filter: z.string().optional().describe('Regex or keyword to filter logs'),
   since: z.string().optional().describe('ISO timestamp to filter logs since'),
});

export const CaptureScreenshotSchema = z.object({
   format: z.enum([ 'png', 'jpeg' ]).optional().default('jpeg').describe('Image format'),
   quality: z.number().min(0).max(100).optional().describe('JPEG quality (0-100)'),
});
