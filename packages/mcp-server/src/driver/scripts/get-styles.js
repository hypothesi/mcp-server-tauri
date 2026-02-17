/**
 * Get computed CSS styles for elements
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector, XPath, text, or ref ID (e.g., "ref=e3") for element(s)
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 * @param {string[]} params.properties - Specific CSS properties to retrieve
 * @param {boolean} params.multiple - Whether to get styles for all matching elements
 */
(function(params) {
   const { selector, strategy, properties, multiple } = params;

   var elements;

   if (multiple) {
      elements = window.__MCP__.resolveAll(selector, strategy);
   } else {
      var el = window.__MCP__.resolveRef(selector, strategy);
      elements = el ? [el] : [];
   }

   if (!elements[0]) {
      throw new Error('Element not found: ' + selector);
   }

   const results = elements.map(function(element) {
      const styles = window.getComputedStyle(element);

      if (properties.length > 0) {
         const result = {};
         properties.forEach(function(prop) {
            result[prop] = styles.getPropertyValue(prop);
         });
         return result;
      }

      // Return all styles
      const allStyles = {};
      for (let i = 0; i < styles.length; i++) {
         const prop = styles[i];
         allStyles[prop] = styles.getPropertyValue(prop);
      }
      return allStyles;
   });

   return JSON.stringify(multiple ? results : results[0]);
})
