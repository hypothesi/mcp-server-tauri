/**
 * Focus an element
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector or ref ID (e.g., "ref=e3") for element to focus
 */
(function(params) {
   const { selector } = params;

   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var el = window.__MCP__.resolveRef(selectorOrRef);
      if (!el) throw new Error('Element not found: ' + selectorOrRef);
      return el;
   }

   const element = resolveElement(selector);
   element.focus();
   return `Focused element: ${selector}`;
})
