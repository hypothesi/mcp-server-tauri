/**
 * Shared ref resolver - always available via window.__MCP__.resolveRef.
 * Accepts a ref ID ("e3", "ref=e3", "[ref=e3]") or CSS selector.
 * Returns the DOM element, or null if not found.
 *
 * Reads window.__MCP__.reverseRefs dynamically at call time so it always
 * uses the latest snapshot's data.
 */
(function() {
   window.__MCP__ = window.__MCP__ || {};
   window.__MCP__.resolveRef = function(selectorOrRef) {
      if (!selectorOrRef) return null;
      var refMatch = selectorOrRef.match(/^\[?(?:ref=)?(e\d+)\]?$/);
      if (refMatch) {
         var reverseRefs = window.__MCP__.reverseRefs;
         if (!reverseRefs) {
            throw new Error('Ref IDs require a snapshot. Run webview_dom_snapshot first to index elements.');
         }
         return reverseRefs.get(refMatch[1]) || null;
      }
      return document.querySelector(selectorOrRef);
   };
})();
