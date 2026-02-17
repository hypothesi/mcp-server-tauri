/**
 * Focus an element
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector, XPath, text, or ref ID (e.g., "ref=e3") for element to focus
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 */
(function(params) {
   const { selector, strategy } = params;

   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var el = window.__MCP__.resolveRef(selectorOrRef, strategy);
      if (!el) throw new Error('Element not found: ' + selectorOrRef);
      return el;
   }

   const element = resolveElement(selector);
   element.focus();
   var msg = 'Focused element: ' + selector;
   var count = window.__MCP__.countAll(selector, strategy);
   if (count > 1) msg += ' (+' + (count - 1) + ' more match' + (count - 1 === 1 ? '' : 'es') + ')';
   return msg;
})
