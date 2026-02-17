import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
   executeInWebview,
   executeInWebviewWithContext,
   captureScreenshot,
   getConsoleLogs as getConsoleLogsFromCapture,
   ScreenshotResult,
} from './webview-executor.js';
import { SCRIPTS, buildScript, buildTypeScript, buildKeyEventScript } from './scripts/index.js';

// ============================================================================
// Base Schema for Window Targeting
// ============================================================================

/**
 * Base schema mixin for tools that can target a specific window and app.
 * All webview tools extend this to support multi-window and multi-app scenarios.
 */
export const WindowTargetSchema = z.object({
   windowId: z.string().optional().describe('Window label to target (defaults to "main")'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID to target. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

// ============================================================================
// Shared Selector Strategy
// ============================================================================

/**
 * Reusable strategy field for tools that accept a selector.
 * Defaults to 'css' for backward compatibility.
 */
const selectorStrategyField = z.enum([ 'css', 'xpath', 'text' ]).default('css').describe(
   'Selector strategy: "css" (default) for CSS selectors, "xpath" for XPath expressions, ' +
   '"text" to find elements containing the given text. Ref IDs (e.g., "ref=e3") work with any strategy.'
);

// ============================================================================
// Schemas
// ============================================================================

export const InteractSchema = WindowTargetSchema.extend({
   action: z.enum([ 'click', 'double-click', 'long-press', 'scroll', 'swipe', 'focus' ])
      .describe('Type of interaction to perform'),
   selector: z.string().optional().describe(
      'Element selector: CSS selector (default), XPath expression, text content, or ref ID (e.g., "ref=e3")'
   ),
   strategy: selectorStrategyField,
   x: z.number().optional().describe('X coordinate for direct coordinate interaction'),
   y: z.number().optional().describe('Y coordinate for direct coordinate interaction'),
   duration: z.number().optional()
      .describe('Duration in ms for long-press or swipe (default: 500ms for long-press, 300ms for swipe)'),
   scrollX: z.number().optional().describe('Horizontal scroll amount in pixels (positive = right)'),
   scrollY: z.number().optional().describe('Vertical scroll amount in pixels (positive = down)'),
   fromX: z.number().optional().describe('Starting X coordinate for swipe'),
   fromY: z.number().optional().describe('Starting Y coordinate for swipe'),
   toX: z.number().optional().describe('Ending X coordinate for swipe'),
   toY: z.number().optional().describe('Ending Y coordinate for swipe'),
});

export const ScreenshotSchema = WindowTargetSchema.extend({
   format: z.enum([ 'png', 'jpeg' ]).optional().default('jpeg').describe('Image format'),
   quality: z.number().min(0).max(100).optional().default(80).describe('JPEG quality (0-100, only for jpeg format)'),
   filePath: z.string().optional().describe('File path to save the screenshot to instead of returning as base64'),
   maxWidth: z.number().int().positive().optional().describe(
      'Maximum width in pixels. Images wider than this will be scaled down proportionally. ' +
      'Can also be set via TAURI_MCP_SCREENSHOT_MAX_WIDTH environment variable.'
   ),
});

export const KeyboardSchema = WindowTargetSchema.extend({
   action: z.enum([ 'type', 'press', 'down', 'up' ])
      .describe('Keyboard action type: "type" for typing text into an element, "press/down/up" for key events'),
   selector: z.string().optional().describe(
      'Element selector for element to type into (required for "type" action): ' +
      'CSS selector (default), XPath, text content, or ref ID'
   ),
   strategy: selectorStrategyField,
   text: z.string().optional().describe('Text to type (required for "type" action)'),
   key: z.string().optional().describe('Key to press (required for "press/down/up" actions, e.g., "Enter", "a", "Escape")'),
   modifiers: z.array(z.enum([ 'Control', 'Alt', 'Shift', 'Meta' ])).optional().describe('Modifier keys to hold'),
});

export const WaitForSchema = WindowTargetSchema.extend({
   type: z.enum([ 'selector', 'text', 'ipc-event' ]).describe('What to wait for'),
   value: z.string().describe('Selector, text content, or IPC event name to wait for'),
   strategy: selectorStrategyField.describe(
      'Selector strategy (applies when type is "selector"): "css" (default), "xpath", or "text".'
   ),
   timeout: z.number().optional().default(5000).describe('Timeout in milliseconds (default: 5000ms)'),
});

export const GetStylesSchema = WindowTargetSchema.extend({
   selector: z.string().describe('Element selector: CSS selector (default), XPath expression, text content, or ref ID'),
   strategy: selectorStrategyField,
   properties: z.array(z.string()).optional().describe('Specific CSS properties to retrieve. If omitted, returns all computed styles'),
   multiple: z.boolean().optional().default(false)
      .describe('Whether to get styles for all matching elements (true) or just the first (false)'),
});

export const ExecuteJavaScriptSchema = WindowTargetSchema.extend({
   script: z.string().describe(
      'JavaScript code to execute in the webview context. ' +
      'If returning a value, it must be JSON-serializable. ' +
      'For functions that return values, use IIFE syntax: "(() => { return value; })()" not "() => { return value; }"'
   ),
   args: z.array(z.unknown()).optional().describe('Arguments to pass to the script'),
});

export const FocusElementSchema = WindowTargetSchema.extend({
   selector: z.string().describe('CSS selector for element to focus'),
});

export const FindElementSchema = WindowTargetSchema.extend({
   selector: z.string().describe(
      'The selector to find: CSS selector (default), XPath expression, text content, or ref ID (e.g., "ref=e3"). ' +
      'Interpretation depends on strategy.'
   ),
   strategy: selectorStrategyField,
});

export const GetConsoleLogsSchema = WindowTargetSchema.extend({
   filter: z.string().optional().describe('Regex or keyword to filter logs'),
   since: z.string().optional().describe('ISO timestamp to filter logs since'),
});

export const DomSnapshotSchema = WindowTargetSchema.extend({
   type: z.enum([ 'accessibility', 'structure' ]).describe('Snapshot type'),
   selector: z.string().optional().describe(
      'Selector to scope the snapshot: CSS selector (default), XPath, text content, or ref ID. If omitted, snapshots entire document.'
   ),
   strategy: selectorStrategyField,
});

// ============================================================================
// Implementation Functions
// ============================================================================

export async function interact(options: {
   action: string;
   selector?: string;
   strategy?: string;
   x?: number;
   y?: number;
   duration?: number;
   scrollX?: number;
   scrollY?: number;
   fromX?: number;
   fromY?: number;
   toX?: number;
   toY?: number;
   windowId?: string;
   appIdentifier?: string | number;
}): Promise<string> {
   const { action, selector, strategy, x, y, duration, scrollX, scrollY, fromX, fromY, toX, toY, windowId, appIdentifier } = options;

   // Handle swipe action separately since it has different logic
   if (action === 'swipe') {
      return performSwipe({ fromX, fromY, toX, toY, duration, windowId, appIdentifier });
   }

   // Handle focus action
   if (action === 'focus') {
      if (!selector) {
         throw new Error('Focus action requires a selector');
      }
      return focusElement({ selector, strategy, windowId, appIdentifier });
   }

   const script = buildScript(SCRIPTS.interact, {
      action,
      selector: selector ?? null,
      strategy: strategy ?? 'css',
      x: x ?? null,
      y: y ?? null,
      duration: duration ?? 500,
      scrollX: scrollX ?? 0,
      scrollY: scrollY ?? 0,
   });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Interaction failed: ${message}`);
   }
}

interface SwipeOptions {
   fromX?: number;
   fromY?: number;
   toX?: number;
   toY?: number;
   duration?: number;
   windowId?: string;
   appIdentifier?: string | number;
}

async function performSwipe(options: SwipeOptions): Promise<string> {
   const { fromX, fromY, toX, toY, duration = 300, windowId, appIdentifier } = options;

   if (fromX === undefined || fromY === undefined || toX === undefined || toY === undefined) {
      throw new Error('Swipe action requires fromX, fromY, toX, and toY coordinates');
   }

   const script = buildScript(SCRIPTS.swipe, { fromX, fromY, toX, toY, duration });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Swipe failed: ${message}`);
   }
}

export interface ScreenshotOptions {
   quality?: number;
   format?: 'png' | 'jpeg';
   windowId?: string;
   filePath?: string;
   appIdentifier?: string | number;
   maxWidth?: number;
}

export interface ScreenshotFileResult {
   filePath: string;
   format: 'png' | 'jpeg';
}

export async function screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult | ScreenshotFileResult> {
   const { quality, format = 'jpeg', windowId, filePath, appIdentifier, maxWidth } = options;

   // Use the native screenshot function from webview-executor
   const result = await captureScreenshot({ format, quality, windowId, appIdentifier, maxWidth });

   // If filePath is provided, write to file instead of returning base64
   if (filePath) {
      // Find the image content in the result
      const imageContent = result.content.find((c) => { return c.type === 'image'; });

      if (!imageContent || imageContent.type !== 'image') {
         throw new Error('Screenshot capture failed: no image data');
      }

      // Decode base64 and write to file
      const buffer = Buffer.from(imageContent.data, 'base64');

      const resolvedPath = resolve(filePath);

      await writeFile(resolvedPath, buffer);

      return { filePath: resolvedPath, format };
   }

   return result;
}

export interface KeyboardOptions {
   action: string;
   selectorOrKey?: string;
   strategy?: string;
   textOrModifiers?: string | string[];
   modifiers?: string[];
   windowId?: string;
   appIdentifier?: string | number;
}

export async function keyboard(options: KeyboardOptions): Promise<string> {
   const { action, selectorOrKey, strategy, textOrModifiers, modifiers, windowId, appIdentifier } = options;

   // Handle the different parameter combinations based on action
   if (action === 'type') {
      const selector = selectorOrKey;

      const text = textOrModifiers as string;

      if (!selector || !text) {
         throw new Error('Type action requires both selector and text parameters');
      }

      const script = buildTypeScript(selector, text, strategy);

      try {
         return await executeInWebview(script, windowId, appIdentifier);
      } catch(error: unknown) {
         const message = error instanceof Error ? error.message : String(error);

         throw new Error(`Type action failed: ${message}`);
      }
   }

   // For press/down/up actions: key is required, modifiers optional
   const key = selectorOrKey;

   const mods = Array.isArray(textOrModifiers) ? textOrModifiers : modifiers;

   if (!key) {
      throw new Error(`${action} action requires a key parameter`);
   }

   const script = buildKeyEventScript(action, key, mods || []);

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Keyboard action failed: ${message}`);
   }
}

export interface WaitForOptions {
   type: string;
   value: string;
   strategy?: string;
   timeout?: number;
   windowId?: string;
   appIdentifier?: string | number;
}

export async function waitFor(options: WaitForOptions): Promise<string> {
   const { type, value, strategy, timeout = 5000, windowId, appIdentifier } = options;

   const script = buildScript(SCRIPTS.waitFor, { type, value, strategy: strategy ?? 'css', timeout });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Wait failed: ${message}`);
   }
}

export interface GetStylesOptions {
   selector: string;
   strategy?: string;
   properties?: string[];
   multiple?: boolean;
   windowId?: string;
   appIdentifier?: string | number;
}

export async function getStyles(options: GetStylesOptions): Promise<string> {
   const { selector, strategy, properties, multiple = false, windowId, appIdentifier } = options;

   const script = buildScript(SCRIPTS.getStyles, {
      selector,
      strategy: strategy ?? 'css',
      properties: properties || [],
      multiple,
   });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Get styles failed: ${message}`);
   }
}

export interface ExecuteJavaScriptOptions {
   script: string;
   args?: unknown[];
   windowId?: string;
   appIdentifier?: string | number;
}

export async function executeJavaScript(options: ExecuteJavaScriptOptions): Promise<string> {
   const { script, args, windowId, appIdentifier } = options;

   // If args are provided, we need to inject them into the script context
   const wrappedScript = args && args.length > 0
      ? `
         (function() {
            const args = ${JSON.stringify(args)};
            return (${script}).apply(null, args);
         })();
      `
      : script;

   try {
      const { result, windowLabel, warning } = await executeInWebviewWithContext(wrappedScript, windowId, appIdentifier);

      // Build response with window context
      let response = result;

      if (warning) {
         response = `⚠️ ${warning}\n\n${response}`;
      }

      // Add window info footer for clarity
      response += `\n\n[Executed in window: ${windowLabel}]`;

      return response;
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`JavaScript execution failed: ${message}`);
   }
}

export interface FocusElementOptions {
   selector: string;
   strategy?: string;
   windowId?: string;
   appIdentifier?: string | number;
}

export async function focusElement(options: FocusElementOptions): Promise<string> {
   const { selector, strategy, windowId, appIdentifier } = options;

   const script = buildScript(SCRIPTS.focus, { selector, strategy: strategy ?? 'css' });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Focus failed: ${message}`);
   }
}

export interface FindElementOptions {
   selector: string;
   strategy: string;
   windowId?: string;
   appIdentifier?: string | number;
}

/**
 * Find an element using various selector strategies.
 */
export async function findElement(options: FindElementOptions): Promise<string> {
   const { selector, strategy, windowId, appIdentifier } = options;

   const script = buildScript(SCRIPTS.findElement, { selector, strategy });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Find element failed: ${message}`);
   }
}

export interface GetConsoleLogsOptions {
   filter?: string;
   since?: string;
   windowId?: string;
   appIdentifier?: string | number;
}

/**
 * Get console logs from the webview.
 */
export async function getConsoleLogs(options: GetConsoleLogsOptions = {}): Promise<string> {
   const { filter, since, windowId, appIdentifier } = options;

   try {
      return await getConsoleLogsFromCapture(filter, since, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Failed to get console logs: ${message}`);
   }
}

export interface DomSnapshotOptions {
   type: 'accessibility' | 'structure';
   selector?: string;
   strategy?: string;
   windowId?: string;
   appIdentifier?: string | number;
}

/**
 * Generate a structured DOM snapshot for AI consumption.
 * Uses aria-api for comprehensive, spec-compliant accessibility computation.
 */
export async function domSnapshot(options: DomSnapshotOptions): Promise<string> {
   const { type, selector, strategy, windowId, appIdentifier } = options;

   // Only load aria-api for accessibility snapshots
   if (type === 'accessibility') {
      await ensureAriaApiLoaded(windowId);
   }

   // Then execute the snapshot script
   const script = buildScript(SCRIPTS.domSnapshot, { type, selector: selector ?? null, strategy: strategy ?? 'css' });

   try {
      return await executeInWebview(script, windowId, appIdentifier);
   } catch(error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`DOM snapshot failed: ${message}`);
   }
}

/**
 * Ensure aria-api library is loaded in the webview.
 * Uses the script manager to inject the library if not already present.
 */
async function ensureAriaApiLoaded(windowId?: string): Promise<void> {
   const { getAriaApiSource, ARIA_API_SCRIPT_ID: ariaApiScriptId } = await import('./scripts/aria-api-loader.js');

   const { registerScript, isScriptRegistered } = await import('./script-manager.js');

   if (await isScriptRegistered(ariaApiScriptId)) {
      return;
   }

   await registerScript(ariaApiScriptId, 'inline', getAriaApiSource(), windowId);
}
