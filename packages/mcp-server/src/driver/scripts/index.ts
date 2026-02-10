/**
 * Script loader for webview injection scripts
 *
 * These scripts are loaded at build time and injected into the webview at runtime.
 * Each script is an IIFE that accepts a params object.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const currentDir = dirname(fileURLToPath(import.meta.url));

function loadScript(name: string): string {
   return readFileSync(join(currentDir, `${name}.js`), 'utf-8');
}

// Load scripts once at module initialization
export const SCRIPTS = {
   interact: loadScript('interact'),
   swipe: loadScript('swipe'),
   keyboard: loadScript('keyboard'),
   waitFor: loadScript('wait-for'),
   getStyles: loadScript('get-styles'),
   focus: loadScript('focus'),
   findElement: loadScript('find-element'),
   domSnapshot: loadScript('dom-snapshot'),
} as const;

/**
 * Build a script invocation with parameters
 * The script should be an IIFE that accepts a params object
 */
export function buildScript(script: string, params: Record<string, unknown>): string {
   return `(${script})(${JSON.stringify(params)})`;
}

/**
 * Build a script for typing text (uses the keyboard script's typeText function)
 */
export function buildTypeScript(selector: string, text: string): string {
   const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

   return `
      (function() {
         const selector = '${selector}';
         const text = '${escapedText}';

         // Resolve element from CSS selector or ref ID (e.g., "ref=e3", "e3", or "[ref=e3]")
         var resolve = window.__MCP_RESOLVE_REF__;
         if (!resolve) throw new Error('Run webview_dom_snapshot first to index elements.');
         var element = resolve(selector);
         if (!element) throw new Error('Element not found: ' + selector + '. The DOM may have changed since the snapshot.');

         element.focus();
         element.value = text;
         element.dispatchEvent(new Event('input', { bubbles: true }));
         element.dispatchEvent(new Event('change', { bubbles: true }));

         return 'Typed "' + text + '" into ' + selector;
      })()
   `;
}

/**
 * Build a script for key events (press, down, up)
 */
export function buildKeyEventScript(
   action: string,
   key: string,
   modifiers: string[] = []
): string {
   return `
      (function() {
         const action = '${action}';
         const key = '${key}';
         const modifiers = ${JSON.stringify(modifiers)};

         const eventOptions = {
            key: key,
            code: key,
            bubbles: true,
            cancelable: true,
            ctrlKey: modifiers.includes('Control'),
            altKey: modifiers.includes('Alt'),
            shiftKey: modifiers.includes('Shift'),
            metaKey: modifiers.includes('Meta'),
         };

         const activeElement = document.activeElement || document.body;

         if (action === 'press') {
            activeElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
            activeElement.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
            activeElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
            return 'Pressed key: ' + key + (modifiers.length ? ' with ' + modifiers.join('+') : '');
         } else if (action === 'down') {
            activeElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
            return 'Key down: ' + key + (modifiers.length ? ' with ' + modifiers.join('+') : '');
         } else if (action === 'up') {
            activeElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
            return 'Key up: ' + key + (modifiers.length ? ' with ' + modifiers.join('+') : '');
         }

         throw new Error('Unknown action: ' + action);
      })()
   `;
}
