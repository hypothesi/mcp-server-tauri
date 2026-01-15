/**
 * Focus an element
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector or ref ID (e.g., "ref=e3") for element to focus
 */
(function(params) {
   const { selector } = params;

   // Resolve element from CSS selector or ref ID (e.g., "ref=e3" or "e3")
   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var refMatch = selectorOrRef.match(/^(?:ref=)?(e\d+)$/);
      if (refMatch) {
         var refId = refMatch[1],
             refMap = window.__MCP_ARIA_REFS_REVERSE__;
         if (!refMap) throw new Error('Ref "' + refId + '" not found. Run webview_dom_snapshot first to index elements.');
         var el = refMap.get(refId);
         if (!el) throw new Error('Ref "' + refId + '" not found. The DOM may have changed since the snapshot.');
         return el;
      }
      var el = document.querySelector(selectorOrRef);
      if (!el) throw new Error('Element not found: ' + selectorOrRef);
      return el;
   }

   const element = resolveElement(selector);
   element.focus();
   return `Focused element: ${selector}`;
})
