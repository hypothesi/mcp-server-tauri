/**
 * Find an element using various selector strategies
 *
 * @param {Object} params
 * @param {string} params.selector - Element selector, ref ID (e.g., "ref=e3"), or text
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 */
(function(params) {
   const { selector, strategy } = params;

   var element = window.__MCP__.resolveRef(selector, strategy);

   if (element) {
      const outerHTML = element.outerHTML;
      // Truncate very long HTML to avoid overwhelming output
      const truncated = outerHTML.length > 5000
         ? outerHTML.substring(0, 5000) + '...'
         : outerHTML;
      var msg = 'Found element: ' + truncated;
      var count = window.__MCP__.countAll(selector, strategy);
      if (count > 1) msg += '\n(+' + (count - 1) + ' more match' + (count - 1 === 1 ? '' : 'es') + ')';
      return msg;
   }

   return 'Element not found';
})
