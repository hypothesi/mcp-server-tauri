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
   resolveRef: loadScript('resolve-ref'),
   interact: loadScript('interact'),
   swipe: loadScript('swipe'),
   waitFor: loadScript('wait-for'),
   focus: loadScript('focus'),
   findElement: loadScript('find-element'),
   domSnapshot: loadScript('dom-snapshot'),
   elementPicker: loadScript('element-picker'),
} as const;

/** Script ID used for resolve-ref in the script registry. */
export const RESOLVE_REF_SCRIPT_ID = '__mcp_resolve_ref__';

/**
 * Get the resolve-ref script source code.
 */
export function getResolveRefSource(): string {
   return SCRIPTS.resolveRef;
}

/**
 * Build a script invocation with parameters
 * The script should be an IIFE that accepts a params object
 */
export function buildScript(script: string, params: Record<string, unknown>): string {
   return `(${script})(${JSON.stringify(params)})`;
}

/**
 * Build a script for typing text
 */
export function buildTypeScript(selector: string, text: string, strategy?: string, nth?: number | null): string {
   const strat = strategy || 'css';
   const nthValue = nth ?? null;

   return `
      (function() {
         const selector = ${JSON.stringify(selector)};
         const strategy = ${JSON.stringify(strat)};
         const text = ${JSON.stringify(text)};
         const nth = ${JSON.stringify(nthValue)};

         function resolveElement(selectorOrRef) {
            if (!selectorOrRef) return null;
            var matches = window.__MCP__.resolveAll(selectorOrRef, strategy);

            if (matches.length === 0) throw new Error('Element not found: ' + selectorOrRef);
            if (typeof nth === 'number') {
               if (!matches[nth]) {
                  throw new Error('nth=' + nth + ' is out of range, ' + matches.length + ' matches for ' + selectorOrRef);
               }
               return matches[nth];
            }
            if (matches.length > 1 && strategy === 'text') {
               throw new Error(describeAmbiguity(selectorOrRef, matches));
            }
            return matches[0];
         }

         function describeAmbiguity(selectorOrRef, matches) {
            var lines = ['Ambiguous text selector "' + selectorOrRef + '" matched ' + matches.length + ' visible elements. Pass nth, or use a CSS selector or ref.'];
            for (var i = 0; i < Math.min(matches.length, 5); i++) {
               var el = matches[i];
               var rect = el.getBoundingClientRect();
               var text = (el.textContent || '').trim().substring(0, 50);
               var tag = el.tagName.toLowerCase();
               var className = el.className || '';
               lines.push('  nth=' + i + '  ' + tag + (className ? '.' + className.split(' ')[0] : '') + '  "' + text + '"  rect ' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
            }
            if (matches.length > 5) {
               lines.push('  ... and ' + (matches.length - 5) + ' more');
            }
            return lines.join('\\n');
         }

         var element = resolveElement(selector);
         element.focus();

         // Use native prototype setter to bypass React's value tracker
         var proto = element.tagName === 'TEXTAREA'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
         var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

         if (descriptor && descriptor.set) {
            descriptor.set.call(element, text);
         } else {
            element.value = text;
         }

         // Reset React's internal value tracker so it detects the change
         if (element._valueTracker) element._valueTracker.setValue('');

         // Dispatch proper InputEvent (not generic Event) for React compatibility
         element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
         element.dispatchEvent(new Event('change', { bubbles: true }));

         var msg = 'Typed "' + text + '" into ' + selector;
         var count = window.__MCP__.countAll(selector, strategy);
         if (count > 1) msg += ' (+' + (count - 1) + ' more match' + (count - 1 === 1 ? '' : 'es') + ')';
         return msg;
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

         const modStr = modifiers.length ? ' with ' + modifiers.join('+') : '';
         const dispatch = (type) => activeElement.dispatchEvent(new KeyboardEvent(type, eventOptions));

         if (action === 'press') {
            dispatch('keydown');
            dispatch('keypress');
            dispatch('keyup');
            return 'Pressed key: ' + key + modStr;
         } else if (action === 'down') {
            dispatch('keydown');
            return 'Key down: ' + key + modStr;
         } else if (action === 'up') {
            dispatch('keyup');
            return 'Key up: ' + key + modStr;
         }

         throw new Error('Unknown action: ' + action);
      })()
   `;
}
