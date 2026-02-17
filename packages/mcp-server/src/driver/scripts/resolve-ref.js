/**
 * Shared ref resolver - always available via window.__MCP__.resolveRef.
 * Accepts a ref ID ("e3", "ref=e3", "[ref=e3]"), CSS selector, XPath, or text.
 * Returns the DOM element, or null if not found.
 *
 * Reads window.__MCP__.reverseRefs dynamically at call time so it always
 * uses the latest snapshot's data.
 *
 * Also provides:
 * - resolveAll(selector, strategy) - returns an Array of matching elements
 * - countAll(selector, strategy)   - returns the total match count
 */
(function() {
   window.__MCP__ = window.__MCP__ || {};

   var REF_PATTERN = /^\[?(?:ref=)?(e\d+)\]?$/;

   function xpathForText(text) {
      // Escape single quotes for XPath by splitting on ' and using concat()
      if (text.indexOf("'") === -1) {
         return "//*[contains(text(), '" + text + "')]";
      }
      var parts = text.split("'");
      var expr = 'concat(' + parts.map(function(p, i) {
         return (i > 0 ? ",\"'\",": '') + "'" + p + "'";
      }).join('') + ')';
      return '//*[contains(text(), ' + expr + ')]';
   }

   /**
    * Resolve a single element by selector and strategy.
    * @param {string} selectorOrRef - Selector, ref ID, XPath, or text
    * @param {string} [strategy]    - 'css' (default), 'xpath', or 'text'
    * @returns {Element|null}
    */
   window.__MCP__.resolveRef = function(selectorOrRef, strategy) {
      if (!selectorOrRef) return null;

      // Ref IDs always take priority regardless of strategy
      var refMatch = selectorOrRef.match(REF_PATTERN);
      if (refMatch) {
         var reverseRefs = window.__MCP__.reverseRefs;
         if (!reverseRefs) {
            throw new Error('Ref IDs require a snapshot. Run webview_dom_snapshot first to index elements.');
         }
         return reverseRefs.get(refMatch[1]) || null;
      }

      if (strategy === 'text') {
         var xpath = xpathForText(selectorOrRef);
         var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
         return result.singleNodeValue;
      }

      if (strategy === 'xpath') {
         var result = document.evaluate(selectorOrRef, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
         return result.singleNodeValue;
      }

      // Default: CSS selector
      return document.querySelector(selectorOrRef);
   };

   /**
    * Resolve all matching elements as an Array.
    * @param {string} selector  - Selector, XPath, or text
    * @param {string} [strategy] - 'css' (default), 'xpath', or 'text'
    * @returns {Element[]}
    */
   window.__MCP__.resolveAll = function(selector, strategy) {
      if (!selector) return [];

      // Ref IDs resolve to a single element
      var refMatch = selector.match(REF_PATTERN);
      if (refMatch) {
         var el = window.__MCP__.resolveRef(selector);
         return el ? [el] : [];
      }

      if (strategy === 'text') {
         var xpath = xpathForText(selector);
         var snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
         var results = [];
         for (var i = 0; i < snapshot.snapshotLength; i++) {
            results.push(snapshot.snapshotItem(i));
         }
         return results;
      }

      if (strategy === 'xpath') {
         var snapshot = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
         var results = [];
         for (var i = 0; i < snapshot.snapshotLength; i++) {
            results.push(snapshot.snapshotItem(i));
         }
         return results;
      }

      // Default: CSS
      return Array.from(document.querySelectorAll(selector));
   };

   /**
    * Count all matching elements.
    * @param {string} selector  - Selector, XPath, or text
    * @param {string} [strategy] - 'css' (default), 'xpath', or 'text'
    * @returns {number}
    */
   window.__MCP__.countAll = function(selector, strategy) {
      return window.__MCP__.resolveAll(selector, strategy).length;
   };
})();
