/**
 * Find an element using various selector strategies
 *
 * @param {Object} params
 * @param {string} params.selector - Element selector, ref ID (e.g., "ref=e3"), or text
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 */
(function(params) {
   const { selector, strategy } = params;
   let element;

   // Check if it's a ref ID first (works with any strategy)
   var resolve = window.__MCP__ && window.__MCP__.resolveRef;
   if (resolve && /^\[?(?:ref=)?(e\d+)\]?$/.test(selector)) {
      element = resolve(selector);
   } else if (strategy === 'text') {
      // Find element containing text
      const xpath = "//*[contains(text(), '" + selector + "')]";
      const result = document.evaluate(
         xpath,
         document,
         null,
         XPathResult.FIRST_ORDERED_NODE_TYPE,
         null
      );
      element = result.singleNodeValue;
   } else if (strategy === 'xpath') {
      // XPath selector
      const result = document.evaluate(
         selector,
         document,
         null,
         XPathResult.FIRST_ORDERED_NODE_TYPE,
         null
      );
      element = result.singleNodeValue;
   } else {
      // CSS selector (default)
      element = document.querySelector(selector);
   }

   if (element) {
      const outerHTML = element.outerHTML;
      // Truncate very long HTML to avoid overwhelming output
      const truncated = outerHTML.length > 5000
         ? outerHTML.substring(0, 5000) + '...'
         : outerHTML;
      return 'Found element: ' + truncated;
   }

   return 'Element not found';
})
