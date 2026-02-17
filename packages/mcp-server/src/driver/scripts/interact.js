/**
 * Webview interaction script - handles click, double-click, long-press, and scroll actions
 * This script is injected into the webview and executed with parameters.
 *
 * @param {Object} params
 * @param {string} params.action - The action to perform
 * @param {string|null} params.selector - CSS selector, XPath, text, or ref ID (e.g., "ref=e3") for the element
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 * @param {number|null} params.x - X coordinate
 * @param {number|null} params.y - Y coordinate
 * @param {number} params.duration - Duration for long-press
 * @param {number} params.scrollX - Horizontal scroll amount
 * @param {number} params.scrollY - Vertical scroll amount
 */
(function(params) {
   const { action, selector, strategy, x, y, duration, scrollX, scrollY } = params;

   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var el = window.__MCP__.resolveRef(selectorOrRef, strategy);
      if (!el) throw new Error('Element not found: ' + selectorOrRef);
      return el;
   }

   function matchHint() {
      if (!selector) return '';
      var count = window.__MCP__.countAll(selector, strategy);
      if (count > 1) return ' (+' + (count - 1) + ' more match' + (count - 1 === 1 ? '' : 'es') + ')';
      return '';
   }

   let element = null;
   let targetX, targetY;

   // For scroll action, we don't necessarily need a selector or coordinates
   if (action === 'scroll') {
      if (selector) {
         element = resolveElement(selector);
      }
   } else {
      // For other actions, we need either selector or coordinates
      if (selector) {
         element = resolveElement(selector);
         const rect = element.getBoundingClientRect();
         targetX = rect.left + rect.width / 2;
         targetY = rect.top + rect.height / 2;
      } else if (x !== null && y !== null) {
         targetX = x;
         targetY = y;
         element = document.elementFromPoint(x, y);
      } else {
         throw new Error('Either selector or coordinates (x, y) must be provided');
      }
   }

   // Perform the interaction
   const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: targetX,
      clientY: targetY,
   };

   if (action === 'click') {
      if (element) {
         element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
         element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
         element.dispatchEvent(new MouseEvent('click', eventOptions));
      }
      return `Clicked at (${targetX}, ${targetY})` + matchHint();
   }

   if (action === 'double-click') {
      if (element) {
         element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
         element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
         element.dispatchEvent(new MouseEvent('click', eventOptions));
         element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
         element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
         element.dispatchEvent(new MouseEvent('click', eventOptions));
         element.dispatchEvent(new MouseEvent('dblclick', eventOptions));
      }
      return `Double-clicked at (${targetX}, ${targetY})` + matchHint();
   }

   if (action === 'long-press') {
      if (element) {
         element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
         setTimeout(() => {
            element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
         }, duration);
      }
      return `Long-pressed at (${targetX}, ${targetY}) for ${duration}ms` + matchHint();
   }

   if (action === 'scroll') {
      const scrollTarget = element || window;
      if (scrollX !== 0 || scrollY !== 0) {
         if (scrollTarget === window) {
            window.scrollBy(scrollX, scrollY);
         } else {
            scrollTarget.scrollLeft += scrollX;
            scrollTarget.scrollTop += scrollY;
         }
         return `Scrolled by (${scrollX}, ${scrollY}) pixels` + matchHint();
      }
      return 'No scroll performed (scrollX and scrollY are both 0)';
   }

   throw new Error(`Unknown action: ${action}`);
})
