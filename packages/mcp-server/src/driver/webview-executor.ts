import { z } from 'zod';

import { hasActiveSession, getDefaultSession, resolveTargetApp, manageDriverSession } from './session-manager.js';
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

const initializedTargets = new Set<string>();

const driverLogger = createMcpLogger('DRIVER');

const MCP_HELPER_MISSING = /__MCP__|resolveRef|resolveAll|countAll/;

function isHelperMissingError(message: string): boolean {
   return MCP_HELPER_MISSING.test(message) &&
      /undefined is not an object|is not a function|Cannot read propert/.test(message);
}

function targetKeyFor(session: { host: string; port: number }, windowId?: string): string {
   return `${session.host}:${session.port}:${windowId ?? 'main'}`;
}

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
export async function ensureReady(windowId?: string, appIdentifier?: string | number): Promise<void> {
   // Auto-connect if no active session
   if (!hasActiveSession()) {
      const result = await manageDriverSession('start');

      if (!hasActiveSession()) {
         throw new Error(
            'Auto-connect failed: ' + result + '. Call driver_session with action "start" to connect manually.'
         );
      }
   }

   const session = resolveTargetApp(appIdentifier);

   if (!session.client.isConnected()) {
      await session.client.connect();
   }

   const targetKey = targetKeyFor(session, windowId);

   if (initializedTargets.has(targetKey)) {
      return;
   }

   // Register the resolve-ref helper in the target window
   // so ref-based selectors work there.
   await registerScript(RESOLVE_REF_SCRIPT_ID, 'inline', getResolveRefSource(), windowId, appIdentifier);
   await waitForResolveRefHelper(session, windowId);

   initializedTargets.add(targetKey);
}

/**
 * Reset initialization state (useful for testing or reconnecting).
 */
export function resetInitialization(): void {
   initializedTargets.clear();
}

async function waitForResolveRefHelper(session: ReturnType<typeof getDefaultSession>, windowId?: string): Promise<void> {
   if (!session) {
      throw new Error('No active session available while registering resolve-ref helper.');
   }

   for (let attempt = 0; attempt < 20; attempt++) {
      const response = await session.client.sendCommand({
         command: 'execute_js',
         args: {
            script: 'return !!(window.__MCP__ && typeof window.__MCP__.resolveRef === "function")',
            windowLabel: windowId,
         },
      }, 2000);

      if (response.success && response.data === true) {
         return;
      }

      await new Promise((resolve) => { return setTimeout(resolve, 50); });
   }

   throw new Error('Resolve-ref helper was not available in the webview after registration.');
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
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns Result of the script execution with window context
 */
export async function executeInWebview(script: string, windowId?: string, appIdentifier?: string | number, timeoutMs?: number): Promise<string> {
   const { result } = await executeInWebviewWithContext(script, windowId, appIdentifier, timeoutMs);

   return result;
}

/**
 * Execute JavaScript in the Tauri webview and return window context.
 *
 * @param script - JavaScript code to execute in the webview context
 * @param windowId - Optional window label to target (defaults to "main")
 * @param appIdentifier - Optional app identifier to target specific app
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns Result of the script execution with window context
 */
export async function executeInWebviewWithContext(
   script: string,
   windowId?: string,
   appIdentifier?: string | number,
   timeoutMs?: number,
   isRetry = false
): Promise<ExecuteInWebviewResult> {
   try {
      return await runInWebview(script, windowId, appIdentifier, timeoutMs);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      if (isRetry || !isHelperMissingError(message)) {
         throw new Error(`WebView execution failed: ${message}`);
      }

      driverLogger.warn(`__MCP__ helper missing, re-injecting and retrying once: ${message}`);
      const session = resolveTargetApp(appIdentifier);

      initializedTargets.delete(targetKeyFor(session, windowId));
      await ensureReady(windowId, appIdentifier);

      return executeInWebviewWithContext(script, windowId, appIdentifier, timeoutMs, true);
   }
}

async function runInWebview(
   script: string,
   windowId?: string,
   appIdentifier?: string | number,
   timeoutMs?: number
): Promise<ExecuteInWebviewResult> {
   // Ensure we're fully initialized
   await ensureReady(windowId, appIdentifier);

   // Resolve target session
   const session = resolveTargetApp(appIdentifier);

   const client = session.client;

   // Send script directly - Rust handles wrapping and IPC callbacks.
   // Use timeoutMs if provided, otherwise default 7s timeout (longer than Rust's 5s)
   try {
      const response = await client.sendCommand({
         command: 'execute_js',
         args: { script, windowLabel: windowId },
      }, timeoutMs ?? 7000);

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

      // Check for transport timeout
      if (/^Request timeout after \d+ms$/.test(message)) {
         const probeResult = await probeBridge(session, windowId);

         if (probeResult) {
            throw new Error(
               `Bridge did not respond within ${timeoutMs ?? 7000}ms. A follow-up probe succeeded, so the bridge is alive and this ` +
               'specific script was too slow. Raise `timeout`, or split the work across calls.'
            );
         } else {
            throw new Error(
               `Bridge did not respond within ${timeoutMs ?? 7000}ms and a follow-up probe also timed out. The webview is wedged. ` +
               'Call driver_session with action "stop" then "start". A runaway loop in a previous script is the usual cause.'
            );
         }
      }

      throw error;
   }
}

async function probeBridge(session: ReturnType<typeof getDefaultSession> | null, windowId?: string): Promise<boolean> {
   if (!session) {
      return false;
   }
   try {
      const response = await session.client.sendCommand({
         command: 'execute_js',
         args: { script: 'return 1', windowLabel: windowId },
      }, 2000);

      return (response as { success: boolean }).success === true;
   } catch{
      return false;
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
export async function executeAsyncInWebview(
   script: string,
   windowId?: string,
   timeout?: number,
   appIdentifier?: string | number
): Promise<string> {
   const resolvedTimeout = timeout ?? 5000;

   const transportTimeout = resolvedTimeout + 2000;

   const wrappedScript = `
      return (async () => {
         const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Script execution timeout')), ${resolvedTimeout});
         });

         const scriptPromise = (async () => {
            ${script}
         })();

         return await Promise.race([scriptPromise, timeoutPromise]);
      })();
   `;

   return executeInWebview(wrappedScript, windowId, appIdentifier, transportTimeout);
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
 * @param options - Filtering and formatting options
 * @returns Formatted console logs as string
 */
export async function getConsoleLogs(options: {
   filter?: string;
   since?: string;
   lines?: number;
   windowId?: string;
   appIdentifier?: string | number;
   level?: string;
   maxChars?: number;
   maxCharsPerEntry?: number;
} = {}): Promise<string> {
   const { filter, since, lines = 50, windowId, appIdentifier, level, maxChars = 20000, maxCharsPerEntry = 2000 } = options;

   const resolvedLines = lines,
         resolvedMaxChars = maxChars,
         resolvedMaxCharsPerEntry = maxCharsPerEntry,
         resolvedLevel = level ?? '',
         filterStr = filter ? filter.replace(/'/g, '\\\'') : '',
         levelStr = resolvedLevel;

   const sinceStr = since || '';

   const script = `
      const logs = window.__MCP_CONSOLE_LOGS__ || [];
      let filtered = logs;

      if ('${sinceStr}') {
         const sinceTime = new Date('${sinceStr}').getTime();
         filtered = filtered.filter(l => l.timestamp > sinceTime);
      }

      if ('${levelStr}') {
         filtered = filtered.filter(l => l.level === '${levelStr}');
      }

      if ('${filterStr}') {
         try {
            const regex = new RegExp('${filterStr}', 'i');
            filtered = filtered.filter(l => regex.test(l.message));
         } catch(e) {
            throw new Error('Invalid filter regex: ' + e.message);
         }
      }

      filtered = filtered.slice(-${resolvedLines});

      var budget = ${resolvedMaxChars};
      var dropped = 0;
      var out = [];

      for (var i = filtered.length - 1; i >= 0; i--) {
         var entry = filtered[i],
             excess = entry.message.length - ${resolvedMaxCharsPerEntry},
             message = entry.message.length > ${resolvedMaxCharsPerEntry}
                ? entry.message.slice(0, ${resolvedMaxCharsPerEntry}) + '…[' + excess + ' more chars]'
                : entry.message,
             prefix = '[ ' + new Date(entry.timestamp).toISOString() + ' ] [ ' + entry.level.toUpperCase() + ' ] ',
             line = prefix + message;

         if (line.length > budget) { dropped = i + 1; break; }
         budget -= line.length + 1;
         out.unshift(line);
      }

      if (dropped > 0) {
         out.unshift(
            '[ ' + dropped + ' older entries dropped to fit maxChars=' + ${resolvedMaxChars} +
            '. Narrow with level, filter, or since. ]'
         );
      }

      return out.join('\\n');
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
function buildScreenshotResult(dataUrl: string, method: string, windowContext?: WindowContextInfo, metadata?: {
   imageWidth: number;
   imageHeight: number;
   cssWidth: number;
   cssHeight: number;
}): ScreenshotResult {
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

   // Add screenshot metadata if available
   if (metadata) {
      const scale = metadata.cssWidth > 0 ? metadata.imageWidth / metadata.cssWidth : 0;

      const inverseScale = scale > 0 ? (1 / scale).toFixed(1) : '1.0';

      contextText += `\nImage is ${metadata.imageWidth}x${metadata.imageHeight} px. ` +
         `Webview viewport is ${Math.round(metadata.cssWidth)}x${Math.round(metadata.cssHeight)} CSS px. ` +
         `Scale ${scale.toFixed(3)}.`;
      contextText += '\nwebview_interact x and y are CSS pixels: ' +
         `multiply image coordinates by ${inverseScale}.`;
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
   allowScreenCapture?: boolean;
}

/**
 * Prepares the html2canvas script for screenshot capture.
 * Tries to use the script manager for persistence, falls back to inline injection.
 */
async function prepareHtml2canvasScript(
   format: 'png' | 'jpeg',
   quality: number,
   windowId?: string,
   appIdentifier?: string | number
): Promise<string> {
   try {
      // Check if html2canvas is already registered
      const isRegistered = await isScriptRegistered(HTML2CANVAS_SCRIPT_ID, appIdentifier);

      if (!isRegistered) {
         // Register html2canvas via script manager for persistence across navigations
         const html2canvasSource = getHtml2CanvasSource();

         await registerScript(HTML2CANVAS_SCRIPT_ID, 'inline', html2canvasSource, windowId, appIdentifier);
      }

      // Use the capture-only script since html2canvas is now registered
      return buildScreenshotCaptureScript(format, quality);
   } catch{
      // Script manager not available, fall back to inline injection
      return buildScreenshotScript(format, quality);
   }
}

interface NativeScreenshotPayload {
   dataUrl: string;
   imageWidth?: number;
   imageHeight?: number;
   cssWidth?: number;
   cssHeight?: number;
}

function parseNativeScreenshotPayload(rawPayload: unknown): {
   dataUrl: string;
   metadata?: { imageWidth: number; imageHeight: number; cssWidth: number; cssHeight: number };
} {
   if (typeof rawPayload === 'string') {
      return { dataUrl: rawPayload };
   }

   const payload = rawPayload as NativeScreenshotPayload,
         dimensions = [ payload.imageWidth, payload.imageHeight, payload.cssWidth, payload.cssHeight ],
         hasMetadata = dimensions.every((value) => { return typeof value === 'number'; });

   if (!hasMetadata) {
      return { dataUrl: payload.dataUrl };
   }

   return {
      dataUrl: payload.dataUrl,
      metadata: {
         imageWidth: payload.imageWidth as number,
         imageHeight: payload.imageHeight as number,
         cssWidth: payload.cssWidth as number,
         cssHeight: payload.cssHeight as number,
      },
   };
}

async function captureNativeScreenshot(options: {
   format: 'png' | 'jpeg';
   quality: number;
   windowId?: string;
   appIdentifier?: string | number;
   maxWidth?: number;
}): Promise<ScreenshotResult> {
   const { format, quality, windowId, appIdentifier, maxWidth } = options;

   await ensureReady(windowId, appIdentifier);

   const session = resolveTargetApp(appIdentifier),
         args = { format, quality, windowLabel: windowId, maxWidth },
         command = { command: 'capture_native_screenshot' as const, args },
         response = await session.client.sendCommand(command, 15000);

   if (!response.success || !response.data) {
      throw new Error(response.error || 'Native screenshot returned invalid data');
   }

   const { dataUrl, metadata } = parseNativeScreenshotPayload(response.data);

   if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Native screenshot returned invalid data');
   }

   return buildScreenshotResult(dataUrl, 'native API', response.windowContext, metadata);
}

/**
 * Capture a screenshot of the visible webview viewport.
 *
 * @param options - Screenshot options (format, quality, windowId, appIdentifier, etc.)
 * @returns Screenshot result with image content
 */
export async function captureScreenshot(options: CaptureScreenshotOptions = {}): Promise<ScreenshotResult> {
   const {
      format = 'jpeg', quality = 80, windowId, appIdentifier, maxWidth, allowScreenCapture = false,
   } = options;

   let nativeErrorMsg = 'Native screenshot unavailable';

   try {
      return await captureNativeScreenshot({ format, quality, windowId, appIdentifier, maxWidth });
   } catch(nativeError: unknown) {
      // Log the native error for debugging, then fall back
      nativeErrorMsg = nativeError instanceof Error ? nativeError.message : String(nativeError);

      driverLogger.error(`Native screenshot failed: ${nativeErrorMsg}, falling back to html2canvas`);
   }

   // Fallback 1: Use html2canvas library for high-quality DOM rendering
   // Try to use the script manager to register html2canvas for persistence
   const html2canvasScript = await prepareHtml2canvasScript(format, quality, windowId, appIdentifier);

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
      const result = await executeAsyncInWebview(html2canvasScript, windowId, 10000, appIdentifier);

      // Validate that we got a real data URL, not 'null' or empty
      if (result && result !== 'null' && result.startsWith('data:image/')) {
         return buildScreenshotResult(result, 'html2canvas');
      }

      throw new Error(`html2canvas returned invalid result: ${result?.substring(0, 100) || 'null'}`);
   } catch(html2canvasError: unknown) {
      const html2canvasMsg = html2canvasError instanceof Error ? html2canvasError.message : 'html2canvas failed';

      if (!allowScreenCapture) {
         throw new Error(
            `Screenshot capture failed. Native API error: ${nativeErrorMsg}, ` +
            `html2canvas error: ${html2canvasMsg}. ` +
            'Screen Capture API fallback is disabled; set allowScreenCapture to true to request interactive permission.'
         );
      }

      try {
         // Fallback to Screen Capture API
         const result = await executeAsyncInWebview(screenCaptureScript, windowId, 5000, appIdentifier);

         // Validate that we got a real data URL
         if (result && result.startsWith('data:image/')) {
            return buildScreenshotResult(result, 'Screen Capture API');
         }

         throw new Error(`Screen Capture API returned invalid result: ${result?.substring(0, 50) || 'null'}`);
      } catch(screenCaptureError: unknown) {
         // All methods failed - throw a proper error
         const screenCaptureMsg = screenCaptureError instanceof Error ? screenCaptureError.message : 'Screen Capture API failed';

         throw new Error(
            `Screenshot capture failed. Native API error: ${nativeErrorMsg}, ` +
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
   allowScreenCapture: z.boolean().optional().default(false).describe(
      'Allow the Screen Capture API fallback, which opens an interactive OS permission prompt'
   ),
});
