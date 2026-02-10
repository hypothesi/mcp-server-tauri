/**
 * Focus an element
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector or ref ID (e.g., "ref=e3") for element to focus
 */
(function(params) {
   const { selector } = params;

   // Resolve element from CSS selector or ref ID (e.g., "ref=e3", "e3", or "[ref=e3]")
   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var resolve = window.__MCP__ && window.__MCP__.resolveRef;
      if (!resolve) throw new Error('Run webview_dom_snapshot first to index elements.');
      var el = resolve(selectorOrRef);
      if (!el) throw new Error('Element not found: ' + selectorOrRef + '. The DOM may have changed since the snapshot.');
      return el;
   }

   const element = resolveElement(selector);
   element.focus();
   return `Focused element: ${selector}`;
})
