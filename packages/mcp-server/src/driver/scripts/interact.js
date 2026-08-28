/**
 * Webview interaction script - handles click, double-click, long-press, scroll, swipe, hover, and right-click actions
 * This script is injected into the webview and executed with parameters.
 *
 * @param {Object} params
 * @param {string} params.action - The action to perform
 * @param {string|null} params.selector - CSS selector, XPath, text, or ref ID (e.g., "ref=e3") for the element
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 * @param {number|null} params.nth - Zero-based index to pick one of several matching elements
 * @param {number|null} params.x - X coordinate
 * @param {number|null} params.y - Y coordinate
 * @param {number} params.duration - Duration for long-press
 * @param {number} params.scrollX - Horizontal scroll amount
 * @param {number} params.scrollY - Vertical scroll amount
 */
(function(params) {
   const { action, selector, strategy, nth, x, y, duration, scrollX, scrollY } = params;

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
      return lines.join('\n');
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

   const pointerOptions = {
      ...eventOptions,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
   };

   const rightButtonOptions = {
      ...eventOptions,
      button: 2,
      buttons: 2,
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

   if (action === 'hover') {
      if (element) {
         element.dispatchEvent(new PointerEvent('pointerover', pointerOptions));
         element.dispatchEvent(new PointerEvent('pointerenter', pointerOptions));
         element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
         element.dispatchEvent(new MouseEvent('mouseenter', eventOptions));
         element.dispatchEvent(new PointerEvent('pointermove', pointerOptions));
         element.dispatchEvent(new MouseEvent('mousemove', eventOptions));
      }
      return `Hovered at (${targetX}, ${targetY})` + matchHint();
   }

   if (action === 'right-click') {
      if (element) {
         element.dispatchEvent(new MouseEvent('mousedown', rightButtonOptions));
         element.dispatchEvent(new MouseEvent('mouseup', rightButtonOptions));
         element.dispatchEvent(new MouseEvent('contextmenu', rightButtonOptions));
      }
      return `Right-clicked at (${targetX}, ${targetY})` + matchHint();
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
