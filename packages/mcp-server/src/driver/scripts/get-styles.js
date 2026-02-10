/**
 * Get computed CSS styles for elements
 *
 * @param {Object} params
 * @param {string} params.selector - CSS selector or ref ID (e.g., "ref=e3") for element(s)
 * @param {string[]} params.properties - Specific CSS properties to retrieve
 * @param {boolean} params.multiple - Whether to get styles for all matching elements
 */
(function(params) {
   const { selector, properties, multiple } = params;

   // Resolve element from CSS selector or ref ID (e.g., "ref=e3", "e3", or "[ref=e3]")
   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var resolve = window.__MCP__ && window.__MCP__.resolveRef;
      if (!resolve) throw new Error('Run webview_dom_snapshot first to index elements.');
      var el = resolve(selectorOrRef);
      if (!el) throw new Error('Element not found: ' + selectorOrRef + '. The DOM may have changed since the snapshot.');
      return el;
   }

   // Check if selector is a ref ID - if so, multiple doesn't apply
   const isRef = window.__MCP__ && window.__MCP__.resolveRef && /^\[?(?:ref=)?(e\d+)\]?$/.test(selector);
   const elements = isRef
      ? [resolveElement(selector)]
      : (multiple ? Array.from(document.querySelectorAll(selector)) : [document.querySelector(selector)]);

   if (!elements[0]) {
      throw new Error(`Element not found: ${selector}`);
   }

   const results = elements.map(element => {
      const styles = window.getComputedStyle(element);

      if (properties.length > 0) {
         const result = {};
         properties.forEach(prop => {
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
