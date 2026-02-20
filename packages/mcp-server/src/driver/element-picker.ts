/**
 * Element picker module for MCP Server Tauri.
 *
 * Provides two tools:
 * - selectElement: Agent-initiated picker overlay (user clicks element)
 * - getPointedElement: Retrieve element user pointed at via Alt+Shift+Click
 */

import { z } from 'zod';
import { executeInWebview, executeAsyncInWebview } from './webview-executor.js';
import { ensureSessionAndConnect } from './plugin-client.js';
import { SCRIPTS, buildScript } from './scripts/index.js';
import { WindowTargetSchema } from './webview-interactions.js';
import {
   getHtml2CanvasSource,
   HTML2CANVAS_SCRIPT_ID,
} from './scripts/html2canvas-loader.js';
import { registerScript, isScriptRegistered } from './script-manager.js';
import type { ToolContent } from '../tools-registry.js';
import type { ElementMetadata, ElementPickerBroadcast } from './protocol.js';

// ============================================================================
// Schemas
// ============================================================================

export const SelectElementSchema = WindowTargetSchema.extend({
   timeout: z.number().min(5000).max(120000).optional().default(60000)
      .describe('Timeout in ms for user to pick an element (5000-120000, default 60000)'),
});

export const GetPointedElementSchema = WindowTargetSchema.extend({});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format element metadata into a readable text block.
 */
function formatElementMetadata(meta: ElementMetadata): string {
   const lines: string[] = [];

   lines.push(`## Element: <${meta.tag}>`);

   if (meta.id) {
      lines.push(`**ID:** ${meta.id}`);
   }

   if (meta.classes.length > 0) {
      lines.push(`**Classes:** ${meta.classes.join(', ')}`);
   }

   lines.push(`**CSS Selector:** \`${meta.cssSelector}\``);

   if (meta.xpath) {
      lines.push(`**XPath:** \`${meta.xpath}\``);
   }

   // Bounding rect
   const r = meta.boundingRect;

   lines.push(`**Bounding Rect:** ${Math.round(r.width)}x${Math.round(r.height)} at (${Math.round(r.x)}, ${Math.round(r.y)})`);

   // Attributes (skip id and class which are already shown)
   const attrEntries = Object.entries(meta.attributes).filter(
      ([ k ]) => { return k !== 'id' && k !== 'class'; }
   );

   if (attrEntries.length > 0) {
      lines.push(`**Attributes:** ${attrEntries.map(([ k, v ]) => { return `${k}="${v}"`; }).join(', ')}`);
   }

   if (meta.textContent) {
      const text = meta.textContent.length > 200
         ? meta.textContent.substring(0, 200) + '...'
         : meta.textContent;

      lines.push(`**Text Content:** ${text}`);
   }

   // Computed styles (only non-default interesting ones)
   const styleEntries = Object.entries(meta.computedStyles);

   if (styleEntries.length > 0) {
      lines.push('**Computed Styles:**');
      for (const [ prop, val ] of styleEntries) {
         lines.push(`  ${prop}: ${val}`);
      }
   }

   if (meta.parentChain.length > 0) {
      lines.push('**Parent Chain:**');
      for (const parent of meta.parentChain) {
         let desc = `  <${parent.tag}>`;

         if (parent.id) {
            desc += `#${parent.id}`;
         }
         if (parent.classes && parent.classes.length > 0) {
            desc += `.${parent.classes.join('.')}`;
         }
         if (parent.boundingRect) {
            desc += ` (${Math.round(parent.boundingRect.width)}x${Math.round(parent.boundingRect.height)})`;
         }
         lines.push(desc);
      }
   }

   return lines.join('\n');
}

/**
 * Inject a script that removes all picker highlight elements from the DOM.
 */
async function cleanupPickerHighlights(windowId?: string, appIdentifier?: string | number): Promise<void> {
   const script = `(function() {
      var els = document.querySelectorAll('[data-mcp-picker]');
      for (var i = 0; i < els.length; i++) { els[i].parentNode.removeChild(els[i]); }
      return 'Cleaned up ' + els.length + ' picker elements';
   })()`;

   try {
      await executeInWebview(script, windowId, appIdentifier);
   } catch{
      // Best effort cleanup
   }
}

/**
 * Capture a screenshot of a specific element using html2canvas.
 * Returns the base64 data URL of the cropped element image, or null on failure.
 */
async function captureElementScreenshot(
   cssSelector: string,
   windowId?: string
): Promise<ToolContent | null> {
   // Ensure html2canvas is loaded in the webview
   try {
      const isRegistered = await isScriptRegistered(HTML2CANVAS_SCRIPT_ID);

      if (!isRegistered) {
         const source = getHtml2CanvasSource();

         await registerScript(HTML2CANVAS_SCRIPT_ID, 'inline', source);
      }
   } catch{
      // Script manager unavailable — we'll inline the library in the capture script
   }

   const escapedSelector = cssSelector.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');

   // Build a script that captures just the element with html2canvas
   const captureScript = `
      const html2canvasFn = typeof html2canvas !== 'undefined' ? html2canvas :
                           (typeof window !== 'undefined' && window.html2canvas) ? window.html2canvas :
                           (typeof self !== 'undefined' && self.html2canvas) ? self.html2canvas :
                           (typeof globalThis !== 'undefined' && globalThis.html2canvas) ? globalThis.html2canvas : null;

      if (!html2canvasFn) {
         throw new Error('html2canvas not loaded');
      }

      const el = document.querySelector('${escapedSelector}');
      if (!el) {
         throw new Error('Element not found for screenshot');
      }

      const canvas = await html2canvasFn(el, {
         backgroundColor: null,
         scale: window.devicePixelRatio || 1,
         logging: false,
         useCORS: true,
         allowTaint: false,
         imageTimeout: 5000,
      });

      if (!canvas) {
         throw new Error('html2canvas returned null canvas');
      }

      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
         throw new Error('Invalid data URL from canvas');
      }

      return dataUrl;
   `;

   try {
      const dataUrl = await executeAsyncInWebview(captureScript, windowId, 10000);

      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
         return null;
      }

      // Extract base64 data from data URL
      const commaIndex = dataUrl.indexOf(',');

      if (commaIndex === -1) {
         return null;
      }

      return {
         type: 'image',
         data: dataUrl.substring(commaIndex + 1),
         mimeType: 'image/png',
      };
   } catch{
      return null;
   }
}

// ============================================================================
// selectElement - Agent-initiated picker
// ============================================================================

export async function selectElement(options: {
   timeout?: number;
   windowId?: string;
   appIdentifier?: string | number;
}): Promise<ToolContent[]> {
   const { timeout = 60000, windowId, appIdentifier } = options;

   const client = await ensureSessionAndConnect(appIdentifier);

   // Generate unique picker ID
   const pickerId = `picker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

   // Set up event listener FIRST (before injection to avoid race condition)
   const eventPromise = new Promise<ElementPickerBroadcast['payload']>((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let timeoutHandle: NodeJS.Timeout;

      const handler = (message: ElementPickerBroadcast): void => {
         if (message.type !== 'element_picked') {
            return;
         }

         const payload = message.payload;

         if (!payload || payload.pickerId !== pickerId) {
            return;
         }

         clearTimeout(timeoutHandle);
         client.removeListener('event', handler);
         resolve(payload);
      };

      client.on('event', handler);

      timeoutHandle = setTimeout(() => {
         client.removeListener('event', handler);

         // Clean up picker UI on timeout
         cleanupPickerHighlights(windowId, appIdentifier);

         reject(new Error(`Element picker timed out after ${timeout}ms. User did not select an element.`));
      }, timeout);
   });

   // Inject picker overlay (this returns quickly within the 5s execute_js timeout)
   const script = buildScript(SCRIPTS.elementPicker, { mode: 'pick', pickerId });

   await executeInWebview(script, windowId, appIdentifier);

   // Wait for user interaction
   const result = await eventPromise;

   // Handle cancellation
   if (result.cancelled) {
      return [ { type: 'text', text: 'Element picker was cancelled by the user.' } ];
   }

   // Element was picked
   const element = result.element;

   if (!element) {
      await cleanupPickerHighlights(windowId, appIdentifier);
      return [ { type: 'text', text: 'Element picker returned no element data.' } ];
   }

   // Clean up all picker UI BEFORE taking the screenshot
   await cleanupPickerHighlights(windowId, appIdentifier);

   const content: ToolContent[] = [];

   // Add formatted metadata
   content.push({ type: 'text', text: formatElementMetadata(element) });

   // Capture element-only screenshot (no picker overlays visible)
   const screenshot = await captureElementScreenshot(element.cssSelector, windowId);

   if (screenshot) {
      content.push(screenshot);
   } else {
      content.push({ type: 'text', text: '(Element screenshot capture failed)' });
   }

   return content;
}

// ============================================================================
// getPointedElement - Retrieve user-pointed element
// ============================================================================

export async function getPointedElement(options: {
   windowId?: string;
   appIdentifier?: string | number;
}): Promise<ToolContent[]> {
   const { windowId, appIdentifier } = options;

   // Read and clear the pointed element
   const readScript = `(function() {
      var data = window.__MCP_POINTED_ELEMENT__;
      window.__MCP_POINTED_ELEMENT__ = null;
      return data ? JSON.stringify(data) : null;
   })()`;

   const raw = await executeInWebview(readScript, windowId, appIdentifier);

   if (!raw || raw === 'null' || raw === 'undefined') {
      return [
         {
            type: 'text',
            text: 'No element has been pointed. Use Alt+Shift+Click on an element in the Tauri app first.',
         },
      ];
   }

   let element: ElementMetadata;

   try {
      element = JSON.parse(raw);
   } catch{
      return [ { type: 'text', text: `Failed to parse pointed element data: ${raw.substring(0, 200)}` } ];
   }

   const content: ToolContent[] = [];

   // Add formatted metadata
   content.push({ type: 'text', text: formatElementMetadata(element) });

   // Capture element-only screenshot (no overlays)
   const screenshot = await captureElementScreenshot(element.cssSelector, windowId);

   if (screenshot) {
      content.push(screenshot);
   } else {
      content.push({ type: 'text', text: '(Element screenshot capture failed)' });
   }

   return content;
}
