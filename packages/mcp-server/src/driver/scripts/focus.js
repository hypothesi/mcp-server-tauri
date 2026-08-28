/**
 * Focus an element
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector, XPath, text, or ref ID (e.g., "ref=e3") for element to focus
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 * @param {number|null} params.nth - Zero-based index to pick one of several matching elements
 */
(function(params) {
   const { selector, strategy, nth } = params;

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

   const element = resolveElement(selector);
   element.focus();
   var msg = 'Focused element: ' + selector;
   var count = window.__MCP__.countAll(selector, strategy);
   if (count > 1) msg += ' (+' + (count - 1) + ' more match' + (count - 1 === 1 ? '' : 'es') + ')';
   return msg;
})
